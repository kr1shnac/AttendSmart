/**
 * GPS Service
 * Provides location verification for attendance
 * Dynamically loads campus settings from API
 * Uses high-accuracy GPS with progressive improvement
 */

class GPSService {
  constructor() {
    // Default campus center coordinates (will be overwritten by API)
    this.campusCenter = {
      latitude: 12.9716,
      longitude: 77.5946,
    };
    this.campusRadius = 500; // meters
    this.campusName = "Main Campus";
    this.gpsSupported = "geolocation" in navigator;
    this.settingsLoaded = false;
    this.loadingPromise = null;
  }

  // Load campus settings from API
  async loadCampusSettings() {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    if (this.settingsLoaded) {
      return { success: true };
    }

    this.loadingPromise = (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.log("[GPS] No token, using default settings");
          return { success: true, usingDefaults: true };
        }

        const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";

        // Add timeout for API call
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`${apiUrl}/api/settings/location`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.data?.campusLocation) {
            const loc = data.data.campusLocation;
            this.campusCenter = {
              latitude: loc.latitude,
              longitude: loc.longitude,
            };
            this.campusRadius = loc.radius || 500;
            this.campusName = loc.name || "Main Campus";
            this.settingsLoaded = true;
            console.log("[GPS] Campus settings loaded:", this.campusCenter);
            return { success: true };
          }
        } else if (response.status === 401) {
          return {
            success: false,
            errorType: "auth",
            message: "Session expired. Please login again.",
          };
        } else if (response.status >= 500) {
          return {
            success: false,
            errorType: "server",
            message: "Server is temporarily unavailable.",
          };
        }

        return { success: true, usingDefaults: true };
      } catch (error) {
        console.error("[GPS] Failed to load settings:", error);

        // Differentiate between network errors and other errors
        if (error.name === "AbortError") {
          return {
            success: false,
            errorType: "timeout",
            message: "Server connection timed out.",
          };
        } else if (
          error.message?.includes("fetch") ||
          error.message?.includes("network") ||
          error.name === "TypeError"
        ) {
          return {
            success: false,
            errorType: "network",
            message:
              "Cannot connect to server. Check your internet connection.",
          };
        }

        return { success: true, usingDefaults: true };
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  isSupported() {
    return this.gpsSupported;
  }

  // Get current position with high accuracy using watchPosition
  async getCurrentPosition(options = {}) {
    // IMPROVED: Tighter accuracy threshold for reliable results
    const { maxAccuracy = 50, timeout = 20000, minReadings = 4 } = options;

    return new Promise((resolve, reject) => {
      if (!this.gpsSupported) {
        reject(new Error("GPS not supported"));
        return;
      }

      let bestPosition = null;
      let bestAccuracy = Infinity;
      let readings = 0;
      let watchId = null;
      let timeoutId = null;

      const cleanup = () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
        if (timeoutId) clearTimeout(timeoutId);
      };

      const resolveWithBest = () => {
        cleanup();
        if (bestPosition) {
          console.log(
            `[GPS] Final position: ${bestAccuracy.toFixed(
              1
            )}m accuracy after ${readings} readings`
          );
          resolve({
            latitude: bestPosition.coords.latitude,
            longitude: bestPosition.coords.longitude,
            accuracy: bestPosition.coords.accuracy,
            timestamp: new Date(bestPosition.timestamp),
          });
        } else {
          reject(new Error("Could not get GPS position"));
        }
      };

      timeoutId = setTimeout(() => {
        console.log(
          `[GPS] Timeout after ${
            timeout / 1000
          }s, best accuracy: ${bestAccuracy.toFixed(1)}m`
        );
        resolveWithBest();
      }, timeout);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          readings++;
          const accuracy = position.coords.accuracy;
          console.log(`[GPS] Reading ${readings}: ${accuracy.toFixed(1)}m`);

          if (accuracy < bestAccuracy) {
            bestAccuracy = accuracy;
            bestPosition = position;
          }

          // Excellent accuracy - resolve immediately (< 20m is very precise)
          if (accuracy <= 20) {
            console.log(`[GPS] Excellent accuracy achieved!`);
            resolveWithBest();
            return;
          }

          // Good accuracy (< 35m) after minimum readings
          if (readings >= minReadings && bestAccuracy <= 35) {
            console.log(
              `[GPS] Good accuracy achieved after ${readings} readings`
            );
            resolveWithBest();
            return;
          }

          // Acceptable accuracy after more readings
          if (readings >= minReadings + 2 && bestAccuracy <= maxAccuracy) {
            resolveWithBest();
          }
        },
        (error) => {
          cleanup();
          reject(this.getErrorMessage(error));
        },
        {
          enableHighAccuracy: true,
          timeout: timeout,
          maximumAge: 0,
        }
      );
    });
  }

  // Calculate distance between two GPS coordinates (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // IMPROVED: Verify location with accuracy-aware boundary checking
  async verifyLocation() {
    try {
      // Check server connection first
      const settingsResult = await this.loadCampusSettings();

      // If server connection failed, return specific error
      if (settingsResult && settingsResult.success === false) {
        return {
          success: false,
          errorType: settingsResult.errorType,
          error: settingsResult.message,
          message: `⚠ ${settingsResult.message}`,
          isConnectionError: true,
        };
      }

      const position = await this.getCurrentPosition();

      const distance = this.calculateDistance(
        position.latitude,
        position.longitude,
        this.campusCenter.latitude,
        this.campusCenter.longitude
      );

      const accuracy = position.accuracy;

      // SMART BOUNDARY CHECK: Account for GPS accuracy
      // If distance + accuracy error could still be inside campus, give benefit of doubt
      const effectiveRadius = this.campusRadius + accuracy * 0.5; // Add half the accuracy as buffer
      const isWithinCampus = distance <= effectiveRadius;

      // Additional confidence info
      const margin = effectiveRadius - distance;
      const isEdgeCase = Math.abs(margin) < accuracy;

      let statusMessage;
      if (isWithinCampus) {
        if (isEdgeCase) {
          statusMessage = `✓ Inside campus (${Math.round(
            distance
          )}m, edge of range)`;
        } else {
          statusMessage = `✓ Inside campus (${Math.round(
            distance
          )}m from center)`;
        }
      } else {
        statusMessage = `✗ Outside campus (${Math.round(
          distance
        )}m from center, need within ${this.campusRadius}m)`;
      }

      console.log(
        `[GPS] Verification: distance=${Math.round(
          distance
        )}m, accuracy=${Math.round(accuracy)}m, radius=${
          this.campusRadius
        }m, inside=${isWithinCampus}`
      );

      return {
        success: true,
        position: position,
        distance: Math.round(distance),
        isWithinCampus: isWithinCampus,
        campusRadius: this.campusRadius,
        effectiveRadius: Math.round(effectiveRadius),
        campusName: this.campusName,
        accuracy: Math.round(accuracy),
        isEdgeCase: isEdgeCase,
        message: statusMessage,
      };
    } catch (error) {
      // Provide specific error messages based on error type
      let errorMessage = error.message || error;
      let errorType = "gps";

      if (
        errorMessage.includes("denied") ||
        errorMessage.includes("permission")
      ) {
        errorMessage = "Location access denied. Please enable GPS permissions.";
        errorType = "permission";
      } else if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("timed out")
      ) {
        errorMessage = "GPS signal weak. Move to a better location.";
        errorType = "timeout";
      } else if (
        errorMessage.includes("unavailable") ||
        errorMessage.includes("position")
      ) {
        errorMessage = "GPS unavailable. Check device settings.";
        errorType = "unavailable";
      }

      return {
        success: false,
        error: errorMessage,
        errorType: errorType,
        message: `✗ ${errorMessage}`,
      };
    }
  }

  // IMPROVED: Verify against a specific location (for sessions) with accuracy-aware checking
  async verifyAgainstLocation(targetLocation, radius = 50) {
    try {
      const position = await this.getCurrentPosition();

      const distance = this.calculateDistance(
        position.latitude,
        position.longitude,
        targetLocation.latitude,
        targetLocation.longitude
      );

      const accuracy = position.accuracy;

      // SMART BOUNDARY CHECK: Account for GPS accuracy
      const effectiveRadius = radius + accuracy * 0.5; // Add half the accuracy as buffer
      const isWithinRange = distance <= effectiveRadius;

      const margin = effectiveRadius - distance;
      const isEdgeCase = Math.abs(margin) < accuracy;

      console.log(
        `[GPS] Session verification: distance=${Math.round(
          distance
        )}m, accuracy=${Math.round(
          accuracy
        )}m, radius=${radius}m, effective=${Math.round(
          effectiveRadius
        )}m, inside=${isWithinRange}`
      );

      return {
        success: true,
        position: position,
        distance: Math.round(distance),
        isWithinRange: isWithinRange,
        radius: radius,
        effectiveRadius: Math.round(effectiveRadius),
        accuracy: Math.round(accuracy),
        isEdgeCase: isEdgeCase,
        message: isWithinRange
          ? `✓ Within range (${Math.round(distance)}m)`
          : `✗ Out of range (${Math.round(distance)}m, need within ${radius}m)`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || error,
        message: "✗ Could not verify location",
      };
    }
  }

  setCampusCenter(latitude, longitude, radius = 500) {
    this.campusCenter = { latitude, longitude };
    this.campusRadius = radius;
  }

  async reloadSettings() {
    this.settingsLoaded = false;
    return this.loadCampusSettings();
  }

  getErrorMessage(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "GPS permission denied. Please enable location access.";
      case error.POSITION_UNAVAILABLE:
        return "Location information unavailable.";
      case error.TIMEOUT:
        return "Location request timed out.";
      default:
        return "An unknown error occurred.";
    }
  }

  watchPosition(callback) {
    if (!this.gpsSupported) {
      callback({ success: false, error: "GPS not supported" });
      return null;
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        const distance = this.calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          this.campusCenter.latitude,
          this.campusCenter.longitude
        );

        callback({
          success: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          distance: Math.round(distance),
          isWithinCampus: distance <= this.campusRadius,
        });
      },
      (error) => {
        callback({ success: false, error: this.getErrorMessage(error) });
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  }

  stopWatching(watchId) {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
    }
  }
}

export default new GPSService();
