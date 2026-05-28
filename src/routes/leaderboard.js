const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");

router.use(authenticate);

//IMPROVEMENT 3: GET /api/leaderboard (Returns top 5 users based on successful quiz attempts)
router.get("/", async (req, res, next) => {
  try {
    const topAttempts = await prisma.attempt.groupBy({
      by: ["userId"],
      where: { isCorrect: true },
      _count: { id: true },
      orderBy: {
        _count: { id: "desc" },
      },
      take: 5,
    });

    const leaderboard = await Promise.all(
      topAttempts.map(async (item) => {
        const user = await prisma.user.findUnique({
          where: { id: item.userId },
          select: { id: true, name: true, email: true },
        });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          successfulAttemptsCount: item._count.id,
        };
      })
    );

    res.status(200).json(leaderboard);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
