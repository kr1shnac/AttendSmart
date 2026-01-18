const Log = require("../models/Log");
const User = require("../models/User");
const cacheService = require("../services/CacheService"); // ADDED: For dashboard caching

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.role === "admin" ? null : req.user.id;
    const cacheKey = cacheService.dashboardKey("stats", userId || "global");

    // Use cache-through pattern for expensive queries
    const data = await cacheService.getOrCompute(
      cacheKey,
      async () => {
        // Date ranges
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const weekStart = new Date(now.setDate(now.getDate() - 7));
        const monthStart = new Date(now.setMonth(now.getMonth() - 1));

        // Build match query
        const matchQuery = userId ? { userId } : {};

        // Execute independent queries in parallel
        const [
          totalLogs,
          todayLogs,
          successfulLogs,
          activeUsers,
          actionsBreakdown,
          verificationMethods,
          activityTimeline,
          severityBreakdown,
          peakHours,
          recentActivity,
        ] = await Promise.all([
          // Total logs count
          Log.countDocuments(matchQuery),

          // Today's logs
          Log.countDocuments({
            ...matchQuery,
            timestamp: { $gte: todayStart },
          }),

          // Success rate (successful logs)
          Log.countDocuments({
            ...matchQuery,
            "metadata.success": true,
          }),

          // Active users (logged in last 24 hours)
          Log.distinct("userId", {
            action: "login",
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          }),

          // Actions breakdown (last 7 days)
          Log.aggregate([
            {
              $match: {
                ...matchQuery,
                timestamp: { $gte: weekStart },
              },
            },
            {
              $group: {
                _id: "$action",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ]),

          // Verification methods distribution
          Log.aggregate([
            {
              $match: {
                ...matchQuery,
                action: {
                  $in: ["face_scan", "fingerprint_scan", "ble_connect"],
                },
              },
            },
            {
              $group: {
                _id: "$action",
                count: { $sum: 1 },
              },
            },
          ]),

          // Activity over time (last 30 days)
          Log.aggregate([
            {
              $match: {
                ...matchQuery,
                timestamp: { $gte: monthStart },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
                },
                count: { $sum: 1 },
                successCount: {
                  $sum: { $cond: ["$metadata.success", 1, 0] },
                },
              },
            },
            { $sort: { _id: 1 } },
          ]),

          // Severity distribution
          Log.aggregate([
            {
              $match: matchQuery,
            },
            {
              $group: {
                _id: "$severity",
                count: { $sum: 1 },
              },
            },
          ]),

          // Peak activity hours
          Log.aggregate([
            {
              $match: {
                ...matchQuery,
                timestamp: { $gte: weekStart },
              },
            },
            {
              $group: {
                _id: { $hour: "$timestamp" },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ]),

          // Recent activity (using lean for performance)
          Log.find(matchQuery)
            .sort({ timestamp: -1 })
            .limit(10)
            .select(
              "userId action eventDescription timestamp severity metadata"
            )
            .populate("userId", "name email role profileImage")
            .lean(),
        ]);

        const successRate =
          totalLogs > 0 ? ((successfulLogs / totalLogs) * 100).toFixed(1) : 0;

        return {
          overview: {
            totalLogs,
            todayLogs,
            successRate: parseFloat(successRate),
            activeUsers: activeUsers.length,
          },
          actionsBreakdown,
          verificationMethods,
          activityTimeline,
          severityBreakdown,
          peakHours,
          recentActivity,
        };
      },
      cacheService.TTL.DASHBOARD // 5 minutes
    );

    res.status(200).json({
      status: "success",
      data,
      cached: true, // Indicate data may be cached
    });
  } catch (error) {
    console.error("❌ Get dashboard stats error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve dashboard statistics",
      error: error.message,
    });
  }
};

