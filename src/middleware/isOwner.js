const { NotFoundError, ForbiddenError } = require("../lib/errors");
const prisma = require("../lib/prisma");

async function isOwner(req, res, next) {
  const id = Number(req.params.questionId);

  const record = await prisma.question.findUnique({
    where: { id },
  });

  if (!record) {
    throw new NotFoundError("Question not found")
  }

  if (record.userId !== req.user.userId) {
    throw new ForbiddenError("You can only modify your own question")

  }

  req.question = record;
  next();
}

module.exports = isOwner;