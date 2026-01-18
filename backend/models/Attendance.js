const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "excused", "pending", "rejected"],
      default: "absent",
    },
    checkInTime: Date,
    checkOutTime: Date,

    // Verification Steps (Sequential)
    verificationSteps: {
      gpsCompleted: { type: Boolean, default: false },
      bleCompleted: { type: Boolean, default: false },
      biometricCompleted: { type: Boolean, default: false },
    },

    // Verification Data
    verificationData: {
      // GPS Verification
      gps: {
        verified: Boolean,
        latitude: Number,
        longitude: Number,
        accuracy: Number,
        distance: Number, // meters from class location
        timestamp: Date,
      },
      // BLE Verification
      ble: {
        verified: Boolean,
        deviceId: String,
        rssi: Number, // signal strength
        distance: Number,
        scanRecordId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BLEScanRecord",
        },
        timestamp: Date,
      },
      // Biometric Verification
      biometric: {
        verified: Boolean,
        type: {
          type: String,
          enum: ["face", "fingerprint", "both"],
        },
        confidence: Number, // 0-100
        biometricDataId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BiometricData",
        },
        faceImageUrl: String,
        timestamp: Date,
      },
    },

    // Overall Status
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Alerts
    hasAlert: {
      type: Boolean,
      default: false,
    },
    alertType: {
      type: String,
      enum: [
        "weak_signal",
        "far_distance",
        "low_confidence",
        "suspicious",
        "gps_failed",
        "face_failed",
        "both_failed",
        null,
      ],
      default: null,
    },
    alertMessage: String,

    // Device Info
    deviceInfo: {
      userAgent: String,
      platform: String,
      ipAddress: String,
    },

    // Manual marking by teacher
    notes: String,
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
attendanceSchema.index({ session: 1, student: 1 }, { unique: true });
attendanceSchema.index({ session: 1, status: 1 }); // Session stats queries
attendanceSchema.index({ student: 1, status: 1 }); // Student profile stats
attendanceSchema.index({ class: 1, student: 1 }); // Class-wise student reports
attendanceSchema.index({ createdAt: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ "verificationData.gps.verified": 1 });
attendanceSchema.index({ "verificationData.ble.verified": 1 });
attendanceSchema.index({ "verificationData.biometric.verified": 1 });
// ADDED: Compound indexes for dashboard aggregation optimization
attendanceSchema.index({ session: 1, status: 1, student: 1 }); // Dashboard aggregations
attendanceSchema.index({ student: 1, createdAt: -1 }); // Student weekly attendance

// Calculate verification score
attendanceSchema.methods.calculateVerificationScore = function () {
  let score = 0;

  // GPS (30 points)
  if (this.verificationData.gps?.verified) {
    const distance = this.verificationData.gps.distance;
    if (distance <= 10) score += 30;
    else if (distance <= 50) score += 20;
    else if (distance <= 100) score += 10;
  }

  // BLE (30 points)
  if (this.verificationData.ble?.verified) {
    const rssi = this.verificationData.ble.rssi;
    if (rssi >= -50) score += 30;
    else if (rssi >= -70) score += 20;
    else if (rssi >= -85) score += 10;
  }

  // Biometric (40 points)
  if (this.verificationData.biometric?.verified) {
    const confidence = this.verificationData.biometric.confidence;
    score += Math.round(confidence * 0.4);
  }

  this.verificationScore = Math.min(score, 100);
  return this.verificationScore;
};

// Check for alerts
attendanceSchema.methods.checkForAlerts = function () {
  const gps = this.verificationData.gps;
  const ble = this.verificationData.ble;
  const bio = this.verificationData.biometric;

  if (gps?.distance > 100) {
    this.hasAlert = true;
    this.alertType = "far_distance";
    this.alertMessage = `Student is ${Math.round(
      gps.distance
    )}m away from class`;
  } else if (ble?.rssi < -85) {
    this.hasAlert = true;
    this.alertType = "weak_signal";
    this.alertMessage = `Weak BLE signal (${ble.rssi} dBm)`;
  } else if (bio?.confidence < 60) {
    this.hasAlert = true;
    this.alertType = "low_confidence";
    this.alertMessage = `Low biometric confidence (${bio.confidence}%)`;
  } else if (this.verificationScore < 50) {
    this.hasAlert = true;
    this.alertType = "suspicious";
    this.alertMessage = `Low verification score (${this.verificationScore}/100)`;
  }
};

// Pre-save middleware
attendanceSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  this.calculateVerificationScore();
  this.checkForAlerts();

  this.isVerified =
    this.verificationSteps.gpsCompleted &&
    this.verificationSteps.bleCompleted &&
    this.verificationSteps.biometricCompleted &&
    this.verificationScore >= 70;

  next();
});

module.exports = mongoose.model("Attendance", attendanceSchema);
