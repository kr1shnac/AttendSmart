/**
 * Device Guard Middleware - Device Fingerprinting & Locking
 *
 * Security middleware that locks users to trusted devices.
 * Prevents account sharing and unauthorized access.
 *
 * Features:
 * - First login: Device becomes trusted automatically
 * - Subsequent logins: Must match trusted device
 * - Admin override: Can reset trusted device
 *
 * @module middleware/deviceGuard
 * @version 1.0.0
 */

const User = require("../models/User");

// ============================================
// CONFIGURATION
// ============================================

// Enable/disable device locking (useful for testing)
const DEVICE_LOCK_ENABLED = process.env.DEVICE_LOCK_ENABLED !== "false";

// Roles that require device locking
const LOCKED_ROLES = ["student"]; // Teachers/admins can login from any device

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Validate device on login
 * Add this middleware AFTER authentication in login route
 *
 * Expected: req.body.deviceId (UUID from Capacitor/client)
 * Required: req.user (from previous auth middleware)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const validateDevice = async (req, res, next) => {
  // Skip if device locking is disabled
  if (!DEVICE_LOCK_ENABLED) {
    return next();
  }

  try {
    const { deviceId, platform, deviceModel } = req.body;
    const user = req.user;

    // Skip for roles that don't require device locking
    if (!LOCKED_ROLES.includes(user.role)) {
      console.log(`ℹ️ [DeviceGuard] Skipping for ${user.role} role`);
      return next();
    }

    // Require device ID for locked roles
    if (!deviceId) {
      console.warn(
        `⚠️ [DeviceGuard] No deviceId provided for user ${user._id}`
      );
      return res.status(400).json({
        status: "error",
        code: "DEVICE_ID_REQUIRED",
        message: "Device identification required. Please update your app.",
      });
    }

    // ============================================
    // FIRST LOGIN: Register Device
    // ============================================

    if (!user.trustedDeviceId) {
      console.log(
        `📱 [DeviceGuard] First login - registering device for user ${user._id}`
      );

      await User.findByIdAndUpdate(user._id, {
        trustedDeviceId: deviceId,
        trustedDevicePlatform: platform || "unknown",
        trustedDeviceModel: deviceModel || null,
        trustedDeviceRegisteredAt: new Date(),
      });

      // Continue with login
      return next();
    }

    // ============================================
    // SUBSEQUENT LOGIN: Validate Device
    // ============================================

    if (user.trustedDeviceId !== deviceId) {
      console.warn(`🚫 [DeviceGuard] Device mismatch for user ${user._id}`);
      console.warn(`   └─ Expected: ${user.trustedDeviceId}`);
      console.warn(`   └─ Received: ${deviceId}`);

      // Log this attempt for security audit
      const Log = require("../models/Log");
      await Log.create({
        userId: user._id,
        userRole: user.role,
        action: "unauthorized_device_login",
        eventDescription: "Login attempt from unauthorized device",
        severity: "warning",
        metadata: {
          ipAddress: req.ip,
          attemptedDeviceId: deviceId,
          trustedDeviceId: user.trustedDeviceId,
          userAgent: req.headers["user-agent"],
        },
      });

      return res.status(403).json({
        status: "error",
        code: "UNAUTHORIZED_DEVICE",
        message:
          "Unauthorized device. Please use your registered device or contact admin.",
        support: {
          action: "Contact your administrator to reset your trusted device.",
          reason: "For security, your account is locked to a specific device.",
        },
      });
    }

    // Device matches - continue
    console.log(`✅ [DeviceGuard] Device verified for user ${user._id}`);
    next();
  } catch (error) {
    console.error("❌ [DeviceGuard] Error:", error.message);
    // Don't block login on middleware error - just log and continue
    next();
  }
};

/**
 * Reset a user's trusted device (Admin action)
 *
 * @param {string} userId - User ID to reset
 * @param {string} adminId - Admin performing the action
 * @returns {Object} Result
 */
const resetTrustedDevice = async (userId, adminId) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $unset: {
          trustedDeviceId: 1,
          trustedDevicePlatform: 1,
          trustedDeviceModel: 1,
          trustedDeviceRegisteredAt: 1,
        },
      },
      { new: true }
    );

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Log the action
    const Log = require("../models/Log");
    await Log.create({
      userId: adminId,
      userRole: "admin",
      action: "reset_trusted_device",
      eventDescription: `Admin reset trusted device for user ${userId}`,
      severity: "info",
      metadata: {
        targetUserId: userId,
        targetUserName: user.name,
      },
    });

    console.log(
      `🔄 [DeviceGuard] Trusted device reset for user ${userId} by admin ${adminId}`
    );

    return {
      success: true,
      message: "Trusted device reset successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    };
  } catch (error) {
    console.error("❌ [DeviceGuard] Reset error:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get device info for a user (Admin view)
 *
 * @param {string} userId - User ID
 * @returns {Object} Device info
 */
const getDeviceInfo = async (userId) => {
  try {
    const user = await User.findById(userId).select(
      "name email trustedDeviceId trustedDevicePlatform trustedDeviceModel trustedDeviceRegisteredAt"
    );

    if (!user) {
      return null;
    }

    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      hasDevice: !!user.trustedDeviceId,
      device: user.trustedDeviceId
        ? {
            id: user.trustedDeviceId,
            platform: user.trustedDevicePlatform,
            model: user.trustedDeviceModel,
            registeredAt: user.trustedDeviceRegisteredAt,
          }
        : null,
    };
  } catch (error) {
    console.error("❌ [DeviceGuard] GetInfo error:", error.message);
    return null;
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  validateDevice,
  resetTrustedDevice,
  getDeviceInfo,

  // Constants for testing
  DEVICE_LOCK_ENABLED,
  LOCKED_ROLES,
};
