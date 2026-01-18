const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    // Subject Details
    subjectName: {
      type: String,
      required: true,
    },
    subjectCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    credits: {
      type: Number,
      default: 3,
      min: 1,
      max: 6,
    },
    semester: {
      type: Number,
      min: 1,
      max: 8,
    },
    department: {
      type: String,
      default: "Computer Science",
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast queries
subjectSchema.index({ subjectCode: 1 });
subjectSchema.index({ department: 1, semester: 1 });

module.exports = mongoose.model("Subject", subjectSchema);
