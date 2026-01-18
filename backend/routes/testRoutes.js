const express = require("express");
const router = express.Router();

// @desc    Test route - Health check
// @route   GET /api/test/health
// @access  Public
router.get("/health", (req, res) => {
  res.json({
    status: "success",
    message: "Test routes working",
    timestamp: new Date().toISOString(),
  });
});

// @desc    Test route - Root
// @route   GET /api/test/
// @access  Public
router.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "API test endpoint active",
  });
});

module.exports = router;
