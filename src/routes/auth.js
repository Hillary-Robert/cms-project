const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const SECRET = process.env.JWT_SECRET;

console.log("JWT_SECRET:", process.env.JWT_SECRET);

// Post/api/auth/register
router.post("/register", async(req, res)=>{
  const {email, password, name} = req.body

  if(!email || !password || !name){
    return res.status(400).json({ error: "email, password and name are required" });
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email },});

  if (existingUser) {
    return res.status(409).json({ error: "Email already registered" });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create the user
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
  });

  // Generate a token
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "1h" });

  res.status(201).json({
    message: "User registered successfully",
    token,
  });

})


// Post/api/auth/login

router.post("/login", async (req, res) => {
  console.log("Incoming body:", req.body);
  const { email, password } = req.body;

  

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  console.log("User found:", user);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Verify the password
  const isValid = await bcrypt.compare(password, user.password);
  console.log("Password valid:", isValid);

  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Generate a token
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "1h" });

  res.json({ token });
});


module.exports = router


