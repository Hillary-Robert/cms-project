const bcrypt = require("bcrypt");
const { resetDb, request, app, prisma } = require("./helpers");

// Run database clean up hooks before executing tests
beforeEach(async () => {
  await resetDb();
});

it("registers, hashes the password, returns a token", async () => {
  // 1. Send registration payload
  const res = await request(app)
    .post("/api/auth/register")
    .send({ 
      email: "a@test.io", 
      password: "pw12345", 
      name: "A" 
    });

  // 2. Validate response status and payload structure
  expect(res.status).toBe(201);
  expect(res.body.token).toEqual(expect.any(String));

  // 3. Query the database directly to verify persistence and safety
  const user = await prisma.user.findUnique({ 
    where: { email: "a@test.io" } 
  });
  
  // Verify user records exist
  expect(user).not.toBeNull();
  
  // Assert password string was hashed and is not stored in plain-text
  expect(user.password).not.toBe("pw12345");                          
  
  // Assert the stored hash is mathematically valid against the raw password
  const isPasswordValid = await bcrypt.compare("pw12345", user.password);
  expect(isPasswordValid).toBe(true);  
});
