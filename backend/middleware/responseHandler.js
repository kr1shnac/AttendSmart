/**
 * Response Handler Middleware
 * Standardizes all API responses across the application
 *
 * Expected Response Format:
 * {
 *   success: boolean,
 *   status: 'success' | 'error',
 *   message: string,
 *   data: any (optional),
 *   error: string (optional, on error responses),
 *   timestamp: ISO datetime string
 * }
 */

/**
 * Sends standardized success response
 * @param {Object} res - Express response object
 * @param {any} data - Response data payload
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default 200)
 */
const sendSuccess = (
  res,
  data = null,
  message = "Operation successful",
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    status: "success",
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Sends standardized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {string} error - Error code or type
 * @param {number} statusCode - HTTP status code (default 400)
 */
const sendError = (
  res,
  message = "Operation failed",
  error = "INTERNAL_ERROR",
  statusCode = 400
) => {
  return res.status(statusCode).json({
    success: false,
    status: "error",
    message,
    error,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Express middleware - Attaches standardized response methods to res object
 * Allows controllers to use: res.sendSuccess() or res.sendError()
 */
const responseHandlerMiddleware = (req, res, next) => {
  // Attach success method to response
  res.sendSuccess = (
    data = null,
    message = "Operation successful",
    statusCode = 200
  ) => {
    return sendSuccess(res, data, message, statusCode);
  };

  // Attach error method to response
  res.sendError = (
    message = "Operation failed",
    error = "INTERNAL_ERROR",
    statusCode = 400
  ) => {
    return sendError(res, message, error, statusCode);
  };

  next();
};

/**
 * Error handling middleware - Catches all errors and formats consistently
 * Place this AFTER all route handlers
 */
const errorHandler = (err, req, res, next) => {
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errorCode = err.errorCode || "INTERNAL_ERROR";

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  if (err.name === "CastError") {
    statusCode = 400;
    errorCode = "INVALID_ID";
    message = "Invalid ID format";
  }

  if (err.name === "MongoError" && err.code === 11000) {
    statusCode = 409;
    errorCode = "DUPLICATE_ENTRY";
    message = `Duplicate field: ${Object.keys(err.keyPattern)[0]}`;
  }

  if (err.name === "UnauthorizedError") {
    statusCode = 401;
    errorCode = "UNAUTHORIZED";
    message = "Unauthorized access";
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    errorCode = "INVALID_TOKEN";
    message = "Invalid or malformed token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    errorCode = "TOKEN_EXPIRED";
    message = "Token has expired";
  }

  return res.status(statusCode).json({
    success: false,
    status: "error",
    message,
    error: errorCode,
    ...(process.env.NODE_ENV === "development" && { details: err.message }),
    timestamp: new Date().toISOString(),
  });
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    status: "error",
    message: `Route ${req.originalUrl} not found`,
    error: "NOT_FOUND",
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  sendSuccess,
  sendError,
  responseHandlerMiddleware,
  errorHandler,
  notFoundHandler,
};
