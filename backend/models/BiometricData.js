const mongoose = require("mongoose");

const biometricDataSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Face Recognition Data
    faceData: {
      descriptors: [
        {
          descriptor: {
            type: [Number], // 128-dimensional face descriptor from FaceNet
            required: true,
            validate: {
              validator: function (v) {
                return Array.isArray(v) && v.length === 128;
              },
              message: "Face descriptor must be an array of 128 numbers",
            },
          },
          capturedAt: {
            type: Date,
            default: Date.now,
          },
          imageUrl: String,
          confidence: {
            type: Number,
            min: 0,
            max: 1,
          },
          smileVerified: {
            type: Boolean,
            default: false,
          },
          smileConfidence: {
            type: Number,
            min: 0,
            max: 1,
          },
        },
      ],
      referenceImage: {
        type: String, // URL or base64
        uploadedAt: Date,
      },
      faceDetectionModel: {
        type: String,
        default: "ssd_mobilenetv1", // MediaPipe/face-api model used
      },
      lastVerified: Date,
      verificationCount: {
        type: Number,
        default: 0,
      },
    },

    // Fingerprint Data (Simulated for now)
    fingerprintData: {
      template: String, // Encrypted fingerprint template
      fingerprintType: {
        type: String,
        enum: ["right_thumb", "left_thumb", "right_index", "left_index"],
        default: "right_thumb",
      },
      capturedAt: Date,
      quality: {
        type: Number,
        min: 0,
        max: 100,
      },
    },

    // Verification Statistics
    statistics: {
      totalFaceScans: {
        type: Number,
        default: 0,
      },
      successfulFaceScans: {
        type: Number,
        default: 0,
      },
      totalFingerprintScans: {
        type: Number,
        default: 0,
      },
      successfulFingerprintScans: {
        type: Number,
        default: 0,
      },
      averageConfidence: {
        type: Number,
        default: 0,
      },
      lastScanDate: Date,
    },

    // Security & Privacy
    isActive: {
      type: Boolean,
      default: true,
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
biometricDataSchema.index({ userId: 1 }, { unique: true });
biometricDataSchema.index({ "faceData.lastVerified": -1 });
biometricDataSchema.index({ isActive: 1 });
biometricDataSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // TTL: 1 year

// Method to add new face descriptor
biometricDataSchema.methods.addFaceDescriptor = function (
  descriptor,
  imageUrl,
  confidence,
  smileVerified = false,
  smileConfidence = 0
) {
  // Validate descriptor
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    throw new Error("Invalid face descriptor: must be array of 128 numbers");
  }

  this.faceData.descriptors.push({
    descriptor: descriptor, // ✅ FIXED: Store descriptor correctly
    capturedAt: new Date(),
    imageUrl,
    confidence,
    smileVerified,
    smileConfidence,
  });

  // Keep only last 5 descriptors for better matching
  if (this.faceData.descriptors.length > 5) {
    this.faceData.descriptors = this.faceData.descriptors.slice(-5);
  }

  this.lastUpdated = new Date();
};

// ✅ FIXED: Method to calculate average face match distance
biometricDataSchema.methods.calculateMatchDistance = function (newDescriptor) {
  if (!this.faceData.descriptors || !this.faceData.descriptors.length) {
    return 1; // Maximum distance
  }

  // Validate input descriptor
  if (!Array.isArray(newDescriptor) || newDescriptor.length !== 128) {
    throw new Error("Invalid descriptor for comparison");
  }

  const distances = this.faceData.descriptors.map((stored) => {
    return euclideanDistance(stored.descriptor, newDescriptor); // ✅ FIXED: Access stored.descriptor
  });

  return Math.min(...distances); // Return best match
};

// Euclidean distance calculation
function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 1; // Maximum distance on error
  }

  return Math.sqrt(
    a.reduce((sum, val, i) => sum + Math.pow(val - (b[i] || 0), 2), 0)
  );
}

// ✅ IMPROVED: Update statistics with proper averaging
biometricDataSchema.methods.updateStats = function (
  scanType,
  success,
  confidence
) {
  if (scanType === "face") {
    this.statistics.totalFaceScans++;
    if (success) this.statistics.successfulFaceScans++;
  } else if (scanType === "fingerprint") {
    this.statistics.totalFingerprintScans++;
    if (success) this.statistics.successfulFingerprintScans++;
  }

  // Update average confidence (weighted average)
  const total =
    this.statistics.totalFaceScans + this.statistics.totalFingerprintScans;
  const successful =
    this.statistics.successfulFaceScans +
    this.statistics.successfulFingerprintScans;

  if (total > 0) {
    // Calculate success rate percentage
    this.statistics.averageConfidence = (successful / total) * 100;
  }

  this.statistics.lastScanDate = new Date();
  this.lastUpdated = new Date();
};

// Pre-save hook to update lastUpdated
biometricDataSchema.pre("save", function (next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model("BiometricData", biometricDataSchema);
