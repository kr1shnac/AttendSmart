const express = require("express");
const router = express.Router();
const Class = require("../models/Class");
const Session = require("../models/Session");
const Attendance = require("../models/Attendance");
const { protect, authorize } = require("../middleware/auth");

// Get all classes for logged-in teacher WITH STATISTICS
router.get("/my-classes", protect, authorize("teacher"), async (req, res) => {
  try {
    // Find classes where user is classTeacher OR a subject teacher
    const classes = await Class.find({
      $or: [
        { classTeacher: req.user._id },
        { "subjectTeachers.teacher": req.user._id },
      ],
      isActive: true,
    })
      .populate("students", "name usn email")
      .sort({ createdAt: -1 });

    // Calculate statistics for each class
    const classesWithStats = await Promise.all(
      classes.map(async (classDoc) => {
        // Get total sessions
        const totalSessions = await Session.countDocuments({
          class: classDoc._id,
          status: { $in: ["completed", "live"] },
        });

        // Calculate average attendance
        const attendanceStats = await Attendance.aggregate([
          {
            $lookup: {
              from: "sessions",
              localField: "session",
              foreignField: "_id",
              as: "sessionData",
            },
          },
          {
            $match: {
              "sessionData.class": classDoc._id,
              "sessionData.status": "completed",
            },
          },
          {
            $group: {
              _id: null,
              totalPresent: {
                $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
              },
              totalRecords: { $sum: 1 },
            },
          },
        ]);

        const averageAttendance =
          attendanceStats.length > 0 && attendanceStats[0].totalRecords > 0
            ? Math.round(
                (attendanceStats[0].totalPresent /
                  attendanceStats[0].totalRecords) *
                  100
              )
            : 0;

        return {
          ...classDoc.toObject(),
          totalSessions,
          averageAttendance,
          overallAttendance: averageAttendance, // Alias for frontend compatibility
        };
      })
    );

    res.status(200).json({
      status: "success",
      results: classesWithStats.length,
      data: classesWithStats, // Return array directly for easier consumption
    });
  } catch (error) {
    console.error("Get classes error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Get single class with detailed info
router.get("/:id", protect, authorize("teacher"), async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id)
      .populate("students.studentId", "name usn email phone")
      .populate("classTeacher", "name email");

    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    // Check authorization - allow if classTeacher OR in subjectTeachers array
    const isClassTeacher =
      classDoc.classTeacher?._id.toString() === req.user._id.toString();
    const isSubjectTeacher = classDoc.subjectTeachers.some(
      (st) => st.teacher.toString() === req.user._id.toString()
    );

    if (!isClassTeacher && !isSubjectTeacher) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized to access this class",
      });
    }

    // Calculate statistics
    const totalSessions = await Session.countDocuments({
      class: classDoc._id,
      status: { $in: ["completed", "live"] },
    });

    const attendanceStats = await Attendance.aggregate([
      {
        $lookup: {
          from: "sessions",
          localField: "session",
          foreignField: "_id",
          as: "sessionData",
        },
      },
      {
        $match: {
          "sessionData.class": classDoc._id,
          "sessionData.status": "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalPresent: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          totalRecords: { $sum: 1 },
        },
      },
    ]);

    const averageAttendance =
      attendanceStats.length > 0 && attendanceStats[0].totalRecords > 0
        ? Math.round(
            (attendanceStats[0].totalPresent /
              attendanceStats[0].totalRecords) *
              100
          )
        : 0;

    const classWithStats = {
      ...classDoc.toObject(),
      totalSessions,
      averageAttendance,
      overallAttendance: averageAttendance,
    };

    res.status(200).json({
      status: "success",
      data: {
        class: classWithStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Create new class
router.post("/", protect, authorize("teacher"), async (req, res) => {
  try {
    const classData = {
      ...req.body,
      teacher: req.user._id,
    };

    const newClass = await Class.create(classData);

    res.status(201).json({
      status: "success",
      data: {
        class: newClass,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Add students to class
router.post(
  "/:id/add-students",
  protect,
  authorize("teacher"),
  async (req, res) => {
    try {
      const { studentIds } = req.body;

      const classDoc = await Class.findById(req.params.id);

      if (!classDoc) {
        return res.status(404).json({
          status: "error",
          message: "Class not found",
        });
      }

      // Add students (avoiding duplicates)
      studentIds.forEach((studentId) => {
        if (!classDoc.students.includes(studentId)) {
          classDoc.students.push(studentId);
        }
      });

      await classDoc.save();

      res.status(200).json({
        status: "success",
        data: {
          class: classDoc,
        },
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  }
);

// Update class
router.put("/:id", protect, authorize("teacher"), async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id);

    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    if (classDoc.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized",
      });
    }

    Object.assign(classDoc, req.body);
    await classDoc.save();

    res.status(200).json({
      status: "success",
      data: {
        class: classDoc,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Delete class
router.delete("/:id", protect, authorize("teacher"), async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id);

    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    if (classDoc.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized",
      });
    }

    classDoc.isActive = false;
    await classDoc.save();

    res.status(200).json({
      status: "success",
      message: "Class deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

module.exports = router;
