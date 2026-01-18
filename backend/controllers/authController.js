/**
 * Authentication Controller
 *
 * Handles all authentication-related operations:
 * - Student login (USN + DOB)
 * - Teacher login (Email + Password)
 * - Admin login (Environment credentials or DB)
 *
 * Security features:
 * - Rate limiting applied via middleware
 * - Password hashing with bcrypt
 * - JWT token generation
 * - Login attempt tracking
 * - Comprehensive logging
 *
 * @version 2.0.0
 */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Log = require("../models/Log");
const {
  euclideanDistance,
  cosineSimilarity,
  normalizeDescriptor,
  combinedConfidence,
} = require("../utils/biometricUtils");

// ============================================
// CONFIGURATION
// ============================================

const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5;
const LOCKOUT_DURATION =
  parseInt(process.env.LOCKOUT_DURATION, 10) || 15 * 60 * 1000; // 15 minutes

// Admin credentials from environment
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate JWT token with user payload
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }

  return jwt.sign(
    {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

/**
 * Sanitize user object for response (remove sensitive data)
 * @param {Object} user - User document
 * @returns {Object} Sanitized user object
 */
const sanitizeUser = (user) => {
  if (!user) return null;

  const userObj = user.toObject ? user.toObject() : { ...user };

  // Remove sensitive fields
  delete userObj.password;
  delete userObj.loginAttempts;
  delete userObj.lockUntil;
  delete userObj.faceDescriptor;
  delete userObj.fingerprintData;
  delete userObj.__v;

  return userObj;
};

/**
 * Get device type from user agent
 * @param {string} userAgent - User agent string
 * @returns {string} Device type
 */
const getDeviceType = (userAgent) => {
  if (!userAgent) return "unknown";

  const ua = userAgent.toLowerCase();
  if (
    ua.includes("mobile") ||
    ua.includes("android") ||
    ua.includes("iphone")
  ) {
    return "mobile";
  }
  if (ua.includes("tablet") || ua.includes("ipad")) {
    return "tablet";
  }
  return "desktop";
};

/**
 * Get client IP address
 * @param {Object} req - Express request object
 * @returns {string} Client IP
 */
const getClientIP = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown"
  );
};

/**
 * Log authentication event
 * @param {Object} options - Log options
 */
const logAuthEvent = async ({
  userId = null,
  userRole,
  action,
  description,
  severity,
  req,
  additionalData = {},
}) => {
  try {
    await Log.create({
      userId,
      userRole,
      action,
      eventDescription: description,
      severity,
      ipAddress: getClientIP(req),
      deviceType: getDeviceType(req.headers["user-agent"]),
      userAgent: req.headers["user-agent"]?.substring(0, 500),
      ...additionalData,
    });
  } catch (error) {
    console.error("Failed to create auth log:", error.message);
    // Don't throw - logging failure shouldn't break auth
  }
};

/**
 * Check if user account is locked
 * @param {Object} user - User document
 * @returns {boolean} Whether account is locked
 */
const isAccountLocked = (user) => {
  if (!user.lockUntil) return false;
  return user.lockUntil > Date.now();
};

/**
 * Increment login attempts and lock if threshold reached
 * @param {Object} user - User document
 */
const incrementLoginAttempts = async (user) => {
  const updates = {
    $inc: { loginAttempts: 1 },
  };

  if (user.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
    updates.$set = { lockUntil: Date.now() + LOCKOUT_DURATION };
  }

  await User.findByIdAndUpdate(user._id, updates);
};

/**
 * Reset login attempts on successful login
 * @param {Object} user - User document
 */
const resetLoginAttempts = async (user) => {
  if (user.loginAttempts > 0 || user.lockUntil) {
    await User.findByIdAndUpdate(user._id, {
      $set: { loginAttempts: 0 },
      $unset: { lockUntil: 1 },
    });
  }
};

// ============================================
// CONTROLLERS
// ============================================

/**
 * Main login handler
 * Supports: Student (USN+DOB), Teacher (Email+Password), Admin
 *
 * @route POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { role } = req.body;

    // Validate role
    if (!role || !["student", "teacher"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid role (student or teacher).",
      });
    }

    // Handle student login
    if (role === "student") {
      return await handleStudentLogin(req, res, startTime);
    }

    // Handle teacher/admin login
    return await handleTeacherLogin(req, res, startTime);
  } catch (error) {
    console.error("Login error:", error);

    // Log error
    await logAuthEvent({
      userRole: req.body.role || "unknown",
      action: "login_error",
      description: `Login error: ${error.message}`,
      severity: "error",
      req,
    });

    next(error);
  }
};

/**
 * Handle student login with USN and DOB
 * @private
 */
