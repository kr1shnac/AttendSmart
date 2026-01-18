/**
 * Biometric Controller
 *
 * Handles face descriptor enrollment and verification for attendance.
 * Face detection is the primary biometric method (fingerprint removed to reduce complexity).
 */

const User = require("../models/User");
const {
  euclideanDistance,
  validateDescriptor,
  matchDescriptors,
} = require("../utils/biometricUtils");

/**
 * @desc    Get enrollment status for current user
 * @route   GET /api/biometric/enrollment-status
 * @access  Private
 */
const getEnrollmentStatus = async (req, res) => {
  console.log("\n>>> ENROLLMENT STATUS ENDPOINT HIT <<<");
  try {
    // Fetch the full faceDescriptor object to avoid projection issues
    const user = await User.findById(req.user.id).select(
      "role biometricEnrolled faceDescriptor fingerprintCredential firstLoginAt usn email"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Admins don't need enrollment
    if (user.role === "admin") {
      return res.json({
        success: true,
        data: {
          needsEnrollment: false,
          isAdmin: true,
          message: "Admins do not require biometric enrollment",
        },
      });
    }

    const enrollmentStatus = user.getEnrollmentStatus();

    // Enhanced debug logging
    console.log(
      `\n🔍 ENROLLMENT CHECK for ${user.usn || user.email || req.user.id}:`
    );
    console.log(`   biometricEnrolled: ${user.biometricEnrolled}`);
    console.log(`   faceDescriptor.enrolled: ${user.faceDescriptor?.enrolled}`);
    console.log(
      `   descriptor length: ${user.faceDescriptor?.descriptor?.length || 0}`
    );
    console.log(`   needsEnrollment: ${enrollmentStatus.needsEnrollment}`);
    console.log("");

    res.json({
      success: true,
      data: enrollmentStatus,
    });
  } catch (error) {
    console.error("Get enrollment status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Enroll face descriptor (128D array)
 * @route   POST /api/biometric/enroll-face
 * @access  Private
 */
const enrollFaceDescriptor = async (req, res) => {
  try {
    const { descriptor, quality, deviceInfo } = req.body;

    // Validate descriptor
    const validation = validateDescriptor(descriptor);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    // Quality check (minimum 70%)
    const qualityValue = parseFloat(quality);
    if (isNaN(qualityValue) || qualityValue < 0.7) {
      return res.status(400).json({
        success: false,
        message: "Face quality too low. Please try again in better lighting.",
        quality: qualityValue,
        required: 0.7,
      });
    }

    // SERVER-SIDE CONSENT ENFORCEMENT
    // Check if user has consent record before allowing enrollment
    const ConsentRecord = require("../models/ConsentRecord");
    const userId = req.user._id || req.user.id; // Support both _id and id
    const hasConsent = await ConsentRecord.hasConsent(
      userId,
      "biometric_enrollment"
    );

    if (!hasConsent) {
      console.warn(
        `⚠️ Enrollment blocked: No consent record for user ${userId}`
      );
      return res.status(403).json({
        success: false,
        message: "Consent required before biometric enrollment",
        code: "CONSENT_REQUIRED",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Log re-enrollment
    if (user.faceDescriptor?.enrolled) {
      console.log(
        `ℹ️ User ${user.usn || user.email} re-enrolling face descriptor`
      );
    }

    // Save face descriptor
    user.faceDescriptor = {
      enrolled: true,
      descriptor: descriptor,
      enrolledAt: new Date(),
      enrollmentDevice: deviceInfo || req.headers["user-agent"] || "Unknown",
      quality: qualityValue,
      lastVerifiedAt: null,
      verificationCount: 0,
    };

    // Update first login tracking
    if (!user.firstLoginAt) {
      user.firstLoginAt = new Date();
    }

    // Track enrollment attempts
    user.enrollmentAttempts = (user.enrollmentAttempts || 0) + 1;
    user.enrollmentIP = req.ip || req.connection?.remoteAddress;
    user.lastEnrollmentUpdate = new Date();

    // Check if enrollment is complete (face is required, fingerprint optional)
    if (user.faceDescriptor.enrolled) {
      user.biometricEnrolled = true;
      user.enrollmentCompletedAt = new Date();
    }

    await user.save();

    console.log(`✅ Face enrolled for user ${user.usn || user.email}`);

    res.json({
      success: true,
      message: "Face enrolled successfully",
      data: {
        faceEnrolled: true,
        fingerprintEnrolled: user.fingerprintCredential?.enrolled || false,
        allEnrolled: user.biometricEnrolled,
        quality: qualityValue,
      },
    });
  } catch (error) {
    console.error("Face enrollment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to enroll face",
      error: error.message,
    });
  }
};

// Note: Fingerprint/WebAuthn functions removed - Face detection is the primary biometric method

/**
 * @desc    Verify face descriptor during attendance
 * @route   POST /api/biometric/verify-face
 * @access  Private
 */
const verifyFaceDescriptor = async (req, res) => {
  try {
    const { descriptor } = req.body;

    // Validate input descriptor
    const validation = validateDescriptor(descriptor);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.faceDescriptor?.enrolled || !user.faceDescriptor?.descriptor) {
      return res.status(400).json({
        success: false,
        message: "Face not enrolled. Please enroll first.",
      });
    }

    // Compare descriptors using enhanced matching (0.55 threshold for consistency)
    const result = matchDescriptors(
      descriptor,
      user.faceDescriptor.descriptor,
      0.55 // Relaxed threshold for better matching (was 0.6)
    );

    // Update verification tracking
    if (result.match) {
      user.faceDescriptor.lastVerifiedAt = new Date();
      user.faceDescriptor.verificationCount =
        (user.faceDescriptor.verificationCount || 0) + 1;
      await user.save();
    }

    res.json({
      success: true,
      data: {
        verified: result.match,
        confidence: result.confidence,
        distance: result.distance,
        similarity: result.similarity,
        euclideanMatch: result.euclideanMatch,
        cosineMatch: result.cosineMatch,
        threshold: result.threshold,
        message: result.match
          ? "Face verified successfully"
          : "Face verification failed - does not match enrolled face",
      },
    });
  } catch (error) {
    console.error("Face verification error:", error);
    res.status(500).json({
      success: false,
      message: "Face verification failed",
      error: error.message,
    });
  }
};

/**
 * @desc    Get biometric data for user (legacy support)
 * @route   GET /api/biometric/data
 * @access  Private
 */
const getBiometricData = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID required",
      });
    }

    const user = await User.findById(userId).select(
      "biometricEnrolled faceDescriptor fingerprintCredential"
    );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "No biometric data found",
      });
    }

    res.json({
      status: "success",
      data: {
        userId: userId,
        faceEnrolled: user.faceDescriptor?.enrolled || false,
        faceQuality: user.faceDescriptor?.quality || null,
        faceEnrolledAt: user.faceDescriptor?.enrolledAt || null,
        fingerprintEnrolled: user.fingerprintCredential?.enrolled || false,
        fingerprintSkipped: user.fingerprintCredential?.skipped || false,
        enrollmentComplete: user.biometricEnrolled,
      },
    });
  } catch (error) {
    console.error("❌ Get biometric data error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch biometric data",
    });
  }
};

