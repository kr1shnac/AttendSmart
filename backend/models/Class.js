const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    // Class Details (simplified)
    className: {
      type: String,
      required: true,
    },
    section: {
      type: String,
      default: "A",
    },
    academicYear: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      default: "Computer Science",
    },

    // Class Teacher (one per class - main teacher)
    classTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Subject Teachers (multiple teachers with their subjects)
    subjectTeachers: [
      {
        teacher: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        subject: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
          required: true,
        },
        assignedDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Enrolled Students
    students: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usn: String,
        name: String,
        enrolledDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Class Schedule (Timetable)
    schedule: [
      {
        day: {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ],
        },
        startTime: String,
        endTime: String,
        subject: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
        },
        room: String,
        building: String,
      },
    ],

    // Class Info
    totalStudents: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Metadata
    description: String,
  },
  {
    timestamps: true,
  }
);

// Auto-update totalStudents
classSchema.pre("save", function (next) {
  this.totalStudents = this.students.length;
  next();
});

// Index for fast queries
classSchema.index({ classTeacher: 1, isActive: 1 });
classSchema.index({ "subjectTeachers.teacher": 1 });
classSchema.index({ "students.studentId": 1 });
classSchema.index({ department: 1, academicYear: 1 });

module.exports = mongoose.model("Class", classSchema);
