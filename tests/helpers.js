const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");
console.log(Object.keys(prisma));
async function resetDb() {
  await prisma.questionLike.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany();
}

async function registerAndLogin(email = "a@test.io", name = "A") {
  await request(app)
    .post("/api/auth/register")
    .send({
      email,
      password: "pw12345",
      name
    });

  const res = await request(app)
    .post("/api/auth/login")
    .send({
      email,
      password: "pw12345"
    });

  return res.body.token;
}

async function createQuestion(token, overrides = {}) {
  const res = await request(app)
    .post("/api/questions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      question: "What is Node.js?",
      answer: "A JavaScript runtime",
      date: "2026-01-01",
      ...overrides
    });

  return res.body;
}

module.exports = {
  resetDb,
  registerAndLogin,
  createQuestion,
  request,
  app,
  prisma
};