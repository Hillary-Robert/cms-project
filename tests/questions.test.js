const { resetDb, request, app, prisma } = require("./helpers");
const jwt = require("jsonwebtoken");

beforeEach(resetDb);

describe("Questions tests", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/questions");
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown question", async () => {
    // Generate a unique user per run to avoid credential collisions
    const seed = Math.random().toString(36).slice(2, 7);
    await request(app).post("/api/auth/register").send({
      email: `test-${seed}@test.io`, password: "pw12345", name: "Tester"
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email: `test-${seed}@test.io`, password: "pw12345"
    });
    const token = loginRes.body.token || loginRes.body.data?.token;

    const res = await request(app).get("/api/questions/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("question not found");
  });

  it("returns 400 for invalid question body", async () => {
    const seed = Math.random().toString(36).slice(2, 7);
    await request(app).post("/api/auth/register").send({
      email: `test-${seed}@test.io`, password: "pw12345", name: "Tester"
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email: `test-${seed}@test.io`, password: "pw12345"
    });
    const token = loginRes.body.token || loginRes.body.data?.token;

    const res = await request(app).post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "" });
    expect(res.status).toBe(400);
  });

  it("returns 403 when editing someone else's question and leaves the database unchanged", async () => {
    const secret = process.env.JWT_SECRET || "test-secret";

    // 1. Explicitly provision Alice (User 1)
    await request(app).post("/api/auth/register").send({
      email: "alice@test.io", password: "pw12345", name: "Alice"
    });
    const aliceUser = await prisma.user.findUnique({ where: { email: "alice@test.io" } });
    const aliceToken = jwt.sign({ userId: aliceUser.id, email: aliceUser.email }, secret, { expiresIn: "1h" });

    // 2. provide Bob (User 2)
    await request(app).post("/api/auth/register").send({
      email: "bob@test.io", password: "pw12345", name: "Bob"
    });
    const bobUser = await prisma.user.findUnique({ where: { email: "bob@test.io" } });
    const bobToken = jwt.sign({ userId: bobUser.id, email: bobUser.email }, secret, { expiresIn: "1h" });

    // 3. Create Alice's question directly via Prisma
    const initialQuestion = await prisma.question.create({
      data: {
        question: "Alice's original security question text",
        answer: "Alice's Safe Answer Secret",
        date: new Date("2026-05-18"),
        userId: aliceUser.id
      }
    });
    const questionId = initialQuestion.id;

    // 4. Attempt to edit Alice's question using Bob's token
    const editRes = await request(app)
      .put(`/api/questions/${questionId}`)
      .set("Authorization", `Bearer ${bobToken}`)
      .send({
        question: "Maliciously hijacked question statement",
        answer: "Hacked Answer payload",
        date: "2026-05-18",
        keywords: ["hacked"]
      });

    // 5. Assertions: Expect 403 Forbidden and no database changes
    expect(editRes.status).toBe(403);

    const dbRecordAfterAttack = await prisma.question.findUnique({
      where: { id: questionId }
    });
    expect(dbRecordAfterAttack.question).toBe("Alice's original security question text");
    expect(dbRecordAfterAttack.answer).toBe("Alice's Safe Answer Secret");
  });
});
