const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // Common fields
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: String,

    // ✅ NEW: Added WhatsApp field (fallback to phone if not provided)
    whatsapp: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["student", "teacher", "admin"],
      required: true,
    },

    // Password (only for teacher/admin)
    password: {
      type: String,
      required: function () {
        return this.role !== "student";
      },
      select: false,
    },

    // =================================================
    // STUDENT-SPECIFIC FIELDS
    // =================================================
    usn: {
      type: String,
      sparse: true,
      uppercase: true,
      required: function () {
        return this.role === "student";
      },
    },
    dateOfBirth: {
      type: Date,
      required: function () {
        return this.role === "student";
      },
    },
    semester: Number,
    branch: String,
    section: String,

    // ✅ NEW: Blood Group & Address
    bloodGroup: { type: String, default: "" },
    address: { type: String, default: "" },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    },

    // ✅ NEW: Family Details (Father)
    fatherName: { type: String, default: "" },
    fatherPhone: { type: String, default: "" },
    fatherOccupation: { type: String, default: "" },

    // ✅ NEW: Family Details (Mother)
    motherName: { type: String, default: "" },
    motherPhone: { type: String, default: "" },
    motherOccupation: { type: String, default: "" },

    // =================================================
    // TEACHER-SPECIFIC FIELDS
    // =================================================
    employeeId: {
      type: String,
      sparse: true,
      unique: true, // ✅ ADDED: Enforce uniqueness
    },
    department: String,

    // =================================================
    // BIOMETRIC ENROLLMENT (Enhanced)
    // =================================================

    // Master enrollment flag
    biometricEnrolled: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Face descriptor (128D embedding array from face recognition)
    faceDescriptor: {
      enrolled: { type: Boolean, default: false },
      descriptor: {
        type: [Number],
        default: [],
        validate: {
          validator: function (arr) {
            // Allow null, undefined, or empty array (not enrolled)
            // OR exactly 128 elements (enrolled)
            return !arr || arr.length === 0 || arr.length === 128;
          },
          message: "Face descriptor must be empty or exactly 128 dimensions",
        },
      },
      enrolledAt: { type: Date, default: null },
      enrollmentDevice: { type: String, default: null },
      quality: {
        type: Number,
        default: null,
        min: 0,
        max: 1,
      },
      lastVerifiedAt: { type: Date, default: null },
      verificationCount: { type: Number, default: 0 },
    },

    // Fingerprint credential (WebAuthn)
    fingerprintCredential: {
      enrolled: { type: Boolean, default: false },
      credentialId: {
        type: String,
        default: null,
      },
      publicKey: { type: String, default: null },
      counter: { type: Number, default: 0 },
      enrolledAt: { type: Date, default: null },
      enrollmentDevice: { type: String, default: null },
      lastUsedAt: { type: Date, default: null },
      skipped: { type: Boolean, default: false },
    },

    // Legacy biometric fields (for backward compatibility)
    biometricCredentials: [
      {
        credentialID: Buffer,
        credentialPublicKey: Buffer,
        counter: Number,
        transports: [String],
      },
    ],
    biometric_registered: {
      type: Boolean,
      default: false,
    },
    currentChallenge: String,

    // Enrollment tracking
    enrollmentCompletedAt: { type: Date, default: null },
    enrollmentAttempts: { type: Number, default: 0 },
    enrollmentIP: { type: String, default: null },
    lastEnrollmentUpdate: { type: Date, default: null },

    // =================================================
    // ATTESTED DEVICES (Teachers only)
    // Stores verified device information for BLE beacon trust
    // =================================================
    attestedDevices: [
      {
        deviceId: { type: String, required: true },
        platform: {
          type: String,
          enum: ["android", "ios", "web"],
          required: true,
        },
        attestedAt: { type: Date, default: Date.now },
        lastVerifiedAt: { type: Date, default: null },
        attestationVerdict: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        deviceModel: { type: String, default: null },
        osVersion: { type: String, default: null },
        appVersion: { type: String, default: null },
        isActive: { type: Boolean, default: true },
      },
    ],

    // Security & tracking
    isActive: {
      type: Boolean,
      default: true,
    },
    first_login: {
      type: Boolean,
      default: true,
    },
    firstLoginAt: { type: Date, default: null },
    last_login: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,

    // Admin tracking
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ usn: 1 });
userSchema.index({ role: 1 });
userSchema.index({ class: 1 });
// ✅ ADDED: Text index for instant search
userSchema.index({
  name: "text",
  email: "text",
  usn: "text",
  employeeId: "text",
});

// Hash password before saving (for teachers/admins)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Check if user needs biometric enrollment
userSchema.methods.needsBiometricEnrollment = function () {
  // Admins don't need biometric enrollment
  if (this.role === "admin") {
    return false;
  }

  // Students and teachers need face enrollment (fingerprint is optional)
  return !this.biometricEnrolled || !this.faceDescriptor?.enrolled;
};

// Mark enrollment as complete
userSchema.methods.completeEnrollment = async function () {
  this.biometricEnrolled = true;
  this.enrollmentCompletedAt = new Date();
  return this.save();
};

// Get enrollment status summary
userSchema.methods.getEnrollmentStatus = function () {
  return {
    needsEnrollment: this.needsBiometricEnrollment(),
    faceEnrolled: this.faceDescriptor?.enrolled || false,
    fingerprintEnrolled: this.fingerprintCredential?.enrolled || false,
    fingerprintSkipped: this.fingerprintCredential?.skipped || false,
    enrollmentComplete: this.biometricEnrolled,
    isFirstLogin: !this.firstLoginAt,
  };
};

module.exports = mongoose.model("User", userSchema);
