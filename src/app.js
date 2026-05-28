const express = require('express');
const authRouter = require("./routes/auth"); 
const questionsRouter = require("./routes/questions"); 
const leaderboardRouter = require("./routes/leaderboard"); 
const path = require("path");
const errorHandler = require('./middleware/errorHandler');
const { NotFoundError } = require('./lib/errors');
const pinoHttp = require("pino-http");
const logger = require("./lib/logger");

const app = express();

app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url.startsWith("/uploads") },
}));

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/leaderboard", leaderboardRouter); 

app.use((req, res, next) => {
  next(new NotFoundError("Page not found"));
});

app.use(errorHandler);

module.exports = app;
