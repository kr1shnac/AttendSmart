const BLEDevice = require("../models/BLEDevice");
const BLEScanRecord = require("../models/BLEScanRecord");
const Log = require("../models/Log");
const { v4: uuidv4 } = require("uuid");

// @desc    Register/Update BLE device
// @route   POST /api/ble/device/register
// @access  Private
const registerDevice = async (req, res) => {
  try {
    const { deviceId, deviceName, deviceType, location } = req.body;

    let device = await BLEDevice.findOne({ deviceId });

    if (device) {
      // Update existing device
      device.deviceName = deviceName || device.deviceName;
      device.location = location || device.location;
      device.lastSeen = new Date();
      device.isActive = true;

      await device.save();

      return res.status(200).json({
        status: "success",
        message: "Device updated successfully",
        data: { device },
      });
    }

    // Create new device
    const beaconUUID = uuidv4(); // Generate unique UUID for beacon

    device = await BLEDevice.create({
      deviceId,
      deviceName,
      deviceType: deviceType || "student_scanner",
      userId: req.user.id,
      beaconUUID,
      location,
    });

    // Log device registration
    await Log.create({
      userId: req.user.id,
      userRole: req.user.role,
      action: "ble_connect",
      eventDescription: `BLE device registered: ${deviceName}`,
      metadata: {
        deviceId,
        deviceType,
        success: true,
      },
      severity: "info",
    });

    res.status(201).json({
      status: "success",
      message: "Device registered successfully",
      data: { device },
    });
  } catch (error) {
    console.error("❌ Register device error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to register device",
      error: error.message,
    });
  }
};

// @desc    Start BLE session (teacher broadcasts beacon)
// @route   POST /api/ble/session/start
// @access  Private (Teacher only)
const startBLESession = async (req, res) => {
  try {
    const { deviceId, sessionName, room, duration } = req.body;

    const device = await BLEDevice.findOne({
      deviceId,
      userId: req.user.id,
    });

    if (!device) {
      return res.status(404).json({
        status: "error",
        message: "Device not found or unauthorized",
      });
    }

    // Calculate session times
    const startTime = new Date();
    const endTime = new Date(
      startTime.getTime() + (duration || 60) * 60 * 1000
    );

    // Generate session ID
    const sessionId = `${room}_${Date.now()}`;

    // Start session on device
    await device.startSession({
      sessionId,
      sessionName,
      room,
      startTime,
      endTime,
    });

    // Log session start
    await Log.create({
      userId: req.user.id,
      userRole: req.user.role,
      action: "system_event",
      eventDescription: `BLE session started: ${sessionName} in ${room}`,
      metadata: {
        sessionId,
        beaconUUID: device.beaconUUID,
        room,
        success: true,
      },
      severity: "info",
    });

    // Emit real-time event
    const io = req.app.get("io");
    if (io) {
      io.emit("ble-session-started", {
        sessionId,
        sessionName,
        room,
        beaconUUID: device.beaconUUID,
        teacherId: req.user.id,
      });
    }

    res.status(200).json({
      status: "success",
      message: "BLE session started successfully",
      data: {
        sessionId,
        beaconUUID: device.beaconUUID,
        room,
        startTime,
        endTime,
      },
    });
  } catch (error) {
    console.error("❌ Start BLE session error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to start BLE session",
      error: error.message,
    });
  }
};

// @desc    Stop BLE session
// @route   POST /api/ble/session/stop
// @access  Private (Teacher only)
const stopBLESession = async (req, res) => {
  try {
    const { deviceId } = req.body;

    const device = await BLEDevice.findOne({
      deviceId,
      userId: req.user.id,
    });

    if (!device) {
      return res.status(404).json({
        status: "error",
        message: "Device not found",
      });
    }

    const sessionId = device.activeSession?.sessionId;

    await device.stopSession();

    // Log session stop
    await Log.create({
      userId: req.user.id,
      userRole: req.user.role,
      action: "system_event",
      eventDescription: `BLE session stopped: ${device.activeSession?.sessionName}`,
      metadata: {
        sessionId,
        success: true,
      },
      severity: "info",
    });

    // Emit real-time event
    const io = req.app.get("io");
    if (io) {
      io.emit("ble-session-stopped", {
        sessionId,
        deviceId,
      });
    }

    res.status(200).json({
      status: "success",
      message: "BLE session stopped successfully",
    });
  } catch (error) {
    console.error("❌ Stop BLE session error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to stop BLE session",
      error: error.message,
    });
  }
};

