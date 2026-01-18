const express = require("express");
const router = express.Router();
const {
  registerDevice,
  startBLESession,
  stopBLESession,
  recordBLEScan,
  getActiveSessions,
  getDeviceInfo,
  getProximityAnalytics,
} = require("../controllers/bleController");
const { protect, authorize } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// Device management
router.post("/device/register", registerDevice);
router.get("/device/:deviceId", getDeviceInfo);

// Session management (Teacher only)
router.post("/session/start", authorize("teacher", "admin"), startBLESession);
router.post("/session/stop", authorize("teacher", "admin"), stopBLESession);
router.get("/sessions/active", getActiveSessions);

// Scan recording (Students)
router.post("/scan/record", recordBLEScan);

// Analytics
router.get("/analytics/proximity", getProximityAnalytics);

module.exports = router;