const handleStudentLogin = async (req, res, startTime) => {
  const { usn, dob } = req.body;

  // Validate required fields
  if (!usn || !dob) {
    return res.status(400).json({
      success: false,
      message: "USN and Date of Birth are required.",
    });
  }

  // Normalize USN
  const normalizedUsn = usn.trim().toUpperCase();

  // Find student
  const user = await User.findOne({
    usn: normalizedUsn,
    role: "student",
  }).select("+loginAttempts +lockUntil");

  if (!user) {
    // Log failed attempt (user not found)
    await logAuthEvent({
      userRole: "student",
      action: "login_failed",
      description: `Student login failed: USN not found (${normalizedUsn})`,
      severity: "warning",
      req,
    });

    // Use generic message to prevent enumeration
    return res.status(401).json({
      success: false,
      message: "Invalid credentials. Please check your USN and date of birth.",
    });
  }

  // Check if account is active
  if (!user.isActive) {
    await logAuthEvent({
      userId: user._id,
      userRole: "student",
      action: "login_failed",
      description: "Student login failed: Account deactivated",
      severity: "warning",
      req,
    });

    return res.status(401).json({
      success: false,
      message:
        "Your account has been deactivated. Please contact your teacher.",
    });
  }

  // Check if account is locked
  if (isAccountLocked(user)) {
    const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);

    await logAuthEvent({
      userId: user._id,
      userRole: "student",
      action: "login_blocked",
      description: "Student login blocked: Account locked",
      severity: "warning",
      req,
    });

    return res.status(423).json({
      success: false,
      message: `Too many failed attempts. Please try again in ${remainingTime} minutes.`,
    });
  }

  // Verify date of birth
  // Frontend sends DD-MM-YYYY format, convert to Date object
  let inputDob;
  if (dob.includes("-")) {
    const parts = dob.split("-");
    if (parts[0].length === 4) {
      // YYYY-MM-DD format
      inputDob = new Date(dob);
    } else {
      // DD-MM-YYYY format
      const [day, month, year] = parts;
      inputDob = new Date(`${year}-${month}-${day}`);
    }
  } else {
    inputDob = new Date(dob);
  }

  const storedDob = new Date(user.dateOfBirth);

  // Debug logging
  console.log("🔍 DOB Debug:", {
    input: dob,
    inputDob: inputDob.toISOString(),
    storedDob: storedDob.toISOString(),
    inputDate: inputDob.getDate(),
    storedDate: storedDob.getDate(),
  });

  const dobMatch =
    inputDob.getFullYear() === storedDob.getFullYear() &&
    inputDob.getMonth() === storedDob.getMonth() &&
    inputDob.getDate() === storedDob.getDate();

  if (!dobMatch) {
    await incrementLoginAttempts(user);

    await logAuthEvent({
      userId: user._id,
      userRole: "student",
      action: "login_failed",
      description: "Student login failed: DOB mismatch",
      severity: "warning",
      req,
    });

    return res.status(401).json({
      success: false,
      message: "Invalid credentials. Please check your USN and date of birth.",
    });
  }

  // Successful login
  await resetLoginAttempts(user);

  const token = generateToken({
    id: user._id,
    role: user.role,
    usn: user.usn,
  });

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  await logAuthEvent({
    userId: user._id,
    userRole: "student",
    action: "login_success",
    description: `Student logged in successfully (${normalizedUsn})`,
    severity: "success",
    req,
    additionalData: {
      responseTime: Date.now() - startTime,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: sanitizeUser(user),
  });
};

/**
 * Handle teacher/admin login with email and password
 * @private
 */
