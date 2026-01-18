const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// Get current user profile
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Format the response to match what the frontend expects
    const profileData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || "N/A",
      whatsapp: user.whatsapp || user.phone || "N/A",
      usn: user.usn || "N/A",
      dateOfBirth: user.dateOfBirth,
      dob: user.dateOfBirth, // Alias for compatibility
      department: user.department || user.branch || "CSE",
      semester: user.semester || "N/A",
      section: user.section || "N/A",
      bloodGroup: user.bloodGroup || "N/A",
      address: user.address || "Not Updated",
      fatherName: user.fatherName || "Not Updated",
      fatherPhone: user.fatherPhone || "Not Updated",
      fatherOccupation: user.fatherOccupation || "N/A",
      motherName: user.motherName || "Not Updated",
      motherPhone: user.motherPhone || "Not Updated",
      motherOccupation: user.motherOccupation || "N/A",
      branch: user.branch || "CSE",
    };

    res.status(200).json({
      status: "success",
      success: true,
      data: {
        user: profileData,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Update user profile
router.put("/profile", protect, async (req, res) => {
  try {
    const {
      phone,
      whatsapp,
      address,
      fatherName,
      fatherPhone,
      fatherOccupation,
      motherName,
      motherPhone,
      motherOccupation,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Update allowed fields
    if (phone) user.phone = phone;
    if (whatsapp) user.whatsapp = whatsapp;
    if (address) user.address = address;
    if (fatherName) user.fatherName = fatherName;
    if (fatherPhone) user.fatherPhone = fatherPhone;
    if (fatherOccupation) user.fatherOccupation = fatherOccupation;
    if (motherName) user.motherName = motherName;
    if (motherPhone) user.motherPhone = motherPhone;
    if (motherOccupation) user.motherOccupation = motherOccupation;

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        user: await User.findById(user._id).select("-password"),
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// =============================================
// CONSENT MANAGEMENT (GDPR/POPI Compliance)
// =============================================

const ConsentRecord = require("../models/ConsentRecord");
const BiometricData = require("../models/BiometricData");
const Attendance = require("../models/Attendance");
const DecryptAudit = require("../models/DecryptAudit");
const Log = require("../models/Log");

// Get all active consents
router.get("/me/consents", protect, async (req, res) => {
  try {
    const consents = await ConsentRecord.find({
      userId: req.user._id,
      active: true,
    }).sort({ consentedAt: -1 });

    res.status(200).json({
      status: "success",
      success: true,
      data: { consents },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Record new consent
router.post("/me/consents", protect, async (req, res) => {
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
      consentTextVersion: consentTextVersion || "1.0",
    });

    res.status(201).json({
      status: "success",
      success: true,
      data: { consent },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Revoke consent
router.delete("/me/consents/:type", protect, async (req, res) => {
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
        message: "No active consent found",
      });
    }

    res.status(200).json({
      status: "success",
      message: `Consent for ${type} revoked`,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Export all user data (GDPR DSAR)
router.get("/me/data", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const [user, biometricData, attendance, consents] = await Promise.all([
      User.findById(userId)
        .select("-password -faceDescriptor.descriptor")
        .lean(),
      BiometricData.findOne({ user: userId })
        .select("-faceData.descriptors")
        .lean(),
      Attendance.find({ student: userId })
        .select("-verificationData.biometric.faceImageUrl")
        .lean(),
      ConsentRecord.find({ userId }).lean(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      biometricEnrollment: biometricData
        ? {
            faceEnrolled: biometricData.faceData?.enrolled || false,
            fingerprintEnrolled:
              biometricData.fingerprintData?.enrolled || false,
          }
        : null,
      attendanceCount: attendance.length,
      consents: consents.map((c) => ({
        type: c.consentType,
        consentedAt: c.consentedAt,
        active: c.active,
      })),
    };

    await Log.create({
      action: "data_export",
      user: userId,
      details: { exportVersion: "1.0" },
      ipAddress: req.ip,
    });

    res
      .status(200)
      .json({ status: "success", success: true, data: exportData });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Delete account (Right to Erasure)
router.delete("/me", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { confirmDelete } = req.body;

    if (confirmDelete !== "DELETE_MY_ACCOUNT") {
      return res.status(400).json({
        status: "error",
        message: 'Confirm with: confirmDelete: "DELETE_MY_ACCOUNT"',
      });
    }

    await Promise.all([
      BiometricData.deleteMany({ user: userId }),
      Attendance.updateMany(
        { student: userId },
        { $unset: { verificationData: 1 }, $set: { anonymized: true } }
      ),
      ConsentRecord.deleteMany({ userId }),
      DecryptAudit.deleteMany({ targetUserId: userId }),
    ]);

    await User.findByIdAndDelete(userId);

    await Log.create({
      action: "account_deleted",
      user: null,
      details: { deletedUserId: userId.toString() },
      ipAddress: req.ip,
    });

    res.status(200).json({ status: "success", message: "Account deleted" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

module.exports = router;
