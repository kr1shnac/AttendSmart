const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getBubbleMetrics,
  getTeacherAnalytics,
} = require("../controllers/dashboardController");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

router.get("/stats", getDashboardStats);
router.get("/bubble-metrics", getBubbleMetrics);
router.get(
  "/student/stats",
  require("../controllers/dashboardController").getStudentStats
);
router.get(
  "/student/weekly",
  require("../controllers/dashboardController").getStudentWeeklyAttendance
);
router.get(
  "/student/subjects",
  require("../controllers/dashboardController").getStudentSubjects
);
router.get(
  "/class/:id/analytics",
  require("../controllers/dashboardController").getClassAnalytics
);

module.exports = router;
