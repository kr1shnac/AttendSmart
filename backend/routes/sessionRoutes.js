const express = require("express");
const router = express.Router();
const Session = require("../models/Session");
const Class = require("../models/Class");
const Attendance = require("../models/Attendance");
const { protect, authorize } = require("../middleware/auth");
const sessionManager = require("../services/sessionManager");
// NOTE: catchAsync available for future refactoring - current routes use inline try/catch
const catchAsync = require("../middleware/asyncHandler");

// Create new session (immediate or scheduled)
router.post("/create", protect, authorize("teacher"), async (req, res) => {
  try {
    // ========== SINGLE SESSION ENFORCEMENT ==========
    // Check if teacher already has an active session
    const canCreate = await sessionManager.canCreateSession(req.user._id);
    if (!canCreate.canCreate) {
      return res.status(409).json({
        status: "error",
        message:
          "You already have an active session. Please end it before starting a new one.",
        data: {
          existingSession: canCreate.existingSession,
        },
      });
    }

    const {
      classId,
      sessionType,
      topic,
      duration,
      room,
      building,
      floor,
      coordinates,
      scheduledStartTime, // Optional: if provided, schedule for later
    } = req.body;

    // Verify class exists
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    // Check authorization - allow classTeacher OR subject teachers
    const isClassTeacher =
      classDoc.classTeacher?.toString() === req.user._id.toString();
    const isSubjectTeacher = classDoc.subjectTeachers?.some(
      (st) => st.teacher?.toString() === req.user._id.toString()
    );

    if (!isClassTeacher && !isSubjectTeacher) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized to create session for this class",
      });
    }

    // Determine session timing
    let startTime, endTime, status;

    if (scheduledStartTime) {
      // Scheduled session
      startTime = new Date(scheduledStartTime);
      endTime = new Date(startTime.getTime() + duration * 60000);
      status = "scheduled";
    } else {
      // Immediate session
      startTime = new Date();
      endTime = new Date(startTime.getTime() + duration * 60000);
      status = "live";
    }

    // Create session
    const session = new Session({
      class: classId,
      teacher: req.user._id,
      sessionType,
      topic: topic || "Class Session",
      startTime,
      endTime,
      duration,
      location: {
        room,
        building,
        floor,
        coordinates: coordinates || {
          latitude: 0,
          longitude: 0,
          radius: 100,
        },
      },
      status,
      expectedStudents: classDoc.students?.length || 0,
    });

    await session.save();

    // Create attendance records for all students (only for live sessions)
    if (status === "live" && classDoc.students?.length > 0) {
      const attendanceRecords = classDoc.students.map((studentId) => ({
        session: session._id,
        student: studentId,
        class: classId,
        status: "absent",
      }));

      await Attendance.insertMany(attendanceRecords);
    }

    // Populate data
    await session.populate("class", "subject courseCode className");

    // Emit real-time event
    if (req.app.io) {
      if (status === "live") {
        req.app.io.emit("session-started", {
          sessionId: session._id,
          class: session.class,
        });
      } else {
        req.app.io.emit("session-scheduled", {
          sessionId: session._id,
          class: session.class,
          startTime: session.startTime,
        });
      }
    }

    res.status(201).json({
      status: "success",
      message:
        status === "live"
          ? "Session started successfully"
          : "Session scheduled successfully",
      data: {
        session,
      },
    });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Get active session
