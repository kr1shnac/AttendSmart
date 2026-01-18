/**
 * Settings Routes
 * Handles campus location and system settings
 */

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const settingsController = require("../controllers/settingsController");

// Get campus location - all authenticated users
router.get("/location", protect, settingsController.getCampusLocation);

// Update campus location - admin only
router.put(
  "/location",
  protect,
  authorize("admin"),
  settingsController.updateCampusLocation
);

module.exports = router;
