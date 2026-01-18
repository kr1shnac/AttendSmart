/**
 * Async Handler / CatchAsync Utility
 *
 * Wraps async route handlers to automatically catch errors and forward them
 * to Express global error handler. Prevents unhandled promise rejections
 * from crashing the Node.js process.
 *
 * CRITICAL: All async controller functions MUST be wrapped with this utility.
 *
 * Usage in routes:
 *   const catchAsync = require('../middleware/asyncHandler');
 *   router.get('/route', catchAsync(controllerFunction));
 *
 * Or wrap entire controller object:
 *   const { wrapController } = require('../middleware/asyncHandler');
 *   const wrappedController = wrapController(require('../controllers/myController'));
 */

/**
 * Wraps a single async function to catch errors
 * @param {Function} fn - Async controller function
 * @returns {Function} - Express middleware function with error handling
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Log the error for debugging
      console.error(
        `[CatchAsync] Error in ${fn.name || "anonymous"}:`,
        error.message
      );

      // Forward to global error handler
      next(error);
    });
  };
};

/**
 * Wraps all functions in a controller object with catchAsync
 * Useful for applying error handling to entire controllers at once
 *
 * @param {Object} controller - Controller object with async functions
 * @returns {Object} - Controller with all functions wrapped
 *
 * Usage:
 *   const rawController = require('../controllers/userController');
 *   const userController = wrapController(rawController);
 *   router.get('/users', userController.getAll);
 */
const wrapController = (controller) => {
  const wrapped = {};

  for (const [key, value] of Object.entries(controller)) {
    if (typeof value === "function") {
      wrapped[key] = catchAsync(value);
    } else {
      wrapped[key] = value;
    }
  }

  return wrapped;
};

/**
 * Higher-order function that creates a safe async handler
 * with optional custom error handling
 *
 * @param {Function} fn - Async controller function
 * @param {Object} options - Configuration options
 * @returns {Function} - Express middleware
 */
const catchAsyncWithOptions = (fn, options = {}) => {
  const {
    logErrors = true,
    defaultStatus = 500,
    defaultMessage = "Internal server error",
  } = options;

  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (logErrors) {
        console.error(`[CatchAsync] ${req.method} ${req.path}:`, error.message);
        if (process.env.NODE_ENV !== "production") {
          console.error(error.stack);
        }
      }

      // Set status code if not already set
      if (!error.statusCode) {
        error.statusCode = defaultStatus;
      }
      if (!error.message) {
        error.message = defaultMessage;
      }

      next(error);
    }
  };
};

// Export both the default and named exports for flexibility
module.exports = catchAsync;
module.exports.catchAsync = catchAsync;
module.exports.wrapController = wrapController;
module.exports.catchAsyncWithOptions = catchAsyncWithOptions;