// @desc    Get bubble metrics data
// @route   GET /api/dashboard/bubble-metrics
// @access  Private
const getBubbleMetrics = async (req, res) => {
  try {
    const userId = req.user.role === "admin" ? null : req.user.id;
    const matchQuery = userId ? { userId } : {};

    // Calculate bubble metrics
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Execute bubble metric queries in parallel
    const [
      faceScanStats,
      fingerprintStats,
      bleStats,
      attendanceThisWeek,
      avgConfidence,
    ] = await Promise.all([
      // Face scan success rate
      Log.aggregate([
        {
          $match: {
            ...matchQuery,
            action: "face_scan",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successful: {
              $sum: { $cond: ["$metadata.success", 1, 0] },
            },
          },
        },
      ]),

      // Fingerprint scan success rate
      Log.aggregate([
        {
          $match: {
            ...matchQuery,
            action: "fingerprint_scan",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successful: {
              $sum: { $cond: ["$metadata.success", 1, 0] },
            },
          },
        },
      ]),

      // BLE connection rate
      Log.aggregate([
        {
          $match: {
            ...matchQuery,
            action: "ble_connect",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successful: {
              $sum: { $cond: ["$metadata.success", 1, 0] },
            },
          },
        },
      ]),

      // Attendance marking rate (this week)
      Log.countDocuments({
        ...matchQuery,
        action: "attendance_mark",
        timestamp: { $gte: weekStart },
      }),

      // Average confidence score
      Log.aggregate([
        {
          $match: {
            ...matchQuery,
            "metadata.confidence": { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            avgConfidence: { $avg: "$metadata.confidence" },
          },
        },
      ]),
    ]);

    const faceScanRate = faceScanStats[0]
      ? ((faceScanStats[0].successful / faceScanStats[0].total) * 100).toFixed(
          1
        )
      : 0;

    const fingerprintRate = fingerprintStats[0]
      ? (
          (fingerprintStats[0].successful / fingerprintStats[0].total) *
          100
        ).toFixed(1)
      : 0;

    const bleRate = bleStats[0]
      ? ((bleStats[0].successful / bleStats[0].total) * 100).toFixed(1)
      : 0;

    const confidenceScore = avgConfidence[0]
      ? (avgConfidence[0].avgConfidence * 100).toFixed(1)
      : 0;

    res.status(200).json({
      status: "success",
      data: {
        bubbleMetrics: [
          {
            id: "face-scan",
            label: "Face Recognition",
            value: parseFloat(faceScanRate),
            total: faceScanStats[0]?.total || 0,
            icon: "👤",
            color: "#00d4ff",
          },
          {
            id: "fingerprint",
            label: "Fingerprint",
            value: parseFloat(fingerprintRate),
            total: fingerprintStats[0]?.total || 0,
            icon: "👆",
            color: "#00ffd4",
          },
          {
            id: "ble",
            label: "BLE Connection",
            value: parseFloat(bleRate),
            total: bleStats[0]?.total || 0,
            icon: "📡",
            color: "#8b5cf6",
          },
          {
            id: "attendance",
            label: "Attendance (Week)",
            value: attendanceThisWeek,
            total: attendanceThisWeek,
            icon: "✅",
            color: "#10b981",
          },
          {
            id: "confidence",
            label: "Avg Confidence",
            value: parseFloat(confidenceScore),
            total: 100,
            icon: "🎯",
            color: "#3b82f6",
          },
        ],
      },
    });
  } catch (error) {
    console.error("❌ Get bubble metrics error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve bubble metrics",
      error: error.message,
    });
  }
};

