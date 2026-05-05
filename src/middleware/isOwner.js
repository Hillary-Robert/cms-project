const prisma = require("../lib/prisma");

async function isOwner(req, res, next) {
  const id = Number(req.params.questionId);

  const record = await prisma.question.findUnique({
    where: { id },
  });

  if (!record) {
    return res.status(404).json({ message: "Question not found" });
  }

  if (record.userId !== req.user.userId) {
    return res.status(403).json({
      error: "You can only modify your own question",
    });
  }

  req.question = record;
  next();
}

module.exports = isOwner;