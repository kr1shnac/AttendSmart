const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional: failed logins and admin logins may not have userId
      default: null,
    },
    userRole: {
      type: String,
      enum: ["student", "teacher", "admin"],
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Auth actions
        "login",
        "login_success",
        "login_failed",
        "login_error",
        "logout",
        // Biometric actions
        "face_scan",
        "fingerprint_scan",
        "biometric_enroll",
        // BLE actions
        "ble_connect",
        "ble_disconnect",
        // Attendance actions
        "attendance_mark",
        "attendance_verify",
        "red_flag_resolved",
        // User actions
        "dashboard_view",
        "report_generate",
        "profile_update",
        // Admin student actions
        "create_student",
        "update_student",
        "delete_student",
        // Admin teacher actions
        "create_teacher",
        "update_teacher",
        "delete_teacher",
        // Admin class actions
        "create_class",
        "update_class",
        "delete_class",
        // Admin subject actions
        "create_subject",
        "update_subject",
        "delete_subject",
        // Session actions
        "session_start",
        "session_end",
        "session_create",
        // System events
        "system_event",
        "data_export",
        "error",
      ],
    },
    eventDescription: {
      type: String,
      required: true,
      maxlength: 500,
    },
    metadata: {
      ipAddress: String,
      deviceType: String,
      browser: String,
      location: String,
      confidence: Number, // For biometric scans
      bleDeviceId: String, // For BLE events
      sessionId: String,
      duration: Number, // For timed events
      success: {
        type: Boolean,
        default: true,
      },
      errorCode: String,
      errorMessage: String,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "error", "critical", "success"],
      default: "info",
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
// Indexes for faster queries
logSchema.index({ userId: 1, timestamp: -1 }); // User activity timeline
logSchema.index({ action: 1, timestamp: -1 }); // Action stats
logSchema.index({ timestamp: -1, action: 1 }); // Dashboard timeline & filtering
logSchema.index({ severity: 1 });
logSchema.index({ "metadata.success": 1 });
logSchema.index({ "metadata.sessionId": 1 }); // Specific session tracking
// ADDED: Compound indexes for dashboard optimization
logSchema.index({ userId: 1, action: 1, timestamp: -1 }); // Dashboard filters
logSchema.index({ action: 1, "metadata.success": 1, timestamp: -1 }); // Verification stats with time

// Virtual for formatted timestamp
logSchema.virtual("formattedTime").get(function () {
  return this.timestamp.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
});

// Method to get log summary
logSchema.methods.getSummary = function () {
  return {
    id: this._id,
    user: this.userId,
    role: this.userRole,
    action: this.action,
    description: this.eventDescription,
    time: this.formattedTime,
    severity: this.severity,
    success: this.metadata.success,
  };
};

// Static method to get logs by date range
logSchema.statics.getLogsByDateRange = function (
  startDate,
  endDate,
  filters = {}
) {
  const query = {
    timestamp: {
      $gte: startDate,
      $lte: endDate,
    },
    ...filters,
  };

  return this.find(query)
    .populate("userId", "name email role")
    .sort({ timestamp: -1 })
    .lean();
};

// Static method to get aggregated stats
logSchema.statics.getStats = async function (userId = null) {
  const match = userId ? { userId: mongoose.Types.ObjectId(userId) } : {};

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$action",
        count: { $sum: 1 },
        successCount: {
          $sum: { $cond: ["$metadata.success", 1, 0] },
        },
        failureCount: {
          $sum: { $cond: ["$metadata.success", 0, 1] },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

module.exports = mongoose.model("Log", logSchema);
