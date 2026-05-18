const { resetDb, request, app } = require("./helpers");

beforeEach(async () => {
  await resetDb();
});

// A robust authentication utility that registers and logs in using distinct email profiles
async function registerAndLogin() {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `boundary-${seed}@test.io`;
  const password = "pw12345";
  const name = "Boundary Tester";

  await request(app)
    .post("/api/auth/register")
    .send({ email, password, name });

  // 2. Obtain clean JWT token string signatures directly through the network path
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return loginRes.body.token || loginRes.body.data?.token;
}

it("clamps limit above 100 to 100", async () => {
  const token = await registerAndLogin();
  expect(token).toBeDefined();

  const res = await request(app)
    .get("/api/questions?limit=999")
    .set("Authorization", `Bearer ${token}`);
    
  expect(res.status).toBe(200);
  expect(res.body.limit).toBe(100);
});

it("treats page=0 and page=-1 as page=1", async () => {
  const token = await registerAndLogin();
  expect(token).toBeDefined();

  const a = await request(app)
    .get("/api/questions?page=0")
    .set("Authorization", `Bearer ${token}`);
    
  const b = await request(app)
    .get("/api/questions?page=-1")
    .set("Authorization", `Bearer ${token}`);
    
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(a.body.page).toBe(1); 
  expect(b.body.page).toBe(1);
});
