const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require("path");
const { z } = require("zod");
const { NotFoundError, ValidationError } = require("../lib/errors");
const { GoogleGenAI } = require("@google/genai");

// Apply authentication middleware globally to all question routes
router.use(authenticate);

// Zod schema for input validation - Configured to support difficulty parameters
const questionInput = z.object({
  question: z.string().min(1),
  date: z.string().min(1),
  answer: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
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
  const likesArray = question.likes || [];

  let formattedKeywords = [];
  if (Array.isArray(question.keywords)) {
    formattedKeywords = question.keywords.map((k) => {
      if (typeof k === "string") return k;
      if (k && typeof k === "object" && k.name) return k.name;
      return null;
    }).filter(Boolean);
  }

  return {
    ...question,
    date: question.date ? (typeof question.date.toISOString === 'function' ? question.date.toISOString().split("T")[0] : question.date) : null,
    answer: isOwner || isAttempted ? question.answer : undefined,
    keywords: formattedKeywords,
    userName: question.user ? question.user.name : null,
    isAttempted,
    isOwner,
    isBookmarked: question.bookmarks?.length > 0,
    isCorrect: question.attempts?.[0]?.isCorrect ?? null,
    attemptsCount: question._count?.attempts ?? 0,
    bookmarksCount: question._count?.bookmarks ?? 0,
    isLiked: likesArray.length > 0,
    likesCount: question._count?.likes ?? 0,
    likes: undefined,
    user: undefined,
    attempts: undefined,
    _count: undefined,
    bookmarks: undefined,
  };
}

// GET /api/questions/ (Supports page splitting and query filtering via ?difficulty=)
router.get("/", async (req, res, next) => {
  try {
    const { keyword, difficulty } = req.query;
    
    const where = {};
    if (keyword) {
      where.keywords = { some: { name: keyword } };
    }
    if (difficulty) {
      where.difficulty = difficulty;
    }

    const rawPage = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);

    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.max(1, Math.min(100, isNaN(rawLimit) ? 5 : rawLimit));
    const skip = (page - 1) * limit;

    let filteredQuestions = [];
    let total = 0;

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
            likes: { where: { userId: req.user.userId }, take: 1 }, 
            _count: {
              select: { attempts: true, bookmarks: true, likes: true },
            },
          },
          orderBy: { id: "asc" },
          skip,
          take: limit,
        });
      }
    } catch (dbError) {
      console.error("Database tracking error: ", dbError);
      total = 0;
      filteredQuestions = [];
    }

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

// POST /api/questions/ai-generate (Hardened Regex String Extraction Engine)
router.post("/ai-generate", async (req, res, next) => {
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== "string") {
      throw new ValidationError("Please provide a valid topic string for prompt generation.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is completely unassigned inside process.env.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate an educational question about "${topic}". Respond strictly with a clean, raw JSON structure matching these keys exactly: {"question": "your text string", "answer": "your answer text string", "difficulty": "easy, medium, or hard"}. Do not return Markdown wrappers or code blocks.`,
    });

    const aiText = response.text || "{}";
    
    // Finds indices to isolate raw json block and strip unexpected AI explanations
    const startIdx = aiText.indexOf('{');
    const endIdx = aiText.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1) {
      throw new ValidationError("The AI engine failed to deliver an appropriately isolatable JSON syntax layer.");
    }
    
    const isolatedJsonString = aiText.substring(startIdx, endIdx + 1).trim();
    const cleanJson = JSON.parse(isolatedJsonString);

    const savedQuestion = await prisma.question.create({
      data: {
        question: cleanJson.question,
        answer: cleanJson.answer,
        difficulty: cleanJson.difficulty || "medium",
        date: new Date(),
        user: { connect: { id: req.user.userId } },
      },
      include: { keywords: true, user: true },
    });

    return res.status(201).json(formatQuestion(savedQuestion, req.user.userId));
  } catch (error) {
    console.error("AI Generation processing failed:", error);
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
            likes: { where: { userId: req.user.userId }, take: 1 },
            _count: {
              select: { attempts: true, bookmarks: true, likes: true },
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
        likes: { where: { userId: req.user.userId }, take: 1 }, 
        _count: {
          select: { attempts: true, bookmarks: true, likes: true }, 
        },
      },
    });

    if (!question) {
      return res.status(404).json({ message: "question not found" });
    }

    return res.json(formatQuestion(question, req.user.userId));
  } catch (error) {
    next(error); 
  }
});

// POST /api/questions/
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const { question, date, answer, keywords, difficulty } = questionInput.parse(req.body);
    const keywordsArray = Array.isArray(keywords) ? keywords : [];
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const newQuestion = await prisma.question.create({
      data: {
        question,
        date: new Date(date),
        imageUrl,
        answer,
        difficulty, 
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

      const { question, date, answer, keywords, difficulty } = questionInput.parse(req.body);
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : ques.imageUrl;
      const keywordsArray = Array.isArray(keywords) ? keywords : [];

      const updatedQuestion = await prisma.question.update({
        where: { id: questionId },
        data: {
          question,
          date: new Date(date),
          imageUrl,
          answer,
          difficulty, 
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

    const isCorrect = userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();

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
