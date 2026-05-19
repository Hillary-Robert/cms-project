const app = require("./app");
const logger = require("./lib/logger");
const PORT = process.env.PORT || 3000;
const prisma = require("./lib/prisma");

// Start the server utilizing the loaded configurations
app.listen(PORT, () => {
  logger.info({ port: PORT }, `Server is running on http://localhost:${PORT}`);
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
