/**
 * Settings Model
 * Stores system-wide settings like campus location
 */

const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema(
  {
    // Setting identifier
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ["campus_location"],
    },

    // Campus location data
    campusLocation: {
      latitude: {
        type: Number,
        default: 12.9716, // Default: Bangalore
      },
      longitude: {
        type: Number,
        default: 77.5946,
      },
      radius: {
        type: Number,
        default: 500, // meters
      },
      name: {
        type: String,
        default: "Main Campus",
      },
    },

    // Audit trail
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get or create campus location settings
SettingsSchema.statics.getCampusLocation = async function () {
  let settings = await this.findOne({ key: "campus_location" });

  if (!settings) {
    // Create default settings if not exists
    settings = await this.create({
      key: "campus_location",
      campusLocation: {
        latitude: 12.9716,
        longitude: 77.5946,
        radius: 500,
        name: "Main Campus",
      },
    });
  }

  return settings.campusLocation;
};

// Static method to update campus location
SettingsSchema.statics.updateCampusLocation = async function (
  locationData,
  adminId
) {
  const settings = await this.findOneAndUpdate(
    { key: "campus_location" },
    {
      key: "campus_location",
      campusLocation: {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        radius: locationData.radius || 500,
        name: locationData.name || "Main Campus",
      },
      updatedBy: adminId,
    },
    { upsert: true, new: true }
  );

  return settings.campusLocation;
};

module.exports = mongoose.model("Settings", SettingsSchema);
