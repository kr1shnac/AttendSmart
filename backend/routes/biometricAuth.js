const express = require("express");
const router = express.Router();
const { login, faceLogin } = require("../controllers/authController");
const {
  registerBiometricOptions,
  registerBiometricVerify,
  loginBiometricOptions,
  loginBiometricVerify,
  loginManual,
  loginTeacher,
} = require("../controllers/biometricAuthController");

// ✅ Main login endpoint - handles all user types
router.post("/login", login);

// ✅ NEW: Face-based login for students
router.post("/face-login", faceLogin);

// Student biometric registration
router.post("/student/biometric/register-options", registerBiometricOptions);
router.post("/student/biometric/register-verify", registerBiometricVerify);

// Student biometric login
router.post("/student/biometric/login-options", loginBiometricOptions);
router.post("/student/biometric/login-verify", loginBiometricVerify);

// Student manual login (fallback)
router.post("/student/login-manual", loginManual);

// Teacher/Admin login
router.post("/teacher/login", loginTeacher);

module.exports = router;
