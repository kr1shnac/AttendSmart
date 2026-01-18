/**
 * DecryptAudit Model
 * Logs all biometric decryption operations for security audit trail
 */

const mongoose = require("mongoose");

const decryptAuditSchema = new mongoose.Schema(
  {
    // Who requested the decrypt
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Target user whose data was decrypted (may differ from requestor for admin actions)
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // What was decrypted
    operation: {
      type: String,
      enum: [
        "face_descriptor",
        "verification_match",
        "data_export",
        "admin_access",
      ],
      required: true,
    },

    // Why it was decrypted
    reason: {
      type: String,
      enum: [
        "attendance_verification",
        "enrollment_update",
        "data_export_request",
        "admin_audit",
        "appeal_review",
      ],
      required: true,
    },

    // Context
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },

    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
    },

    // Request metadata
    ipAddress: String,
    userAgent: String,
    platform: String,

    // Result
    success: {
      type: Boolean,
      default: true,
    },

    errorMessage: String,

    // Timing
    decryptDurationMs: Number,
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Indexes for audit queries
decryptAuditSchema.index({ createdAt: -1 });
decryptAuditSchema.index({ userId: 1, createdAt: -1 });
decryptAuditSchema.index({ operation: 1, createdAt: -1 });

// Static method to log a decrypt operation
decryptAuditSchema.statics.logDecrypt = async function (params) {
  try {
    return await this.create({
      userId: params.userId,
      targetUserId: params.targetUserId || params.userId,
      operation: params.operation,
      reason: params.reason,
      sessionId: params.sessionId,
      attendanceId: params.attendanceId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      platform: params.platform,
      success: params.success !== false,
      errorMessage: params.errorMessage,
      decryptDurationMs: params.duration,
    });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error("[DecryptAudit] Logging failed:", error.message);
    return null;
  }
};

// Static method to check for suspicious activity
decryptAuditSchema.statics.checkRateLimit = async function (
  userId,
  windowMs = 60000,
  maxDecrypts = 10
) {
  const since = new Date(Date.now() - windowMs);
  const count = await this.countDocuments({
    userId,
    createdAt: { $gte: since },
  });
  return count >= maxDecrypts;
};

// Static method to get recent decrypts for a user
decryptAuditSchema.statics.getRecentActivity = async function (
  userId,
  limit = 50
) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("targetUserId", "name usn")
    .lean();
};

const DecryptAudit = mongoose.model("DecryptAudit", decryptAuditSchema);

module.exports = DecryptAudit;
