/**
 * Settings Controller
 * Handles campus location and other system settings
 */

const Settings = require("../models/Settings");
const Log = require("../models/Log");

/**
 * Get campus location settings
 * @route GET /api/settings/location
 * @access All authenticated users
 */
exports.getCampusLocation = async (req, res) => {
  try {
    const campusLocation = await Settings.getCampusLocation();

    res.status(200).json({
      status: "success",
      data: {
        campusLocation,
      },
    });
  } catch (error) {
    console.error("Get campus location error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch campus location",
      error: error.message,
    });
  }
};

/**
 * Update campus location settings
 * @route PUT /api/settings/location
 * @access Admin only
 */
exports.updateCampusLocation = async (req, res) => {
  try {
    const { latitude, longitude, radius, name } = req.body;

    console.log("[Settings] Update request:", {
      latitude,
      longitude,
      radius,
      name,
    });

    // Validate required fields - check for undefined/null, not falsy
    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null
    ) {
      return res.status(400).json({
        status: "error",
        message: "Latitude and longitude are required",
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Validate coordinate ranges
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        status: "error",
        message: "Invalid latitude. Must be between -90 and 90",
      });
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        status: "error",
        message: "Invalid longitude. Must be between -180 and 180",
      });
    }

    // Get admin ID - handle both environment-based and database admins
    const adminId = req.user._id === "admin" ? null : req.user._id;

    const campusLocation = await Settings.updateCampusLocation(
      {
        latitude: lat,
        longitude: lng,
        radius: parseInt(radius) || 500,
        name: name || "Main Campus",
      },
      adminId
    );

    // Log the action - only if we have a valid user ID
    try {
      await Log.create({
        userId: adminId || undefined,
        userRole: "admin",
        action: "settings_update",
        eventDescription: `Campus location updated: ${
          name || "Main Campus"
        } (${lat}, ${lng})`,
        metadata: {
          latitude: lat,
          longitude: lng,
          radius: parseInt(radius) || 500,
          ipAddress: req.ip,
          success: true,
        },
        severity: "info",
      });
    } catch (logError) {
      // Don't fail the request if logging fails
      console.warn("Failed to create log entry:", logError.message);
    }

    console.log("[Settings] Location saved successfully:", campusLocation);

    res.status(200).json({
      status: "success",
      message: "Campus location updated successfully",
      data: {
        campusLocation,
      },
    });
  } catch (error) {
    console.error("Update campus location error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update campus location",
      error: error.message,
    });
  }
};
