const { ZodError } = require("zod");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { AppError } = require("../lib/errors");

function errorHandler(err, req, res, next) {
  // 1. Handle Zod validation errors
  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ message: "Invalid input", issues: err.issues });
  }

  // 2. Handle Multer file upload errors
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  // 3. Handle JWT authentication errors
  if (
    err instanceof jwt.JsonWebTokenError ||
    err instanceof jwt.TokenExpiredError
  ) {
    return res.status(401).json({ message: "Invalid token" });
  }

  // 4. Handle invalid JSON payloads
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }

  // 5. FIXED: Handle Custom App Errors (NotFoundError, ValidationError)
  if (err instanceof AppError || err.name === "NotFoundError" || err.name === "ValidationError") {
    // Fallback to 404 for NotFound and 400 for Validation if status isn't explicitly set
    const statusCode = err.status || (err.name === "NotFoundError" ? 404 : 400);
    return res.status(statusCode).json({
      message: err.message,
    });
  }

  // Backup fallback in case the error object uses an explicit status property
  if (err.status) {
    return res.status(err.status).json({
      message: err.message,
    });
  }

    // 6. Log and handle unexpected runtime/system errors safely
  try {
    if (req.log && typeof req.log.error === 'function') {
      // Pass the message and extract the stack cleanly to prevent circular reference lockouts
      req.log.error({ 
        message: err.message, 
        stack: err.stack,
        name: err.name 
      }, "Unhandled operational system crash captured");
    } else {
      console.error("System Log Intercept - Captured Error:", err);
    }
  } catch (loggerCrashException) {
    // Ultimate fallback if the logger engine crashes
    console.error("Logger failed to serialize original error statement:", err);
    console.error("Logger crash exception details:", loggerCrashException);
  }

  return res.status(500).json({ message: "Internal server error" });
}

module.exports = errorHandler;