const handleTeacherLogin = async (req, res, startTime) => {
  const { username, password } = req.body;

  // Validate required fields
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  const normalizedUsername = username.trim().toLowerCase();

  // Check for admin login first (from environment variables)
  if (ADMIN_USERNAME && ADMIN_PASSWORD_HASH && username === ADMIN_USERNAME) {
    const isValidPassword = bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);

    if (isValidPassword) {
      const token = generateToken({
        id: "admin",
        role: "admin",
        username: ADMIN_USERNAME,
      });

      await logAuthEvent({
        userRole: "admin",
        action: "login_success",
        description: "Admin logged in via environment credentials",
        severity: "success",
        req,
        additionalData: {
          responseTime: Date.now() - startTime,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Admin login successful",
        token,
        user: {
          id: "admin",
          name: "Administrator",
          role: "admin",
          username: ADMIN_USERNAME,
        },
      });
    }
  }

  // Find user in database (teacher or admin)
  const user = await User.findOne({
    $or: [{ email: normalizedUsername }, { username: normalizedUsername }],
    role: { $in: ["teacher", "admin"] },
  }).select("+password +loginAttempts +lockUntil");

  if (!user) {
    await logAuthEvent({
      userRole: "teacher",
      action: "login_failed",
      description: `Teacher login failed: User not found (${normalizedUsername})`,
      severity: "warning",
      req,
    });

    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  // Check if account is active
  if (!user.isActive) {
    await logAuthEvent({
      userId: user._id,
      userRole: user.role,
      action: "login_failed",
      description: `${user.role} login failed: Account deactivated`,
      severity: "warning",
      req,
    });

    return res.status(401).json({
      success: false,
      message:
        "Your account has been deactivated. Please contact the administrator.",
    });
  }

  // Check if account is locked
  if (isAccountLocked(user)) {
    const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);

    await logAuthEvent({
      userId: user._id,
      userRole: user.role,
      action: "login_blocked",
      description: `${user.role} login blocked: Account locked`,
      severity: "warning",
      req,
    });

    return res.status(423).json({
      success: false,
      message: `Too many failed attempts. Please try again in ${remainingTime} minutes.`,
    });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    await incrementLoginAttempts(user);

    await logAuthEvent({
      userId: user._id,
      userRole: user.role,
      action: "login_failed",
      description: `${user.role} login failed: Invalid password`,
      severity: "warning",
      req,
    });

    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  // Successful login
  await resetLoginAttempts(user);

  const token = generateToken({
    id: user._id,
    role: user.role,
    email: user.email,
  });

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  const roleCapitalized =
    user.role.charAt(0).toUpperCase() + user.role.slice(1);

  await logAuthEvent({
    userId: user._id,
    userRole: user.role,
    action: "login_success",
    description: `${roleCapitalized} logged in successfully`,
    severity: "success",
    req,
    additionalData: {
      responseTime: Date.now() - startTime,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: sanitizeUser(user),
  });
};

/**
 * Logout handler
 * Clears session and logs the event
 *
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const userRole = req.user?.role || "unknown";

    await logAuthEvent({
      userId,
      userRole,
      action: "logout",
      description: `${userRole} logged out`,
      severity: "info",
      req,
    });

    // Clear session if using sessions
    if (req.session) {
      req.session.destroy();
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
};

/**
 * Token verification handler
 * Validates JWT token and returns user data
 *
 * @route GET /api/auth/verify
 */
exports.verifyToken = async (req, res, next) => {
  try {
    // User is already verified by auth middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Token is valid",
      user: sanitizeUser(req.user),
    });
  } catch (error) {
    console.error("Token verification error:", error);
    next(error);
  }
};

/**
 * Get current user profile
 *
 * @route GET /api/auth/profile
 */
exports.getProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findById(req.user._id || req.user.id).select(
      "-password -faceDescriptor -fingerprintData"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: { user: sanitizeUser(user) },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    next(error);
  }
};

/**
 * Face-based login for students
 * Searches all enrolled students and matches face descriptor
 *
 * @route POST /api/auth/face-login
 */
