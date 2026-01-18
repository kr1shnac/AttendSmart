const mongoose = require("mongoose");

const bleDeviceSchema = new mongoose.Schema(
  {
    // Teacher/Beacon Device
    deviceId: {
      type: String,
      required: true,
      unique: true,
    },
    deviceName: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ["teacher_beacon", "student_scanner", "classroom_beacon"],
      default: "teacher_beacon",
    },

    // Owner Information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // BLE Beacon Configuration
    beaconUUID: {
      type: String, // Unique UUID for session broadcasts
      sparse: true,
    },
    txPower: {
      type: Number,
      default: -59, // dBm at 1 meter
    },
    broadcastInterval: {
      type: Number,
      default: 1000, // milliseconds
    },

    // Session Association
    activeSession: {
      sessionId: String,
      sessionName: String,
      room: String,
      startTime: Date,
      endTime: Date,
      isActive: Boolean,
    },

    // Location Data
    location: {
      room: String,
      building: String,
      floor: Number,
      gps: {
        latitude: Number,
        longitude: Number,
      },
    },

    // Statistics
    statistics: {
      totalBroadcasts: {
        type: Number,
        default: 0,
      },
      totalScans: {
        type: Number,
        default: 0,
      },
      uniqueConnections: {
        type: Number,
        default: 0,
      },
      lastBroadcast: Date,
      lastScan: Date,
    },

    // Device Health
    batteryLevel: Number,
    signalQuality: {
      type: String,
      enum: ["excellent", "good", "fair", "poor"],
      default: "good",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
bleDeviceSchema.index({ deviceId: 1 });
bleDeviceSchema.index({ userId: 1 });
bleDeviceSchema.index({ "activeSession.isActive": 1 });
bleDeviceSchema.index({ isActive: 1, lastSeen: -1 });

// Methods
bleDeviceSchema.methods.startSession = function (sessionData) {
  this.activeSession = {
    ...sessionData,
    isActive: true,
  };
  this.statistics.lastBroadcast = new Date();
  return this.save();
};

bleDeviceSchema.methods.stopSession = function () {
  if (this.activeSession) {
    this.activeSession.isActive = false;
  }
  return this.save();
};

bleDeviceSchema.methods.updateStats = function (type) {
  if (type === "broadcast") {
    this.statistics.totalBroadcasts++;
    this.statistics.lastBroadcast = new Date();
  } else if (type === "scan") {
    this.statistics.totalScans++;
    this.statistics.lastScan = new Date();
  }
  this.lastSeen = new Date();
  return this.save();
};

module.exports = mongoose.model("BLEDevice", bleDeviceSchema);
