/**
 * GPS Native Service
 * Handles geolocation for campus/classroom verification using Capacitor
 */

import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

class GPSNativeService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.currentPosition = null;
    this.watchId = null;

    // Configuration
    this.config = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
      // Campus boundaries (example - replace with actual coordinates)
      campusBoundary: {
        center: { latitude: 12.9716, longitude: 77.5946 }, // Example: Bangalore
        radius: 500, // meters
      },
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Get current position using Capacitor Geolocation
   */
  async getCurrentPosition() {
    try {
      console.log("[GPS] Getting current position...");

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: this.config.enableHighAccuracy,
        timeout: this.config.timeout,
        maximumAge: this.config.maximumAge,
      });

      this.currentPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: new Date(position.timestamp).toISOString(),
      };

      console.log("[GPS] Position obtained:", this.currentPosition);
      return this.currentPosition;
    } catch (error) {
      console.error("[GPS] Error getting position:", error);
      throw error;
    }
  }

  /**
   * Start watching position changes
   */
  async startWatching(callback) {
    try {
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: this.config.enableHighAccuracy,
          timeout: this.config.timeout,
          maximumAge: this.config.maximumAge,
        },
        (position, err) => {
          if (err) {
            console.error("[GPS] Watch error:", err);
            return;
          }

          this.currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            timestamp: new Date(position.timestamp).toISOString(),
          };

          if (callback) {
            callback(this.currentPosition);
          }
        }
      );

      console.log("[GPS] Started watching position");
      return this.watchId;
    } catch (error) {
      console.error("[GPS] Error starting watch:", error);
      throw error;
    }
  }

  /**
   * Stop watching position
   */
  async stopWatching() {
    if (this.watchId !== null) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
      console.log("[GPS] Stopped watching position");
    }
  }

  /**
   * Set campus center coordinates
   */
  setCampusCenter(latitude, longitude, radius = 500) {
    this.config.campusBoundary = {
      center: { latitude, longitude },
      radius,
    };
    console.log("[GPS] Campus center set:", this.config.campusBoundary);
  }

  /**
   * Verify if user is within campus boundary
   */
  async verifyCampusLocation(campusCenter = null, radius = null) {
    const center = campusCenter || this.config.campusBoundary.center;
    const maxRadius = radius || this.config.campusBoundary.radius;

    try {
      const position = await this.getCurrentPosition();

      const distance = this.calculateDistance(
        position.latitude,
        position.longitude,
        center.latitude,
        center.longitude
      );

      const isWithinCampus = distance <= maxRadius;
      const confidence = isWithinCampus
        ? Math.max(0, Math.min(100, 100 - (distance / maxRadius) * 50))
        : 0;

      return {
        verified: isWithinCampus,
        confidence: Math.round(confidence),
        distance: Math.round(distance),
        accuracy: Math.round(position.accuracy),
        position: position,
        message: isWithinCampus
          ? `Within campus (${Math.round(distance)}m from center)`
          : `Outside campus boundary (${Math.round(distance)}m away)`,
      };
    } catch (error) {
      console.error("[GPS] Campus verification failed:", error);
      return {
        verified: false,
        confidence: 0,
        message: "Location unavailable: " + error.message,
        error: error,
      };
    }
  }

  /**
   * Verify if user is within a specific classroom/room
   */
  async verifyRoomLocation(roomLocation, roomRadius = 20) {
    try {
      const position = await this.getCurrentPosition();

      const distance = this.calculateDistance(
        position.latitude,
        position.longitude,
        roomLocation.latitude,
        roomLocation.longitude
      );

      // Account for GPS accuracy
      const effectiveDistance = Math.max(0, distance - position.accuracy / 2);
      const isWithinRoom = effectiveDistance <= roomRadius;

      const confidence = isWithinRoom
        ? Math.max(50, 100 - (effectiveDistance / roomRadius) * 50)
        : 0;

      return {
        verified: isWithinRoom,
        confidence: Math.round(confidence),
        distance: Math.round(distance),
        accuracy: Math.round(position.accuracy),
        position: position,
        message: isWithinRoom
          ? `In classroom area (${Math.round(distance)}m)`
          : `Not in classroom (${Math.round(distance)}m away)`,
      };
    } catch (error) {
      console.error("[GPS] Room verification failed:", error);
      throw error;
    }
  }

  /**
   * Get location data for attendance record
   */
  async getLocationForAttendance() {
    const position = await this.getCurrentPosition();

    return {
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      timestamp: position.timestamp,
    };
  }
}

export const gpsNativeService = new GPSNativeService();
export default gpsNativeService;
