const Log = require("../models/Log");
const User = require("../models/User");

// @desc    Create new log entry
// @route   POST /api/logs
// @access  Private
const createLog = async (req, res) => {
  try {
    const {
      action,
      eventDescription,
      metadata = {},
      severity = "info",
    } = req.body;

    // Validate required fields
    if (!action || !eventDescription) {
      return res.status(400).json({
        status: "error",
        message: "Action and event description are required",
      });
    }

    // Create log entry
    const log = await Log.create({
      userId: req.user.id,
      userRole: req.user.role,
      action,
      eventDescription,
      metadata: {
        ...metadata,
        ipAddress: req.ip,
        deviceType: req.headers["user-agent"]?.includes("Mobile")
          ? "mobile"
          : "desktop",
        browser: req.headers["user-agent"]?.split(" ")[0] || "Unknown",
      },
      severity,
      timestamp: new Date(),
    });

    // Emit real-time event via Socket.io
    const io = req.app.get("io");
    io.emit("new-log", {
      id: log._id,
      action: log.action,
      description: log.eventDescription,
      user: req.user.name,
      role: log.userRole,
      severity: log.severity,
      timestamp: log.timestamp,
    });

    res.status(201).json({
      status: "success",
      data: { log },
    });
  } catch (error) {
    console.error("❌ Create log error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create log entry",
      error: error.message,
    });
  }
};

// @desc    Get all logs with filters and pagination
// @route   GET /api/logs
// @access  Private
const getLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      severity,
      userId,
      startDate,
      endDate,
      search,
    } = req.query;

    // Build filter object
    const filter = {};

    if (action) filter.action = action;
    if (severity) filter.severity = severity;
    if (userId) filter.userId = userId;

    // Date range filter
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    // Search in event description
    if (search) {
      filter.eventDescription = { $regex: search, $options: "i" };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const logs = await Log.find(filter)
      .populate("userId", "name email role profileImage")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalLogs = await Log.countDocuments(filter);

    res.status(200).json({
      status: "success",
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalLogs / parseInt(limit)),
          totalLogs,
          logsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("❌ Get logs error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve logs",
      error: error.message,
    });
  }
};

// @desc    Get single log by ID
// @route   GET /api/logs/:id
// @access  Private
const getLogById = async (req, res) => {
  try {
    const log = await Log.findById(req.params.id).populate(
      "userId",
      "name email role profileImage"
    );

    if (!log) {
      return res.status(404).json({
        status: "error",
        message: "Log not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: { log },
    });
  } catch (error) {
    console.error("❌ Get log by ID error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve log",
      error: error.message,
    });
  }
};

// @desc    Get log statistics
// @route   GET /api/logs/stats
// @access  Private
const getLogStats = async (req, res) => {
  try {
    const { userId, days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const match = { timestamp: { $gte: startDate } };
    if (userId) match.userId = mongoose.Types.ObjectId(userId);

    // Aggregate statistics
    const stats = await Log.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            action: "$action",
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          },
          count: { $sum: 1 },
          successCount: { $sum: { $cond: ["$metadata.success", 1, 0] } },
          failureCount: { $sum: { $cond: ["$metadata.success", 0, 1] } },
        },
      },
      { $sort: { "_id.date": -1, count: -1 } },
    ]);

    // Total counts by severity
    const severityCounts = await Log.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 },
        },
      },
    ]);

    // Activity by hour (for heat map)
    const hourlyActivity = await Log.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      status: "success",
      data: {
        stats,
        severityCounts,
        hourlyActivity,
        totalLogs: await Log.countDocuments(match),
      },
    });
  } catch (error) {
    console.error("❌ Get log stats error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve log statistics",
      error: error.message,
    });
  }
};

// @desc    Delete old logs (cleanup)
// @route   DELETE /api/logs/cleanup
// @access  Admin only
const cleanupLogs = async (req, res) => {
  try {
    const { days = 90 } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const result = await Log.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    res.status(200).json({
      status: "success",
      message: `Deleted ${result.deletedCount} logs older than ${days} days`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    console.error("❌ Cleanup logs error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to cleanup logs",
      error: error.message,
    });
  }
};

module.exports = {
  createLog,
  getLogs,
  getLogById,
  getLogStats,
  cleanupLogs,
};