/**
 * @desc    Delete biometric data (admin or self)
 * @route   DELETE /api/biometric/data
 * @access  Private
 */
const deleteBiometricData = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Reset biometric data
    user.biometricEnrolled = false;
    user.faceDescriptor = {
      enrolled: false,
      descriptor: null,
      enrolledAt: null,
      enrollmentDevice: null,
      quality: null,
      lastVerifiedAt: null,
      verificationCount: 0,
    };
    user.fingerprintCredential = {
      enrolled: false,
      credentialId: null,
      publicKey: null,
      counter: 0,
      enrolledAt: null,
      enrollmentDevice: null,
      lastUsedAt: null,
      skipped: false,
    };
    user.enrollmentCompletedAt = null;

    await user.save();

    console.log(`🗑️ Biometric data deleted for user ${user.usn || user.email}`);

    res.json({
      status: "success",
      message: "Biometric data deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete biometric data error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete biometric data",
    });
  }
};

// Legacy stubs for face image-based enrollment (deprecated)
const enrollFace = async (req, res) => {
  return res.status(410).json({
    status: "error",
    message: "Image-based face enrollment is deprecated",
    note: "Use /api/biometric/enroll-face with 128D descriptor instead",
  });
};

const verifyFace = async (req, res) => {
  return res.status(410).json({
    status: "error",
    message: "Image-based face verification is deprecated",
    note: "Use /api/biometric/verify-face with 128D descriptor instead",
  });
};

module.exports = {
  // Face enrollment endpoints
  getEnrollmentStatus,
  enrollFaceDescriptor,
  verifyFaceDescriptor,

  // Data management
  getBiometricData,
  deleteBiometricData,

  // Legacy stubs (deprecated)
  enrollFace,
  verifyFace,
};
