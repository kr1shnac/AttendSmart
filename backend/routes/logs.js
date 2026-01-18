const express = require("express");
const router = express.Router();
const {
  createLog,
  getLogs,
  getLogById,
  getLogStats,
  cleanupLogs,
} = require("../controllers/logController");
const { protect, authorize } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// Log CRUD operations
router
  .route("/")
  .get(getLogs) // GET /api/logs
  .post(createLog); // POST /api/logs

router.get("/stats", getLogStats); // GET /api/logs/stats

router.get("/:id", getLogById); // GET /api/logs/:id

// Admin only - cleanup
router.delete("/cleanup", authorize("admin"), cleanupLogs);

module.exports = router;
