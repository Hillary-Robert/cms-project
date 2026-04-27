const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");

function formatQuestion(question) {
  return {
    ...question,
    date: question.date.toISOString().split("T")[0],
    keywords: question.keywords.map((k) => k.name),
  };
}


router.use(authenticate)

// GET api/questions/, /api/questions?keyword=http
router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const where = keyword ? { keywords: { some: { name: keyword } } } : {};

  const filteredQuestions = await prisma.question.findMany({
    where,
    include: { keywords: true },
    orderBy: { id: "asc" },
  });

  return res.json(filteredQuestions.map(formatQuestion));
});

//  GET api/questions/:questionId
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const question = await prisma.question.findUnique({

    where: { id: questionId },
    include: { keywords: true },
  });

  if (!question) {
    return res.status(404).json({ msg: "Question doesn't exist" });
  }

  res.json(formatQuestion(question));
});

// POST

router.post("/", async (req, res) => {
  const { question, date, answer, keywords } = req.body;
  if (!question || !date || !answer) {
    return res
      .status(400)
      .json({ msg: "question, date and answer are required " });
  }

  const keywordsArray = Array.isArray(keywords) ? keywords : [];

  const newQuestion = await prisma.question.create({
    data: {
      question,
      date: new Date(date),
      answer,
      keywords: {
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true },
  });

  res.status(201).json(formatQuestion(newQuestion));
});

//put

router.put("/:questionId", isOwner,  async (req, res) => {
  const questionId = Number(req.params.questionId);

  const ques = await prisma.question.findUnique({ where: { id: questionId } });

  if (!ques) {
    return res.status(404).json({ msg: "Question doesn't exist" });
  }

  const { question, date, answer, keywords } = req.body;
  if (!question || !date || !answer) {
    return res
      .status(400)
      .json({ msg: "question, date and answer are required " });
  }

  const keywordsArray = Array.isArray(keywords) ? keywords : [];
  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: {
      question,
      date: new Date(date),
      answer,
      keywords: {
        set: [],
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true },
  });
  res.json(formatQuestion(updatedQuestion));
});

// Delete

router.delete("/:questionId", isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);

  const questionIndex = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true },
  });

  if (!questionIndex) {
    return res.status(404).json({ message: "Question not found" });
  }

  await prisma.question.delete({ where: { id: questionId } });

  res.json({
    msg: "Question deleted successfully",
    question: formatQuestion(questionIndex),
  });
});

module.exports = router;
