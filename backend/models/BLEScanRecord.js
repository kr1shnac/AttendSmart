const mongoose = require("mongoose");

const bleScanRecordSchema = new mongoose.Schema(
  {
    // Student Scanner Info
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentDeviceId: {
      type: String,
      required: true,
    },

    // Beacon Info
    beaconDeviceId: {
      type: String,
      required: true,
    },
    beaconUUID: {
      type: String,
      required: true,
    },

    // Session Info
    sessionId: {
      type: String,
      required: true,
    },
    sessionName: String,
    room: String,

    // Signal Measurements
    rssi: {
      type: Number, // Signal strength in dBm
      required: true,
    },
    txPower: {
      type: Number,
      default: -59,
    },
    distance: {
      type: Number, // Calculated distance in meters
      required: true,
    },
    signalQuality: {
      type: String,
      enum: ["excellent", "good", "fair", "poor"],
      default: "good",
    },

    // Proximity Verification
    isWithinRange: {
      type: Boolean,
      default: false,
    },
    proximityConfidence: {
      type: Number, // 0-100
      default: 0,
    },

    // Timestamp
    scanTime: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Additional Metadata
    metadata: {
      deviceType: String,
      osVersion: String,
      appVersion: String,
      batteryLevel: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for queries
bleScanRecordSchema.index({ studentId: 1, scanTime: -1 });
bleScanRecordSchema.index({ sessionId: 1, scanTime: -1 });
bleScanRecordSchema.index({ beaconDeviceId: 1, scanTime: -1 });

// Calculate distance from RSSI
bleScanRecordSchema.pre("save", function (next) {
  if (this.rssi && this.txPower) {
    // Distance formula: d = 10^((TxPower - RSSI) / (10 * N))
    // N = 2.0 for indoor environments
    const N = 2.0;
    this.distance = Math.pow(10, (this.txPower - this.rssi) / (10 * N));

    // Determine if within acceptable range (10 meters)
    this.isWithinRange = this.distance <= 10;

    // Calculate proximity confidence based on signal strength
    if (this.rssi >= -50) {
      this.proximityConfidence = 95;
      this.signalQuality = "excellent";
    } else if (this.rssi >= -60) {
      this.proximityConfidence = 90;
      this.signalQuality = "good";
    } else if (this.rssi >= -70) {
      this.proximityConfidence = 80;
      this.signalQuality = "fair";
    } else {
      this.proximityConfidence = 60;
      this.signalQuality = "poor";
    }
  }
  next();
});

module.exports = mongoose.model("BLEScanRecord", bleScanRecordSchema);
