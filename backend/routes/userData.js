/**
 * User Data Management Routes
 * GDPR/POPI compliant data export and deletion endpoints
 */

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const User = require("../models/User");
const BiometricData = require("../models/BiometricData");
const Attendance = require("../models/Attendance");
const ConsentRecord = require("../models/ConsentRecord");
const DecryptAudit = require("../models/DecryptAudit");
const Log = require("../models/Log");

// All routes require authentication
router.use(protect);

/**
 * GET /api/users/me/data
 * Export all user data (GDPR Data Subject Access Request)
 */
router.get("/me/data", async (req, res) => {
  try {
    const userId = req.user._id;

    // Collect all user data
    const [user, biometricData, attendance, consents, auditLogs] =
      await Promise.all([
        User.findById(userId)
          .select("-password -faceDescriptor.descriptor")
          .lean(),
        BiometricData.findOne({ user: userId })
          .select("-faceData.descriptors")
          .lean(),
        Attendance.find({ student: userId })
          .populate("session", "name startTime")
          .populate("class", "name")
          .select("-verificationData.biometric.faceImageUrl")
          .lean(),
        ConsentRecord.find({ userId }).lean(),
        DecryptAudit.find({ targetUserId: userId }).select("-ipAddress").lean(),
      ]);

    // Build export package
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      user: {
        profile: user,
        biometricEnrollment: biometricData
          ? {
              faceEnrolled: biometricData.faceData?.enrolled || false,
              fingerprintEnrolled:
                biometricData.fingerprintData?.enrolled || false,
              enrolledAt: biometricData.createdAt,
            }
          : null,
      },
      attendance: attendance.map((a) => ({
        session: a.session?.name,
        class: a.class?.name,
        date: a.session?.startTime,
        status: a.status,
        checkInTime: a.checkInTime,
        verificationScore: a.verificationScore,
      })),
      consents: consents.map((c) => ({
        type: c.consentType,
        consentedAt: c.consentedAt,
        active: c.active,
        revokedAt: c.revokedAt,
      })),
      dataAccessLog: auditLogs.map((a) => ({
        operation: a.operation,
        reason: a.reason,
        timestamp: a.createdAt,
      })),
    };

    // Log the export
    await Log.create({
      action: "data_export",
      user: userId,
      details: { exportVersion: "1.0" },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: "success",
      data: exportData,
    });
  } catch (error) {
    console.error("Data export error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to export data",
    });
  }
});

/**
 * DELETE /api/users/me
 * Delete user account and all associated data (Right to Erasure)
 */
router.delete("/me", async (req, res) => {
  try {
    const userId = req.user._id;
    const { confirmDelete } = req.body;

    if (confirmDelete !== "DELETE_MY_ACCOUNT") {
      return res.status(400).json({
        status: "error",
        message:
          'Please confirm deletion by sending confirmDelete: "DELETE_MY_ACCOUNT"',
      });
    }

    // Log the deletion request before deleting
    await Log.create({
      action: "account_deletion_requested",
      user: userId,
      details: { userEmail: req.user.email },
      ipAddress: req.ip,
    });

    // Delete all user data in order
    await Promise.all([
      // Delete biometric data
      BiometricData.deleteMany({ user: userId }),

      // Note: Attendance records may need to be retained for institutional records
      // Only anonymize, don't delete
      Attendance.updateMany(
        { student: userId },
        { $unset: { verificationData: 1 }, $set: { anonymized: true } }
      ),

      // Delete consent records
      ConsentRecord.deleteMany({ userId }),

      // Delete decrypt audit (keep summary log)
      DecryptAudit.deleteMany({ targetUserId: userId }),
    ]);

    // Finally delete the user
    await User.findByIdAndDelete(userId);

    // Log completion
    await Log.create({
      action: "account_deleted",
      user: null,
      details: { deletedUserId: userId.toString() },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: "success",
      message: "Account and associated data deleted successfully",
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete account",
    });
  }
});

/**
 * GET /api/users/me/consents
 * Get all consent records for user
 */
router.get("/me/consents", async (req, res) => {
  try {
    const consents = await ConsentRecord.find({
      userId: req.user._id,
      active: true,
    }).sort({ consentedAt: -1 });

    res.status(200).json({
      status: "success",
      data: { consents },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to get consents",
    });
  }
});

/**
 * POST /api/users/me/consents
 * Record new consent
 */
router.post("/me/consents", async (req, res) => {
  try {
    const { consentType, appVersion, platform, consentTextVersion } = req.body;

    if (!consentType || !appVersion || !platform) {
      return res.status(400).json({
        status: "error",
        message: "consentType, appVersion, and platform are required",
      });
    }

    const consent = await ConsentRecord.recordConsent({
      userId: req.user._id,
      consentType,
      appVersion,
      platform,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      consentTextVersion,
    });

    res.status(201).json({
      status: "success",
      data: { consent },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to record consent",
    });
  }
});

/**
 * DELETE /api/users/me/consents/:type
 * Revoke specific consent type
 */
router.delete("/me/consents/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const { reason } = req.body;

    const result = await ConsentRecord.revokeConsent(
      req.user._id,
      type,
      reason
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "No active consent found for this type",
      });
    }

    res.status(200).json({
      status: "success",
      message: `Consent for ${type} revoked`,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to revoke consent",
    });
  }
});

module.exports = router;
