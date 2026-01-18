const express = require("express");
const router = express.Router();
const catchAsync = require("../middleware/asyncHandler");
const {
  startCheckIn,
  verifyGPS,
  verifyBLE,
  verifyBiometric,
  getLiveAttendance,
  manualMark,
  getStudentAttendance,
  getAttendanceHistory,
  unifiedVerification,
  resolveRedFlag,
  verifyWithRealFace,
  markAttendanceQueued, // ✅ ADDED: Queue-based attendance
} = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/auth");
const { logAttestation } = require("../middleware/attestation");

// ============================================
// STUDENT ROUTES - Sequential Verification Flow
// All routes wrapped with catchAsync for error safety
// ============================================

router.post(
  "/start-checkin",
  protect,
  authorize("student"),
  catchAsync(startCheckIn)
);

router.post(
  "/verify-gps",
  protect,
  authorize("student"),
  catchAsync(verifyGPS)
);

router.post(
  "/verify-ble",
  protect,
  authorize("student"),
  catchAsync(verifyBLE)
);

router.post(
  "/verify-biometric",
  protect,
  authorize("student"),
  catchAsync(verifyBiometric)
);

// Unified Verification (with Sensor Fusion)
router.post(
  "/verify-unified",
  protect,
  authorize("student"),
  logAttestation,
  catchAsync(unifiedVerification)
);

// Real Face + GPS Verification
router.post(
  "/verify-real-face",
  protect,
  authorize("student"),
  catchAsync(verifyWithRealFace)
);

// ✅ NEW: Queue-based attendance (instant response, background processing)
router.post(
  "/mark-queued",
  protect,
  authorize("student"),
  catchAsync(markAttendanceQueued)
);

// ============================================
// TEACHER ROUTES - Live Monitoring
// ============================================

router.get(
  "/live/:sessionId",
  protect,
  authorize("teacher"),
  catchAsync(getLiveAttendance)
);

router.post(
  "/manual-mark",
  protect,
  authorize("teacher"),
  catchAsync(manualMark)
);

// Red Flag Resolution
router.post(
  "/resolve-red-flag",
  protect,
  authorize("teacher"),
  catchAsync(resolveRedFlag)
);

// ============================================
// COMMON ROUTES
// ============================================

router.get(
  "/history",
  protect,
  authorize("student"),
  catchAsync(getAttendanceHistory)
);

router.get("/student/:studentId", protect, catchAsync(getStudentAttendance));

module.exports = router;
