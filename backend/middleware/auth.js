/**
 * Authentication Middleware
 *
 * Provides route protection and role-based access control:
 * - JWT token verification
 * - Role-based authorization
 * - Rate limiting support
 * - Request context enrichment
 *
 * @version 2.0.0
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ============================================
// CONFIGURATION
// ============================================

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_HEADER = "authorization";
const TOKEN_PREFIX = "Bearer";

// Admin user ID for environment-based admin auth
const ADMIN_ID = "admin";

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract JWT token from request
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null
 */
const extractToken = (req) => {
  // Check Authorization header
  const authHeader = req.headers[TOKEN_HEADER];
  if (authHeader && authHeader.startsWith(TOKEN_PREFIX)) {
    return authHeader.split(" ")[1];
  }

  // Check query parameter (for SSE/WebSocket fallback)
  if (req.query && req.query.token) {
    return req.query.token;
  }

  // Check cookies (if using cookie-based auth)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
};

/**
 * Verify JWT token and decode payload
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
const verifyToken = (token) => {
  if (!JWT_SECRET) {
    console.error("JWT_SECRET not configured!");
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return { error: "Token has expired" };
    }
    if (error.name === "JsonWebTokenError") {
      return { error: "Invalid token" };
    }
    console.error("Token verification error:", error.message);
    return null;
  }
};

/**
 * Fetch user from database by ID
 * @param {string} userId - User ID
 * @returns {Object|null} User document or null
 */
const fetchUser = async (userId) => {
  try {
    // Handle admin user (from environment)
    if (userId === ADMIN_ID) {
      return {
        _id: ADMIN_ID,
        id: ADMIN_ID,
        role: "admin",
        name: "Administrator",
        username: process.env.ADMIN_USERNAME,
        isActive: true,
      };
    }

    const user = await User.findById(userId)
      .select("-password -faceDescriptor -fingerprintData")
      .lean();

    if (!user) {
      return null;
    }

    // Check if user is active
    if (!user.isActive) {
      return { error: "Account is deactivated" };
    }

    return user;
  } catch (error) {
    console.error("User fetch error:", error.message);
    return null;
  }
};

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Protect routes - JWT authentication
 * Verifies token and attaches user to request
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const protect = async (req, res, next) => {
  try {
    // Extract token
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        status: "error",
        message: "Access denied. No authentication token provided.",
        code: "NO_TOKEN",
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        status: "error",
        message: "Invalid authentication token.",
        code: "INVALID_TOKEN",
      });
    }

    if (decoded.error) {
      return res.status(401).json({
        success: false,
        status: "error",
        message: decoded.error,
        code:
          decoded.error === "Token has expired"
            ? "TOKEN_EXPIRED"
            : "TOKEN_INVALID",
      });
    }

    // Fetch user
    const user = await fetchUser(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        status: "error",
        message: "User not found or no longer exists.",
        code: "USER_NOT_FOUND",
      });
    }

    if (user.error) {
      return res.status(401).json({
        success: false,
        status: "error",
        message: user.error,
        code: "USER_INACTIVE",
      });
    }

    // Attach user and token info to request
    req.user = user;
    req.token = token;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      status: "error",
      message: "Authentication failed due to server error.",
      code: "AUTH_ERROR",
    });
  }
};

/**
 * Optional authentication
 * Attaches user if token present, continues without error if not
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);

    if (decoded && !decoded.error) {
      const user = await fetchUser(decoded.id);
      if (user && !user.error) {
        req.user = user;
        req.token = token;
        req.tokenPayload = decoded;
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth, just continue
    next();
  }
};

/**
 * Authorize specific roles
 * Must be used after protect middleware
 *
 * @param {...string} roles - Allowed roles
 * @returns {Function} Middleware function
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        status: "error",
        message: "Authentication required before authorization.",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Flatten roles array (in case of nested arrays)
    const allowedRoles = roles.flat();

    // Check if user's role is allowed
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        status: "error",
        message: `Access denied. This action requires one of the following roles: ${allowedRoles.join(
          ", "
        )}.`,
        code: "FORBIDDEN",
        requiredRoles: allowedRoles,
        currentRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Check if user is the resource owner or has admin role
 * Useful for routes where users can only modify their own data
 *
 * @param {string} paramName - Request parameter containing user ID
 * @returns {Function} Middleware function
 */
const authorizeOwnerOrAdmin = (paramName = "id") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        status: "error",
        message: "Authentication required.",
        code: "NOT_AUTHENTICATED",
      });
    }

    const resourceUserId = req.params[paramName];
    const currentUserId = req.user._id?.toString() || req.user.id;

    // Allow admin or owner
    if (req.user.role === "admin" || currentUserId === resourceUserId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      status: "error",
      message: "You can only access your own resources.",
      code: "FORBIDDEN",
    });
  };
};

/**
 * Check if user is teacher or admin
 * Shorthand for authorize("teacher", "admin")
 */
const isTeacherOrAdmin = authorize("teacher", "admin");

/**
 * Check if user is admin
 * Shorthand for authorize("admin")
 */
const isAdmin = authorize("admin");

/**
 * Check if user is student
 * Shorthand for authorize("student")
 */
const isStudent = authorize("student");

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core middleware
  protect,
  authorize,
  optionalAuth,

  // Resource ownership
  authorizeOwnerOrAdmin,

  // Role shortcuts
  isTeacherOrAdmin,
  isAdmin,
  isStudent,

  // Helper functions (for testing)
  extractToken,
  verifyToken,
};
