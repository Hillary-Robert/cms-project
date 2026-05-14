const express = require("express");
const router = express.Router();
const {prisma} = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer")
const path = require("path");
const {z} = require("zod")
const { NotFoundError, ValidationError } = require("../lib/errors");

router.use(authenticate);

const questionInput = z.object({
  question: z.string().min(1),
  date: z.coerce.date(),
  answer: z.string().min(1),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
});


const storage = multer.diskStorage({
  destination: path.join(__dirname, "..","..","public","uploads"),
  filename: (req, file, cb)=>{
    const FileExtentionName = path.extname(file.originalname)
    const newName = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}${FileExtentionName}`
    cb(null, newName)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if(file.mimetype.startsWith("image")){
      cb(null, true)
    }else{
      cb(new Error("only images are allowed"))
    }
  },
  limits: {fileSize: 5 * 1024 * 1024}
})



function formatQuestion(question, currentUserId) {
  const isAttempted = question.attempts?.length > 0;
  const isOwner = question.userId === currentUserId;

  return {
    ...question,
    date: question.date.toISOString().split("T")[0],
    answer: isOwner || isAttempted ? question.answer : undefined,
    keywords: question.keywords.map((k) => k.name),
    userName: question.user ? question.user.name : null,
    isAttempted,
    isOwner,
    isBookmarked: question.bookmarks?.length > 0,
    isCorrect: question.attempts?.[0]?.isCorrect ?? null,
    attemptsCount: question._count?.attempts,
    bookmarksCount: question._count?.bookmarks,
    isLiked: question.likes?.length > 0,
    likesCount: question._count?.likes,
    likes: undefined,
    user: undefined,
    attempts: undefined,
    _count: undefined,
    bookmarks: undefined,
  };
}

router.use(authenticate);

// GET api/questions/, /api/questions?keyword=http&page=1&limit=5
router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const where = keyword ? { keywords: { some: { name: keyword } } } : {};

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
  const skip = (page - 1) * limit;

  const [filteredQuestions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: req.user.userId }, take: 1 },
        bookmarks: { where: { userId: req.user.userId }, take: 1 },
        likes: { where: { userId: req.user.userId }, take: 1 },
        _count: { select: { attempts: true, bookmarks: true, likes: true } },
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
    prisma.question.count({ where }),
  ]);

  res.json({
    data: filteredQuestions.map((q)=>formatQuestion(q, req.user.userId)),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

// Get user Bookmatks
router.get("/me/bookmarks", async (req, res) => {
  const bookmarks = await prisma.bookmark.findMany({
    where: {
      userId: req.user.userId,
    },
    include: {
      question: {
        include: {
          keywords: true,
          user: true,
          attempts: { where: { userId: req.user.userId }, take: 1 },
          bookmarks: { where: { userId: req.user.userId }, take: 1 },
          likes: { where: { userId: req.user.userId }, take: 1 },
          _count: { select: { attempts: true, bookmarks: true, likes: true } },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json(
    bookmarks.map((b) => ({
      id: b.id,
      bookmarkedAt: b.createdAt,
      question: formatQuestion(b.question, req.user.userId),
    })),
  );
});

//  GET api/question/:questionId- Get a single by Id with  attempts and bookmarks
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      keywords: true,
      user: true,
      attempts: {
        where: { userId: req.user.userId },
        take: 1,
      },
      bookmarks: {
        where: { userId: req.user.userId },
        take: 1,
      },

      likes: { where: { userId: req.user.userId }, take: 1 },
      _count: {
        select: {
          attempts: true,
          bookmarks: true,
          likes: true,
        },
      },
    },
  });

  console.log("QUESTION:", question);

  if (!question) {
  return res.status(404).json({message: "question not found"});
  

}


  res.json(formatQuestion(question, req.user.userId));
});


// POST- Create a new question

router.post("/", upload.single("image"), async (req, res) => {

  const { question, date, answer, keywords } = questionInput.parse(req.body);

  const keywordsArray = Array.isArray(keywords) ? keywords : [];
  const imageUrl = req.file? `/uploads/${req.file.filename}` : null;

  const newQuestion = await prisma.question.create({
    data: {
      question,
      date: new Date(date),
      imageUrl,
      answer,
      user: {
        connect: { id: req.user.userId },
      },
      keywords: {
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true, user: true },
  });

  res.status(201).json(formatQuestion(newQuestion, req.user.userId));
});

//put- update a question by Id(Owner only)

router.put("/:questionId", isOwner, upload.single("image"), async (req, res) => {
  const questionId = Number(req.params.questionId);

  const ques = await prisma.question.findUnique({ where: { id: questionId } });

  if (!ques) {
    throw new NotFoundError("Question doesn't exist")
  }

  const { question, date, answer, keywords } = questionInput.parse(req.body);

  if (!question || !date || !answer) {
      throw new ValidationError("Question, date and answer are mandatory")
  }

  const imageUrl = req.file? `/uploads/${req.file.filename}` : null;

  const keywordsArray = Array.isArray(keywords) ? keywords : [];
  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: {
      question,
      date: new Date(date),
      imageUrl: req.file ? `/uploads/${req.file.filename}` : ques.imageUrl,
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
  res.json(formatQuestion(updatedQuestion, req.user.userId));
});

// Delete - Delete a question by Id(Owner only)

router.delete("/:questionId", isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);

  const questionIndex = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true, user: true },
  });

  if (!questionIndex) {
    throw new NotFoundError("Question not found")
  }

  await prisma.attempt.deleteMany({
    where: { questionId },
  });

  await prisma.bookmark.deleteMany({
    where: { questionId },
  });

  await prisma.questionLike.deleteMany({
    where: { questionId },
  });

  await prisma.question.delete({
    where: { id: questionId },
  });

  res.json({
    msg: "Question deleted successfully",
    question: formatQuestion(questionIndex, req.user.userId),
  });
});

// Post an attempt

router.post("/:questionId/attempt", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const { userAnswer } = req.body;
 
  if (!userAnswer) {
    throw new ValidationError("Please answer the question")
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new NotFoundError("Question is missing")
  }

  const isCorrect =
    userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();

  const attempt = await prisma.attempt.create({
    data: {
      userAnswer,
      isCorrect,
      user: {
        connect: { id: req.user.userId },
      },
      question: {
        connect: { id: questionId },
      },
    },
  });

  res.status(201).json({
    msg: "Questio has been successfully attempted",
    attempt,
  });
});

// Post Bookmarks- Add a bookmark to a question
router.post("/:questionId/bookmark", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new NotFoundError("Question not found")
  }

  const existingBookmark = await prisma.bookmark.findFirst({
    where: {
      userId: req.user.userId,
      questionId,
    },
  });

  if (existingBookmark) {
    throw new ValidationError("Question already bookmarked")
  }

  const bookmark = await prisma.bookmark.create({
    data: {
      user: {
        connect: { id: req.user.userId },
      },
      question: {
        connect: { id: questionId },
      },
    },
  });

  res.status(201).json({
    msg: "Question successfully bookmarked",
    bookmark,
  });
});

// Deleting bookmarks from a question

router.delete("/:questionId/bookmark", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const bookmark = await prisma.bookmark.findFirst({
    where: {
      userId: req.user.userId,
      questionId,
    },
  });

  if (!bookmark) {
    throw new NotFoundError("Bookmark not found")
  }

  await prisma.bookmark.delete({
    where: {
      id: bookmark.id,
    },
  });

  res.json({
    msg: "Bookmark successfully removed",
  });
});

// LIKE a question
router.post("/:questionId/like", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new NotFoundError("Question not found")
  }

  const existingLike = await prisma.questionLike.findFirst({
    where: {
      userId: req.user.userId,
      questionId,
    },
  });

  if (existingLike) {
    throw new ValidationError("Question already liked")
  }

  const like = await prisma.questionLike.create({
    data: {
      user: {
        connect: { id: req.user.userId },
      },
      question: {
        connect: { id: questionId },
      },
    },
  });

  res.status(201).json({
    msg: "Question liked successfully",
    like,
  });
});

// UNLIKE a question
router.delete("/:questionId/like", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const like = await prisma.questionLike.findFirst({
    where: {
      userId: req.user.userId,
      questionId,
    },
  });

  if (!like) {
    throw new NotFoundError("Like not found")
  }

  await prisma.questionLike.delete({
    where: {
      id: like.id,
    },
  });

  res.json({
    msg: "Question unliked successfully",
  });
});



module.exports = router;
