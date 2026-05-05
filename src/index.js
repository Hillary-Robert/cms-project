const express = require('express');
const authRouter = require("./routes/auth");
const app = express();
const questionsRouter = require("./routes/questions")
const path = require("path")
const prisma = require("./lib/prisma");
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..", "public")))

// Middleware to parse JSON bodies (will be useful in later steps)
app.use(express.json());
app.use("/api/auth", authRouter)
app.use("/api/questions", questionsRouter)

app.use((req, res)=>{
  res.status(404).json({msg: "Page not found"})
})

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});


