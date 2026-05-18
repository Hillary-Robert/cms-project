const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require("path");
const { z } = require("zod");
const { NotFoundError, ValidationError } = require("../lib/errors");

// Apply authentication middleware globally to all question routes
router.use(authenticate);

// Zod schema for input validation
const questionInput = z.object({
  question: z.string().min(1),
  date: z.coerce.date(),
  answer: z.string().min(1),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
});

// Multer storage configurations
const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const FileExtentionName = path.extname(file.originalname);
    const newName = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}${FileExtentionName}`;
    cb(null, newName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image")) {
      cb(null, true);
    } else {
      cb(new Error("only images are allowed"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Utility formatter function
function formatQuestion(question, currentUserId) {
  if (!question) return null;

  const isAttempted = question.attempts?.length > 0;
  const isOwner = question.userId === currentUserId;

  const likesArray = question.questionLike || question.likes || [];

  return {
    ...question,
    date: question.date ? question.date.toISOString().split("T")[0] : null,
    answer: isOwner || isAttempted ? question.answer : undefined,
    keywords: question.keywords ? question.keywords.map((k) => k.name) : [],
    userName: question.user ? question.user.name : null,
    isAttempted,
    isOwner,
    isBookmarked: question.bookmarks?.length > 0,
    isCorrect: question.attempts?.[0]?.isCorrect ?? null,
    attemptsCount: question._count?.attempts ?? 0,
    bookmarksCount: question._count?.bookmarks ?? 0,
    isLiked: likesArray.length > 0,
    likesCount: question._count?.questionLike ?? question._count?.likes ?? 0,
    likes: undefined,
    questionLike: undefined,
    user: undefined,
    attempts: undefined,
    _count: undefined,
    bookmarks: undefined,
  };
}

// GET /api/questions/
router.get("/", async (req, res, next) => {
  try {
    const { keyword } = req.query;
    const where = keyword ? { keywords: { some: { name: keyword } } } : {};

    // 1. Explicitly parse parameters to integers
    const rawPage = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);

    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.max(1, Math.min(100, isNaN(rawLimit) ? 5 : rawLimit));
    const skip = (page - 1) * limit;

    let filteredQuestions = [];
    let total = 0;

    // 3. Isolate database interactions to protect against empty-state crashes
    try {
      total = await prisma.question.count({ where });

      if (total > 0) {
        filteredQuestions = await prisma.question.findMany({
          where,
          include: {
            keywords: true,
            user: true,
            attempts: { where: { userId: req.user.userId }, take: 1 },
            bookmarks: { where: { userId: req.user.userId }, take: 1 },
            questionLike: { where: { userId: req.user.userId }, take: 1 },
            _count: {
              select: { attempts: true, bookmarks: true, questionLike: true },
            },
          },
          orderBy: { id: "asc" },
          skip,
          take: limit,
        });
      }
    } catch (dbError) {
      total = 0;
      filteredQuestions = [];
    }

    // 4. Return a clean, structured JSON response payload
    return res.status(200).json({
      data: filteredQuestions.map((q) => formatQuestion(q, req.user.userId)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/questions/me/bookmarks
router.get("/me/bookmarks", async (req, res, next) => {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: req.user.userId },
      include: {
        question: {
          include: {
            keywords: true,
            user: true,
            attempts: { where: { userId: req.user.userId }, take: 1 },
            bookmarks: { where: { userId: req.user.userId }, take: 1 },

            questionLike: { where: { userId: req.user.userId }, take: 1 },
            _count: {
              select: { attempts: true, bookmarks: true, questionLike: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(
      bookmarks.map((b) => ({
        id: b.id,
        bookmarkedAt: b.createdAt,
        question: formatQuestion(b.question, req.user.userId),
      })),
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/questions/:questionId
router.get("/:questionId", async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);

    if (!questionId || isNaN(questionId)) {
      return res.status(404).json({ message: "question not found" });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: req.user.userId }, take: 1 },
        bookmarks: { where: { userId: req.user.userId }, take: 1 },
        // FIXED: Use questionLike to match schema structure
        questionLike: { where: { userId: req.user.userId }, take: 1 },
        _count: {
          select: { attempts: true, bookmarks: true, questionLike: true },
        },
      },
    });

    if (!question) {
      return res.status(404).json({ message: "question not found" });
    }

    return res.json(formatQuestion(question, req.user.userId));
  } catch (error) {
    return res.status(404).json({ message: "question not found" });
  }
});

// POST /api/questions/
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const { question, date, answer, keywords } = questionInput.parse(req.body);
    const keywordsArray = Array.isArray(keywords) ? keywords : [];
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const newQuestion = await prisma.question.create({
      data: {
        question,
        date: new Date(date),
        imageUrl,
        answer,
        user: { connect: { id: req.user.userId } },
        keywords: {
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
      include: { keywords: true, user: true },
    });

    return res.status(201).json(formatQuestion(newQuestion, req.user.userId));
  } catch (error) {
    next(error);
  }
});

// PUT /api/questions/:questionId
router.put(
  "/:questionId",
  isOwner,
  upload.single("image"),
  async (req, res, next) => {
    try {
      const questionId = Number(req.params.questionId);
      const ques = await prisma.question.findUnique({
        where: { id: questionId },
      });

      if (!ques) {
        throw new NotFoundError("Question doesn't exist");
      }

      const { question, date, answer, keywords } = questionInput.parse(
        req.body,
      );
      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : ques.imageUrl;
      const keywordsArray = Array.isArray(keywords) ? keywords : [];

      const updatedQuestion = await prisma.question.update({
        where: { id: questionId },
        data: {
          question,
          date: new Date(date),
          imageUrl,
          answer,
          keywords: {
            set: [],
            connectOrCreate: keywordsArray.map((kw) => ({
              where: { name: kw },
              create: { name: kw },
            })),
          },
        },
        include: { keywords: true, user: true },
      });

      return res.json(formatQuestion(updatedQuestion, req.user.userId));
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/questions/:questionId
router.delete("/:questionId", isOwner, async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);

    const questionIndex = await prisma.question.findUnique({
      where: { id: questionId },
      include: { keywords: true, user: true },
    });

    if (!questionIndex) {
      throw new NotFoundError("Question not found");
    }

    await prisma.attempt.deleteMany({ where: { questionId } });
    await prisma.bookmark.deleteMany({ where: { questionId } });
    await prisma.questionLike.deleteMany({ where: { questionId } });
    await prisma.question.delete({ where: { id: questionId } });

    return res.json({
      msg: "Question deleted successfully",
      question: formatQuestion(questionIndex, req.user.userId),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/questions/:questionId/attempt
router.post("/:questionId/attempt", async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);
    const { userAnswer } = req.body;

    if (!userAnswer) {
      throw new ValidationError("Please answer the question");
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundError("Question is missing");
    }

    const isCorrect =
      userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();

    const attempt = await prisma.attempt.create({
      data: {
        userAnswer,
        isCorrect,
        user: { connect: { id: req.user.userId } },
        question: { connect: { id: questionId } },
      },
    });

    return res.status(201).json({
      msg: "Question has been successfully attempted",
      attempt,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/questions/:questionId/bookmark
router.post("/:questionId/bookmark", async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    const existingBookmark = await prisma.bookmark.findFirst({
      where: { userId: req.user.userId, questionId },
    });

    if (existingBookmark) {
      throw new ValidationError("Question already bookmarked");
    }

    const bookmark = await prisma.bookmark.create({
      data: {
        user: { connect: { id: req.user.userId } },
        question: { connect: { id: questionId } },
      },
    });

    return res.status(201).json({
      msg: "Question successfully bookmarked",
      bookmark,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/questions/:questionId/bookmark
router.delete("/:questionId/bookmark", async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);

    const bookmark = await prisma.bookmark.findFirst({
      where: { userId: req.user.userId, questionId },
    });

    if (!bookmark) {
      throw new NotFoundError("Bookmark not found");
    }

    await prisma.bookmark.delete({ where: { id: bookmark.id } });

    return res.json({ msg: "Bookmark successfully removed" });
  } catch (error) {
    next(error);
  }
});

// POST /api/questions/:questionId/like
router.post("/:questionId/like", async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    const existingLike = await prisma.questionLike.findFirst({
      where: { userId: req.user.userId, questionId },
    });

    if (existingLike) {
      throw new ValidationError("Question already liked");
    }

    const like = await prisma.questionLike.create({
      data: {
        user: { connect: { id: req.user.userId } },
        question: { connect: { id: questionId } },
      },
    });

    return res.status(201).json({
      msg: "Question liked successfully",
      like,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/questions/:questionId/like
router.delete("/:questionId/like", async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);

    const like = await prisma.questionLike.findFirst({
      where: { userId: req.user.userId, questionId },
    });

    if (!like) {
      throw new NotFoundError("Like not found");
    }

    await prisma.questionLike.delete({ where: { id: like.id } });

    return res.json({ msg: "Question unliked successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
