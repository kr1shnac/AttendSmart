/**
 * Biometric Routes
 * API endpoints for face biometric enrollment and verification
 * (Fingerprint/WebAuthn removed to reduce complexity)
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  getEnrollmentStatus,
  enrollFaceDescriptor,
  verifyFaceDescriptor,
  getBiometricData,
  deleteBiometricData,
  enrollFace,
  verifyFace,
} = require("../controllers/biometricController");
const { protect } = require("../middleware/auth");
const {
  requireAttestationForEnrollment,
  logAttestation,
} = require("../middleware/attestation");
const {
  enrollmentLimiter,
  verificationLimiter,
} = require("../middleware/rateLimiter");

// Configure multer for image upload (legacy support)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// All routes require authentication
router.use(protect);

// =============================================
// FACE ENROLLMENT ROUTES (with rate limiting + attestation)
// =============================================

router.get("/enrollment-status", getEnrollmentStatus);

router.post(
  "/enroll-face",
  enrollmentLimiter,
  requireAttestationForEnrollment,
  enrollFaceDescriptor
);

// =============================================
// VERIFICATION ROUTES (with rate limiting)
// =============================================

router.post(
  "/verify-face",
  verificationLimiter,
  logAttestation,
  verifyFaceDescriptor
);

// =============================================
// LEGACY ROUTES (deprecated)
// =============================================

router.post("/face/enroll", upload.single("image"), enrollFace);
router.post("/face/verify", upload.single("image"), verifyFace);

// =============================================
// DATA MANAGEMENT
// =============================================

router.get("/data", getBiometricData);
router.delete("/data", deleteBiometricData);

module.exports = router;