router.get("/active", protect, authorize("teacher"), async (req, res) => {
  try {
    const session = await Session.findOne({
      teacher: req.user._id,
      status: "live",
    })
      .populate("class", "subject courseCode className")
      .sort({ startTime: -1 });

    res.status(200).json({
      status: "success",
      data: {
        session,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Get sessions for a specific class
router.get(
  "/class/:classId",
  protect,
  authorize("teacher"),
  async (req, res) => {
    try {
      const { classId } = req.params;

      // Verify the teacher has access to this class
      const classDoc = await Class.findById(classId);
      if (!classDoc) {
        return res.status(404).json({
          status: "error",
          message: "Class not found",
        });
      }

      // Check authorization
      const isClassTeacher =
        classDoc.classTeacher?.toString() === req.user._id.toString();
      const isSubjectTeacher = classDoc.subjectTeachers?.some(
        (st) => st.teacher?.toString() === req.user._id.toString()
      );

      if (!isClassTeacher && !isSubjectTeacher) {
        return res.status(403).json({
          status: "error",
          message: "Not authorized to view sessions for this class",
        });
      }

      // Fetch all sessions for this class
      const sessions = await Session.find({ class: classId })
        .populate("class", "subject courseCode className")
        .populate("teacher", "name")
        .sort({ startTime: -1 });

      res.status(200).json({
        status: "success",
        results: sessions.length,
        data: { sessions },
      });
    } catch (error) {
      console.error("Get class sessions error:", error);
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  }
);

// End session
router.put("/:id/end", protect, authorize("teacher"), async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    if (session.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized",
      });
    }

    // Use sessionManager for proper cleanup
    const result = await sessionManager.endSession(
      req.params.id,
      "manual",
      req.user._id
    );

    if (!result.success) {
      return res.status(400).json({
        status: "error",
        message: result.error,
      });
    }

    // Emit real-time event
    if (req.app.io) {
      req.app.io.to(`session-${session._id}`).emit("session-ended", {
        sessionId: session._id,
        endedBy: req.user._id,
        stats: result.session,
      });
    }

    res.status(200).json({
      status: "success",
      message: "Session ended successfully",
      data: result.session,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// ========== HEARTBEAT ENDPOINT ==========
// Keep session alive and track participant presence
router.post("/:id/heartbeat", protect, async (req, res) => {
  try {
    const result = await sessionManager.recordHeartbeat(
      req.params.id,
      req.user._id
    );

    if (!result.success) {
      return res.status(400).json({
        status: "error",
        message: result.error,
      });
    }

    res.status(200).json({
      status: "success",
      message: "Heartbeat recorded",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// ========== FORCE END ENDPOINT ==========
// For emergency session termination (admin or recovery scenarios)
router.post(
  "/:id/force-end",
  protect,
  authorize("teacher"),
  async (req, res) => {
    try {
      const session = await Session.findById(req.params.id);

      if (!session) {
        return res.status(404).json({
          status: "error",
          message: "Session not found",
        });
      }

      // Only session owner or admin can force end
      if (
        session.teacher.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          status: "error",
          message: "Not authorized",
        });
      }

      const result = await sessionManager.endSession(
        req.params.id,
        "force_end",
        req.user._id
      );

      if (!result.success) {
        return res.status(400).json({
          status: "error",
          message: result.error,
        });
      }

      // Emit real-time event
      if (req.app.io) {
        req.app.io.to(`session-${session._id}`).emit("session-ended", {
          sessionId: session._id,
          endedBy: req.user._id,
          forced: true,
        });
      }

      res.status(200).json({
        status: "success",
        message: "Session force-ended successfully",
        data: result.session,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  }
);

// Get my sessions (active and history)
router.get("/my-sessions", protect, authorize("teacher"), async (req, res) => {
  try {
    const { classId, status, page = 1, limit = 20 } = req.query;

    let query = { teacher: req.user._id };

    if (classId) query.class = classId;
    if (status) query.status = status;

    const sessions = await Session.find(query)
      .populate("class", "subject courseCode className")
      .sort({ startTime: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Session.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: sessions.length,
      data: {
        sessions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Get student's active sessions (based on enrolled classes)
router.get(
  "/student/active",
  protect,
  authorize("student"),
  async (req, res) => {
    try {
      const studentId = req.user._id;

      // Find all classes the student is enrolled in
      const classes = await Class.find({
        "students.studentId": studentId,
      }).select("_id");

      const classIds = classes.map((c) => c._id);

      // Find active sessions for those classes
      const sessions = await Session.find({
        class: { $in: classIds },
        status: "live",
      })
        .populate("class", "subject courseCode className")
        .populate("teacher", "name")
        .sort({ startTime: -1 });

      // Get attendance status for each session
      const sessionsWithAttendance = await Promise.all(
        sessions.map(async (session) => {
          const attendance = await Attendance.findOne({
            session: session._id,
            student: studentId,
          });

          // Determine attendance status
          let attendanceStatus = "none";
          if (attendance) {
            if (attendance.status === "present" && attendance.isVerified) {
              attendanceStatus = "verified";
            } else if (attendance.status === "present") {
              attendanceStatus = "verified";
            } else if (attendance.hasAlert || attendance.status === "pending") {
              attendanceStatus = "pending";
            } else if (attendance.status === "absent" && attendance.markedBy) {
              attendanceStatus = "rejected";
            }
          }

          return {
            ...session.toObject(),
            attendanceStatus,
            attendanceId: attendance?._id || null,
          };
        })
      );

      res.status(200).json({
        status: "success",
        results: sessionsWithAttendance.length,
        data: {
          sessions: sessionsWithAttendance,
        },
      });
    } catch (error) {
      console.error("Get student active sessions error:", error);
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  }
);

// Get session history
router.get("/history", protect, authorize("teacher"), async (req, res) => {
  try {
    const { classId, status, startDate, endDate, limit = 20 } = req.query;

    let query = { teacher: req.user._id };

    if (classId) query.class = classId;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const sessions = await Session.find(query)
      .populate("class", "subject courseCode className")
      .sort({ startTime: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      status: "success",
      results: sessions.length,
      data: {
        sessions,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Get session details
router.get("/:id", protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate("class", "subject courseCode className")
      .populate("teacher", "name email");

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    const attendance = await Attendance.find({ session: session._id })
      .populate("student", "name usn email")
      .sort({ checkInTime: 1 });

    res.status(200).json({
      status: "success",
      data: {
        session,
        attendance,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Get student's upcoming sessions
router.get(
  "/student/upcoming",
  protect,
  authorize("student"),
  async (req, res) => {
    try {
      const studentId = req.user._id;
      const now = new Date();

      // Find all classes the student is enrolled in
      const classes = await Class.find({
        "students.studentId": studentId,
      }).select("_id");

      const classIds = classes.map((c) => c._id);

      // Find sessions that are scheduled for the future
      const sessions = await Session.find({
        class: { $in: classIds },
        startTime: { $gt: now },
        status: { $ne: "cancelled" },
      })
        .populate("class", "subject courseCode className")
        .populate("teacher", "name")
        .sort({ startTime: 1 })
        .limit(5);

      const formattedSessions = sessions.map((session) => {
        const start = new Date(session.startTime);
        const end = new Date(session.endTime);
        const diffMs = end - start;
        const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
        const diffHrs = Math.floor((diffMs % 86400000) / 3600000);
        let durationStr = "";
        if (diffHrs > 0) durationStr += `${diffHrs} hr `;
        if (diffMins > 0) durationStr += `${diffMins} min`;

        return {
          id: session._id,
          subject: session.class?.subject || session.topic,
          instructor: session.teacher?.name || "Unknown",
          room: session.location?.room || "N/A",
          floor: session.location?.floor || "N/A",
          startTime: start.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          duration: durationStr.trim() || "N/A",
          rawStartTime: session.startTime,
        };
      });

      res.status(200).json({
        status: "success",
        results: sessions.length,
        data: {
          sessions: formattedSessions,
        },
      });
    } catch (error) {
      console.error("Get student upcoming sessions error:", error);
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  }
);

module.exports = router;
