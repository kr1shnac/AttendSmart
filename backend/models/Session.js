const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true, // ✅ ADDED
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sessionType: {
      type: String,
      enum: ["lecture", "lab", "tutorial", "seminar", "exam"],
      default: "lecture",
    },
    topic: {
      type: String,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number, // in minutes
      required: true,
    },
    location: {
      room: String,
      building: String,
      floor: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
        radius: { type: Number, default: 100 }, // meters
      },
    },
    status: {
      type: String,
      enum: ["scheduled", "live", "completed", "cancelled"],
      default: "scheduled",
    },
    expectedStudents: {
      type: Number,
      default: 0,
    },
    presentCount: {
      type: Number,
      default: 0,
    },
    absentCount: {
      type: Number,
      default: 0,
    },
    attendancePercentage: {
      type: Number,
      default: 0,
    },
    completedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    // ========== SESSION PERSISTENCE FIELDS ==========
    // Last heartbeat from any participant (used for stale session detection)
    lastHeartbeat: {
      type: Date,
      default: Date.now,
    },
    // Track connected participants in real-time
    connectedParticipants: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["teacher", "student"] },
        socketId: String,
        connectedAt: Date,
        lastSeen: Date,
      },
    ],
    // Is the teacher currently connected?
    teacherConnected: {
      type: Boolean,
      default: false,
    },
    // Reason for session end (manual, auto_cleanup, force_end)
    endedReason: {
      type: String,
      enum: ["manual", "auto_cleanup", "force_end", null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Update attendance statistics
sessionSchema.methods.updateStats = async function () {
  const Attendance = mongoose.model("Attendance");

  const stats = await Attendance.aggregate([
    { $match: { session: this._id } },
    {
      $group: {
        _id: null,
        present: {
          $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
        },
        absent: {
          $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
        },
      },
    },
  ]);

  if (stats.length > 0) {
    this.presentCount = stats[0].present;
    this.absentCount = stats[0].absent;
    this.attendancePercentage =
      this.expectedStudents > 0
        ? Math.round((this.presentCount / this.expectedStudents) * 100)
        : 0;
  }

  await this.save();
};

// Indexes for Dashboard & Reporting
sessionSchema.index({ class: 1, status: 1, startTime: -1 }); // Teacher dashboard
sessionSchema.index({ teacher: 1, startTime: -1 }); // My Sessions
sessionSchema.index({ status: 1, startTime: 1 }); // Active sessions check

module.exports = mongoose.model("Session", sessionSchema);