// @desc    Get teacher analytics (for TeacherAnalytics page)
// @route   GET /api/dashboard/stats
// @access  Private (Teacher)
const getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { classId, dateRange } = req.query;

    // Get teacher's classes
    const Class = require("../models/Class");
    let classQuery = {
      $or: [
        { classTeacher: teacherId },
        { "subjectTeachers.teacher": teacherId },
      ],
      isActive: true,
    };
    if (classId && classId !== "all") {
      classQuery._id = classId;
    }

    const classes = await Class.find(classQuery).lean();
    const classIds = classes.map((c) => c._id);

    // 1. Overview Stats
    // 1. Overview Stats & 2. Class-wise Performance
    const Session = require("../models/Session");
    const Attendance = require("../models/Attendance");

    // Parallelize initial data gathering
    const [allSessions, allAttendanceStats, classWiseStats] = await Promise.all(
      [
        // Get all completed/live sessions count for these classes
        Session.countDocuments({
          class: { $in: classIds },
          status: { $in: ["completed", "live"] },
        }),

        // Get global attendance stats
        Attendance.aggregate([
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
              "sessionData.class": { $in: classIds },
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
        ]),

        // Get class-wise stats in one go
        Session.aggregate([
          {
            $match: {
              class: { $in: classIds },
              status: { $in: ["completed", "live"] },
            },
          },
          {
            $group: {
              _id: "$class",
              sessionCount: { $sum: 1 },
            },
          },
        ]),
      ]
    );

    // Get class-wise attendance in one go
    const classAttendanceAggregate = await Attendance.aggregate([
      {
        $lookup: {
          from: "sessions",
          localField: "session",
          foreignField: "_id",
          as: "sessionData",
        },
      },
      { $unwind: "$sessionData" },
      {
        $match: {
          "sessionData.class": { $in: classIds },
          "sessionData.status": "completed",
        },
      },
      {
        $group: {
          _id: "$sessionData.class",
          totalPresent: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          totalRecords: { $sum: 1 },
        },
      },
    ]);

    const totalSessions = allSessions;
    const totalStudents = classes.reduce(
      (sum, cls) => sum + cls.students.length,
      0
    );

    const avgAttendance =
      allAttendanceStats.length > 0 && allAttendanceStats[0].totalRecords > 0
        ? Math.round(
            (allAttendanceStats[0].totalPresent /
              allAttendanceStats[0].totalRecords) *
              100
          )
        : 0;

    // Map aggregated data back to classes
    const classWise = classes.map((cls) => {
      const sessionStat = classWiseStats.find(
        (s) => s._id.toString() === cls._id.toString()
      );
      const attStat = classAttendanceAggregate.find(
        (a) => a._id.toString() === cls._id.toString()
      );

      const classSessions = sessionStat ? sessionStat.sessionCount : 0;
      const classAvg =
        attStat && attStat.totalRecords > 0
          ? Math.round((attStat.totalPresent / attStat.totalRecords) * 100)
          : 0;

      return {
        class: cls.className,
        courseCode: cls.courseCode,
        sessions: classSessions,
        students: cls.students.length,
        attendance: classAvg,
      };
    });

    // 3. Weekly Trend (last 7 days)
    // 3. Weekly Trend (last 7 days)
    const weekTrend = [];
    const weekLabels = [];
    const weekStartDate = new Date();
    weekStartDate.setDate(weekStartDate.getDate() - 6);
    weekStartDate.setHours(0, 0, 0, 0);

    // Fetch daily stats in one go
    const dailyStats = await Session.aggregate([
      {
        $match: {
          class: { $in: classIds },
          status: "completed",
          startTime: { $gte: weekStartDate },
        },
      },
      {
        $lookup: {
          from: "attendances",
          localField: "_id",
          foreignField: "session",
          as: "attendanceData",
        },
      },
      {
        $project: {
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$startTime" },
          },
          totalStudents: { $size: "$attendanceData" }, // Assuming 1 record per student
          presentStudents: {
            $size: {
              $filter: {
                input: "$attendanceData",
                as: "att",
                cond: { $eq: ["$$att.status", "present"] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: "$date",
          dayTotal: { $sum: "$totalStudents" },
          dayPresent: { $sum: "$presentStudents" },
        },
      },
    ]);

    // Fill in the gaps for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

      const dayStat = dailyStats.find((d) => d._id === dateStr);
      const dayTotal = dayStat ? dayStat.dayTotal : 0;
      const dayPresent = dayStat ? dayStat.dayPresent : 0;
      const dayPercentage =
        dayTotal > 0 ? Math.round((dayPresent / dayTotal) * 100) : 0;

      weekLabels.push(
        date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
      weekTrend.push(dayPercentage);
    }

    // 4. Distribution
    const studentStats = await Attendance.aggregate([
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
          "sessionData.class": { $in: classIds },
          "sessionData.status": "completed",
        },
      },
      {
        $group: {
          _id: "$student",
          present: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      { $unwind: "$studentInfo" },
    ]);

    const distribution = [0, 0, 0, 0]; // 90-100, 75-89, 60-74, <60
    const topPerformers = [];
    const lowAttendance = [];

    studentStats.forEach((stat) => {
      const percentage =
        stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;

      if (percentage >= 90) distribution[0]++;
      else if (percentage >= 75) distribution[1]++;
      else if (percentage >= 60) distribution[2]++;
      else distribution[3]++;

      const studentData = {
        _id: stat._id,
        name: stat.studentInfo.name,
        usn: stat.studentInfo.usn,
        attendance: percentage,
        missed: stat.total - stat.present,
        streak: 0,
      };

      if (percentage >= 90) topPerformers.push(studentData);
      if (percentage < 75) lowAttendance.push(studentData);
    });

    topPerformers.sort((a, b) => b.attendance - a.attendance);
    lowAttendance.sort((a, b) => a.attendance - b.attendance);

    res.status(200).json({
      status: "success",
      data: {
        overview: {
          totalSessions,
          totalStudents,
          avgAttendance,
          totalClasses: classes.length,
        },
        classWise,
        weeklyTrend: {
          labels: weekLabels,
          data: weekTrend,
        },
        monthlyComparison: {
          labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
          data: [avgAttendance, avgAttendance, avgAttendance, avgAttendance], // Simplified
        },
        attendanceDistribution: {
          labels: ["90-100%", "75-89%", "60-74%", "Below 60%"],
          data: distribution,
        },
        topPerformers: topPerformers.slice(0, 25),
        lowAttendance: lowAttendance.slice(0, 25),
      },
    });
  } catch (error) {
    console.error("Get teacher analytics error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// @desc    Get class analytics
// @route   GET /api/dashboard/class/:id/analytics
// @access  Private
const getClassAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { dateRange } = req.query;

    const classDoc = await require("../models/Class").findById(id);
    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    // Check authorization
    if (classDoc.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized",
      });
    }

    // 1. Stats
    const totalSessions = await require("../models/Session").countDocuments({
      class: id,
      status: { $in: ["completed", "live"] },
    });

    const attendanceStats = await require("../models/Attendance").aggregate([
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

    const avgAttendance =
      attendanceStats.length > 0 && attendanceStats[0].totalRecords > 0
        ? Math.round(
            (attendanceStats[0].totalPresent /
              attendanceStats[0].totalRecords) *
              100
          )
        : 0;

    // 2. Attendance Trend (Last 7 sessions or by date)
    const sessions = await require("../models/Session")
      .find({
        class: id,
        status: "completed",
      })
      .sort({ startTime: 1 })
      .limit(10)
      .lean(); // Last 10 sessions - using lean() for performance

    const trendLabels = [];
    const trendData = [];

    // OPTIMIZED: Single aggregation instead of N+1 queries
    const sessionIds = sessions.map((s) => s._id);
    const sessionAttendanceStats =
      await require("../models/Attendance").aggregate([
        { $match: { session: { $in: sessionIds }, status: "present" } },
        { $group: { _id: "$session", presentCount: { $sum: 1 } } },
      ]);

    const attendanceMap = new Map(
      sessionAttendanceStats.map((s) => [s._id.toString(), s.presentCount])
    );
    const totalStudents = classDoc.students.length || 1;

    for (const session of sessions) {
      const sessionAttendance = attendanceMap.get(session._id.toString()) || 0;
      const percentage = Math.round((sessionAttendance / totalStudents) * 100);

      trendLabels.push(
        new Date(session.startTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      );
      trendData.push(percentage);
    }

    // 3. Distribution
    // Calculate average attendance for EACH student
    const studentStats = await require("../models/Attendance").aggregate([
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
          _id: "$student",
          present: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      { $unwind: "$studentInfo" },
    ]);

    const distribution = [0, 0, 0, 0]; // 90-100, 75-89, 60-74, <60
    const topPerformers = [];
    const atRiskStudents = [];

    studentStats.forEach((stat) => {
      const percentage =
        stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;

      if (percentage >= 90) distribution[0]++;
      else if (percentage >= 75) distribution[1]++;
      else if (percentage >= 60) distribution[2]++;
      else distribution[3]++;

      const studentData = {
        _id: stat._id,
        name: stat.studentInfo.name,
        usn: stat.studentInfo.usn,
        attendance: percentage,
        missed: stat.total - stat.present,
        streak: 0, // Placeholder
      };

      if (percentage >= 90) topPerformers.push(studentData);
      if (percentage < 75) atRiskStudents.push(studentData);
    });

    // Sort lists
    topPerformers.sort((a, b) => b.attendance - a.attendance);
    atRiskStudents.sort((a, b) => a.attendance - b.attendance);

    res.status(200).json({
      status: "success",
      data: {
        stats: {
          totalSessions,
          totalStudents: classDoc.students.length,
          avgAttendance,
        },
        attendanceTrend: {
          labels: trendLabels,
          data: trendData,
        },
        distribution: {
          data: distribution,
        },
        topPerformers: topPerformers.slice(0, 10),
        atRiskStudents: atRiskStudents.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("Get class analytics error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// @desc    Get student dashboard stats
// @route   GET /api/dashboard/student/stats
// @access  Private (Student)
const getStudentStats = async (req, res) => {
  try {
    const studentId = req.user._id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Calculate Overall Attendance Percentage
    const Class = require("../models/Class");
    const Session = require("../models/Session");
    const Attendance = require("../models/Attendance");

    const student = await User.findById(studentId).populate({
      path: "class",
      select:
        "className section academicYear department classTeacher subjectTeachers",
      populate: [
        { path: "classTeacher", select: "name" },
        { path: "subjectTeachers.subject", select: "subjectName subjectCode" },
        { path: "subjectTeachers.teacher", select: "name" },
      ],
    });

    const studentClasses = await Class.find({
      "students.studentId": studentId,
    }).select("_id");
    const classIds = studentClasses.map((c) => c._id);

    const totalClasses = await Session.countDocuments({
      class: { $in: classIds },
      status: "completed",
    });

    const presentClasses = await Attendance.countDocuments({
      student: studentId,
      status: "present",
    });

    const attendancePercentage =
      totalClasses > 0 ? ((presentClasses / totalClasses) * 100).toFixed(1) : 0;

    // 2. Today's Classes
    const todayClasses = await Session.countDocuments({
      class: { $in: classIds },
      startTime: { $gte: todayStart, $lte: todayEnd },
    });

    // 3. Streak (Simplified: check last 5 records for contiguous dates)
    const lastAttendance = await Attendance.aggregate([
      {
        $match: {
          student: studentId,
          status: "present",
        },
      },
      {
        $lookup: {
          from: "sessions",
          localField: "session",
          foreignField: "_id",
          as: "session",
        },
      },
      { $unwind: "$session" },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$session.startTime" },
          },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 10 },
    ]);

    let streak = 0;
    if (lastAttendance.length > 0) {
      streak = lastAttendance.length;
    }

    res.status(200).json({
      status: "success",
      data: {
        attendancePercentage: parseFloat(attendancePercentage),
        totalClasses,
        presentClasses,
        streak,
        todayClasses,
        classDetails: student ? student.class : null,
      },
    });
  } catch (error) {
    console.error("Get student stats error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// @desc    Get student weekly attendance for chart
// @route   GET /api/dashboard/student/weekly
// @access  Private (Student)
const getStudentWeeklyAttendance = async (req, res) => {
  try {
    const studentId = req.user._id;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const Attendance = require("../models/Attendance");

    const attendanceData = await Attendance.aggregate([
      {
        $match: {
          student: studentId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $lookup: {
          from: "sessions",
          localField: "session",
          foreignField: "_id",
          as: "session",
        },
      },
      { $unwind: "$session" },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$session.startTime" },
          },
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const result = { labels: [], data: [] };
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayData = attendanceData.find((a) => a._id === dateStr);

      result.labels.push(dayName);
      if (dayData && dayData.total > 0) {
        result.data.push(Math.round((dayData.present / dayData.total) * 100));
      } else {
        result.data.push(0);
      }
    }

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("Get student weekly error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// @desc    Get student subjects with teacher details
// @route   GET /api/dashboard/student/subjects
// @access  Private (Student)
const getStudentSubjects = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Find student to get class ID
    const student = await User.findById(studentId);
    if (!student.class) {
      return res.status(200).json({
        status: "success",
        data: { subjects: [], classTeacher: null },
      });
    }

    // Find class and populate subjects, teachers, and class teacher
    const Class = require("../models/Class");
    const classDoc = await Class.findById(student.class)
      .populate({
        path: "classTeacher",
        select: "name email phone",
      })
      .populate({
        path: "subjectTeachers.teacher",
        select: "name email phone",
      })
      .populate({
        path: "subjectTeachers.subject",
        select: "subjectName subjectCode description",
      });

    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    // Format response
    const subjects = classDoc.subjectTeachers.map((st) => ({
      subjectName: st.subject?.subjectName || "Unknown",
      subjectCode: st.subject?.subjectCode || "N/A",
      description: st.subject?.description || "",
      teacherName: st.teacher?.name || "Not Assigned",
      teacherEmail: st.teacher?.email || "",
      teacherPhone: st.teacher?.phone || "",
      teacherId: st.teacher?._id?.toString() || null,
    }));

    // Check if class teacher is also teaching a subject in this class
    const classTeacherId = classDoc.classTeacher?._id?.toString();
    const isClassTeacherSubjectTeacher = subjects.some(
      (s) => s.teacherId === classTeacherId
    );

    // Format class teacher info
    const classTeacher = classDoc.classTeacher
      ? {
          name: classDoc.classTeacher.name,
          email: classDoc.classTeacher.email || "",
          phone: classDoc.classTeacher.phone || "",
          isAlsoSubjectTeacher: isClassTeacherSubjectTeacher,
        }
      : null;

    res.status(200).json({
      status: "success",
      data: { subjects, classTeacher },
    });
  } catch (error) {
    console.error("Get student subjects error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getBubbleMetrics,
  getTeacherAnalytics,
  getClassAnalytics,
  getStudentStats,
  getStudentWeeklyAttendance,
  getStudentSubjects,
};