exports.faceLogin = async (req, res) => {
  const startTime = Date.now();

  try {
    const { descriptor } = req.body;

    // Validate descriptor
    if (
      !descriptor ||
      !Array.isArray(descriptor) ||
      descriptor.length !== 128
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid face descriptor. Must be a 128-dimension array.",
      });
    }

    // Validate all values are numbers
    if (!descriptor.every((val) => typeof val === "number" && !isNaN(val))) {
      return res.status(400).json({
        success: false,
        message: "Face descriptor contains invalid values.",
      });
    }

    console.log("[FaceLogin] Searching for matching face...");

    // Get all enrolled students with face descriptors
    const enrolledStudents = await User.find({
      role: "student",
      "faceDescriptor.enrolled": true,
      isActive: true,
    }).select(
      "_id usn name email faceDescriptor.descriptor faceDescriptor.quality"
    );

    if (enrolledStudents.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No enrolled students found. Please register first.",
      });
    }

    console.log(
      `[FaceLogin] Comparing against ${enrolledStudents.length} enrolled students...`
    );

    // Find the best match using COMBINED Euclidean + Cosine scoring
    let bestMatch = null;
    let bestScore = -Infinity;
    let bestDistance = Infinity;
    let bestSimilarity = 0;
    const FACE_LOGIN_THRESHOLD = 0.55; // Slightly relaxed for better accuracy
    const COSINE_THRESHOLD = 0.85; // Minimum cosine similarity for match

    for (const student of enrolledStudents) {
      if (
        !student.faceDescriptor?.descriptor ||
        student.faceDescriptor.descriptor.length !== 128
      ) {
        continue;
      }

      const enrolledDescriptor = student.faceDescriptor.descriptor;

      // Calculate both metrics
      const distance = euclideanDistance(descriptor, enrolledDescriptor);
      const similarity = cosineSimilarity(descriptor, enrolledDescriptor);

      // Combined score: favor both low distance AND high similarity
      // Score = similarity * 100 - distance * 50 (weighted combination)
      const score = similarity * 100 - distance * 50;

      if (score > bestScore) {
        bestScore = score;
        bestDistance = distance;
        bestSimilarity = similarity;
        bestMatch = student;
      }
    }

    // Check if match is good enough (EITHER metric can pass)
    const euclideanMatch = bestDistance < FACE_LOGIN_THRESHOLD;
    const cosineMatch = bestSimilarity > COSINE_THRESHOLD;
    const isMatch = euclideanMatch || cosineMatch;

    console.log(
      `[FaceLogin] Best: distance=${bestDistance.toFixed(
        3
      )}, similarity=${bestSimilarity.toFixed(3)}, ` +
        `euclideanMatch=${euclideanMatch}, cosineMatch=${cosineMatch}`
    );

    if (!bestMatch || !isMatch) {
      await logAuthEvent({
        userRole: "student",
        action: "face_login_failed",
        description: `Face login failed: No match (dist=${bestDistance.toFixed(
          3
        )}, sim=${bestSimilarity.toFixed(3)})`,
        severity: "warning",
        req,
      });

      return res.status(401).json({
        success: false,
        message: "Face not recognized. Please try again or use manual login.",
        hint: "Ensure good lighting and face the camera directly.",
      });
    }

    // Calculate confidence using combined metrics
    const confidence = combinedConfidence(
      bestDistance,
      bestSimilarity,
      FACE_LOGIN_THRESHOLD
    );

    console.log(
      `[FaceLogin] Match found: ${
        bestMatch.usn
      } (distance: ${bestDistance.toFixed(3)}, confidence: ${confidence}%)`
    );

    // Generate token
    const token = generateToken({
      id: bestMatch._id,
      role: "student",
      usn: bestMatch.usn,
    });

    // Update last login
    await User.findByIdAndUpdate(bestMatch._id, {
      lastLogin: new Date(),
    });

    // Log successful login
    await logAuthEvent({
      userId: bestMatch._id,
      userRole: "student",
      action: "face_login_success",
      description: `Student logged in via face recognition (${bestMatch.usn}, confidence: ${confidence}%)`,
      severity: "success",
      req,
      additionalData: {
        responseTime: Date.now() - startTime,
        confidence,
        distance: bestDistance,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Face recognized! Login successful.",
      token,
      user: {
        id: bestMatch._id,
        name: bestMatch.name,
        usn: bestMatch.usn,
        email: bestMatch.email,
        role: "student",
      },
      verification: {
        confidence,
        distance: parseFloat(bestDistance.toFixed(4)),
        threshold: FACE_LOGIN_THRESHOLD,
      },
    });
  } catch (error) {
    console.error("[FaceLogin] Error:", error);

    await logAuthEvent({
      userRole: "student",
      action: "face_login_error",
      description: `Face login error: ${error.message}`,
      severity: "error",
      req,
    });

    return res.status(500).json({
      success: false,
      message: "Face login failed. Please try again.",
      error: error.message,
    });
  }
};
