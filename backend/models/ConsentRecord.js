/**
 * ConsentRecord Model
 * Stores user consent for biometric data collection (GDPR/POPI compliance)
 */

const mongoose = require("mongoose");

const consentRecordSchema = new mongoose.Schema(
  {
    // User who gave consent
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Type of consent
    consentType: {
      type: String,
      enum: [
        "biometric_enrollment",
        "face_capture",
        "location_tracking",
        "ble_scanning",
        "data_processing",
      ],
      required: true,
    },

    // When consent was given
    consentedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // App version when consent was given
    appVersion: {
      type: String,
      required: true,
    },

    // Platform
    platform: {
      type: String,
      enum: ["android", "ios", "web"],
      required: true,
    },

    // IP address at time of consent
    ipAddress: String,

    // User agent
    userAgent: String,

    // Device ID (for mobile)
    deviceId: String,

    // Whether consent is currently active
    active: {
      type: Boolean,
      default: true,
    },

    // If consent was revoked
    revokedAt: Date,
    revokedReason: String,

    // Consent text version shown to user (for audit)
    consentTextVersion: {
      type: String,
      default: "1.0",
    },

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
consentRecordSchema.index({ userId: 1, consentType: 1 });
consentRecordSchema.index({ userId: 1, active: 1 });

/**
 * Check if user has active consent for a type
 */
consentRecordSchema.statics.hasConsent = async function (userId, consentType) {
  const record = await this.findOne({
    userId,
    consentType,
    active: true,
  });
  return !!record;
};

/**
 * Check if user has all required consents for enrollment
 */
consentRecordSchema.statics.hasEnrollmentConsent = async function (userId) {
  const requiredConsents = [
    "biometric_enrollment",
    "face_capture",
    "data_processing",
  ];

  const consents = await this.find({
    userId,
    consentType: { $in: requiredConsents },
    active: true,
  });

  const consentTypes = consents.map((c) => c.consentType);
  return requiredConsents.every((type) => consentTypes.includes(type));
};

/**
 * Record new consent
 */
consentRecordSchema.statics.recordConsent = async function (params) {
  // Deactivate any existing consent of same type
  await this.updateMany(
    { userId: params.userId, consentType: params.consentType, active: true },
    { active: false, revokedAt: new Date(), revokedReason: "superseded" }
  );

  return this.create({
    userId: params.userId,
    consentType: params.consentType,
    appVersion: params.appVersion,
    platform: params.platform,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    deviceId: params.deviceId,
    consentTextVersion: params.consentTextVersion || "1.0",
    metadata: params.metadata,
  });
};

/**
 * Revoke consent
 */
consentRecordSchema.statics.revokeConsent = async function (
  userId,
  consentType,
  reason
) {
  return this.updateMany(
    { userId, consentType, active: true },
    {
      active: false,
      revokedAt: new Date(),
      revokedReason: reason || "user_request",
    }
  );
};

/**
 * Get all consents for a user (for data export)
 */
consentRecordSchema.statics.getUserConsents = async function (userId) {
  return this.find({ userId }).sort({ consentedAt: -1 }).lean();
};

const ConsentRecord = mongoose.model("ConsentRecord", consentRecordSchema);

module.exports = ConsentRecord;