// @desc    Record BLE scan (student detects beacon)
// @route   POST /api/ble/scan/record
// @access  Private
const recordBLEScan = async (req, res) => {
  try {
    const {
      studentDeviceId,
      beaconUUID,
      beaconDeviceId,
      sessionId,
      rssi,
      txPower,
      metadata,
    } = req.body;

    // Create scan record
    const scanRecord = await BLEScanRecord.create({
      studentId: req.user.id,
      studentDeviceId,
      beaconDeviceId,
      beaconUUID,
      sessionId,
      sessionName: req.body.sessionName,
      room: req.body.room,
      rssi,
      txPower: txPower || -59,
      metadata,
    });

    // Update device stats
    const device = await BLEDevice.findOne({ deviceId: studentDeviceId });
    if (device) {
      await device.updateStats("scan");
    }

    // Log scan if proximity verified
    if (scanRecord.isWithinRange) {
      await Log.create({
        userId: req.user.id,
        userRole: req.user.role,
        action: "ble_connect",
        eventDescription: `Proximity verified: ${scanRecord.distance.toFixed(
          2
        )}m away`,
        metadata: {
          sessionId,
          distance: scanRecord.distance,
          rssi,
          confidence: scanRecord.proximityConfidence,
          success: true,
        },
        severity: "success",
      });
    }

    res.status(201).json({
      status: "success",
      message: "Scan recorded successfully",
      data: {
        distance: scanRecord.distance.toFixed(2),
        isWithinRange: scanRecord.isWithinRange,
        proximityConfidence: scanRecord.proximityConfidence,
        signalQuality: scanRecord.signalQuality,
      },
    });
  } catch (error) {
    console.error("❌ Record BLE scan error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to record scan",
      error: error.message,
    });
  }
};

// @desc    Get active BLE sessions
// @route   GET /api/ble/sessions/active
// @access  Private
const getActiveSessions = async (req, res) => {
  try {
    const activeSessions = await BLEDevice.find({
      "activeSession.isActive": true,
      isActive: true,
    }).populate("userId", "name email role");

    res.status(200).json({
      status: "success",
      data: {
        count: activeSessions.length,
        sessions: activeSessions,
      },
    });
  } catch (error) {
    console.error("❌ Get active sessions error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve sessions",
      error: error.message,
    });
  }
};

// @desc    Get BLE device info
// @route   GET /api/ble/device/:deviceId
// @access  Private
const getDeviceInfo = async (req, res) => {
  try {
    const device = await BLEDevice.findOne({
      deviceId: req.params.deviceId,
    }).populate("userId", "name email role");

    if (!device) {
      return res.status(404).json({
        status: "error",
        message: "Device not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: { device },
    });
  } catch (error) {
    console.error("❌ Get device info error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve device info",
      error: error.message,
    });
  }
};

// @desc    Get proximity analytics
// @route   GET /api/ble/analytics/proximity
// @access  Private
const getProximityAnalytics = async (req, res) => {
  try {
    const { sessionId, timeRange = 24 } = req.query;

    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    const match = { scanTime: { $gte: startTime } };
    if (sessionId) match.sessionId = sessionId;

    const analytics = await BLEScanRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            sessionId: "$sessionId",
            studentId: "$studentId",
          },
          avgDistance: { $avg: "$distance" },
          avgRSSI: { $avg: "$rssi" },
          scanCount: { $sum: 1 },
          withinRangeCount: {
            $sum: { $cond: ["$isWithinRange", 1, 0] },
          },
        },
      },
      {
        $project: {
          sessionId: "$_id.sessionId",
          studentId: "$_id.studentId",
          avgDistance: { $round: ["$avgDistance", 2] },
          avgRSSI: { $round: ["$avgRSSI", 0] },
          scanCount: 1,
          withinRangePercentage: {
            $round: [
              {
                $multiply: [
                  { $divide: ["$withinRangeCount", "$scanCount"] },
                  100,
                ],
              },
              1,
            ],
          },
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      data: { analytics },
    });
  } catch (error) {
    console.error("❌ Get proximity analytics error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve analytics",
      error: error.message,
    });
  }
};

module.exports = {
  registerDevice,
  startBLESession,
  stopBLESession,
  recordBLEScan,
  getActiveSessions,
  getDeviceInfo,
  getProximityAnalytics,
};
