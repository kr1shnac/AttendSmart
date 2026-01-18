/**
 * Global Error Handler Middleware
 * Catches all errors and sends appropriate JSON responses.
 * Prevents unhandled errors from crashing the server.
 *
 * Must be registered AFTER all routes in server.js:
 * app.use(errorHandler);
 */

const errorHandler = (err, req, res, next) => {
  // Log error details
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // Log full stack in development
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  // Already sent response, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    return res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({
      status: "error",
      message: `Duplicate value for ${field}. This record already exists.`,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      status: "error",
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      status: "error",
      message: "Invalid authentication token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      status: "error",
      message: "Token has expired. Please log in again.",
    });
  }

  // MongoDB connection errors
  if (err.name === "MongoNetworkError" || err.name === "MongoTimeoutError") {
    console.error("Database connection error:", err);
    return res.status(503).json({
      status: "error",
      message: "Database temporarily unavailable. Please try again.",
    });
  }

  // Default to 500 Internal Server Error
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    status: "error",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message || "Internal server error",
  });
};

module.exports = errorHandler;
