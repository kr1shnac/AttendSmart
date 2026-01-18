import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiMapPin,
  FiNavigation,
  FiSave,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowLeft,
  FiExternalLink,
  FiEdit3,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import toast from "../../services/toastService";
import "./LocationSettings.css";

const LocationSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingGPS, setFetchingGPS] = useState(false);
  const [location, setLocation] = useState({
    latitude: 0,
    longitude: 0,
    radius: 500,
    name: "Main Campus",
  });
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsStatus, setGpsStatus] = useState(null); // 'success', 'warning', 'error'

  useEffect(() => {
    fetchCurrentSettings();
  }, []);

  const fetchCurrentSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";

      const response = await fetch(`${apiUrl}/api/settings/location`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?.campusLocation) {
          setLocation(data.data.campusLocation);
        }
      }
    } catch (error) {
      console.error("Error fetching location settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setFetchingGPS(true);
    setGpsAccuracy(null);
    setGpsStatus(null);

    try {
      toast.info("📍 Acquiring GPS location...");

      // Try to get high accuracy position
      const position = await new Promise((resolve, reject) => {
        let bestPosition = null;
        let bestAccuracy = Infinity;
        let watchId = null;
        let resolved = false;

        const cleanup = () => {
          if (watchId) navigator.geolocation.clearWatch(watchId);
        };

        // Timeout after 20 seconds
        setTimeout(() => {
          cleanup();
          if (!resolved) {
            resolved = true;
            if (bestPosition) {
              resolve(bestPosition);
            } else {
              reject(new Error("timeout"));
            }
          }
        }, 20000);

        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const acc = pos.coords.accuracy;
            console.log(`[GPS] Reading: ${acc.toFixed(1)}m accuracy`);

            if (acc < bestAccuracy) {
              bestAccuracy = acc;
              bestPosition = pos;
            }

            // If accuracy is good enough, resolve immediately
            if (acc <= 50) {
              cleanup();
              if (!resolved) {
                resolved = true;
                resolve(pos);
              }
            }
          },
          (error) => {
            cleanup();
            if (!resolved) {
              resolved = true;
              reject(error);
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
          }
        );
      });

      const accuracy = Math.round(position.coords.accuracy);
      setGpsAccuracy(accuracy);

      // Determine status based on accuracy
      if (accuracy <= 50) {
        setGpsStatus("success");
        setLocation({
          ...location,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        toast.success(`✅ Excellent accuracy: ±${accuracy}m`);
      } else if (accuracy <= 200) {
        setGpsStatus("warning");
        setLocation({
          ...location,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        toast.warning(
          `⚠️ Moderate accuracy: ±${accuracy}m. Consider using manual entry.`
        );
      } else {
        setGpsStatus("error");
        toast.error(
          `❌ Poor accuracy: ±${accuracy}m. Your device is using IP-based location. Please use manual entry below.`
        );
      }
    } catch (error) {
      console.error("[GPS] Error:", error);
      setGpsStatus("error");

      if (error.code === 1) {
        toast.error(
          "Location permission denied. Please allow location access or use manual entry."
        );
      } else if (error.code === 2 || error.message === "timeout") {
        toast.error(
          "Could not get GPS. Use manual entry with Google Maps coordinates."
        );
      } else {
        toast.error("GPS failed. Please use manual coordinate entry below.");
      }
    } finally {
      setFetchingGPS(false);
    }
  };

  const openGoogleMaps = () => {
    // Open Google Maps to let user find their location
    const url = "https://www.google.com/maps";
    window.open(url, "_blank");
    toast.info(
      "Right-click on your location in Google Maps and select 'What\\'s here?' to get coordinates"
    );
  };

  const saveLocation = async () => {
    if (location.latitude === 0 && location.longitude === 0) {
      toast.error("Please set a valid location first");
      return;
    }

    // Validate coordinates
    if (location.latitude < -90 || location.latitude > 90) {
      toast.error("Invalid latitude. Must be between -90 and 90");
      return;
    }
    if (location.longitude < -180 || location.longitude > 180) {
      toast.error("Invalid longitude. Must be between -180 and 180");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";

      const response = await fetch(`${apiUrl}/api/settings/location`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(location),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("✅ Campus location saved successfully!");
      } else {
        toast.error(data.message || "Failed to save location");
      }
    } catch (error) {
      console.error("[LocationSettings] Save error:", error);
      toast.error("Failed to save location: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="location-settings-loading">
        <div className="spinner"></div>
        <p>Loading location settings...</p>
      </div>
    );
  }

  return (
    <div className="location-settings">
      {/* Header */}
      <motion.div
        className="location-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button className="back-button" onClick={() => navigate("/admin")}>
          <FiArrowLeft />
        </button>
        <div className="header-content">
          <h1>
            <FiMapPin className="header-icon" />
            Campus Location Settings
          </h1>
          <p>Set the campus center for attendance verification</p>
        </div>
      </motion.div>

      {/* Method 1: GPS Auto-detect */}
      <motion.div
        className="location-card glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2>
          <FiNavigation className="section-icon" />
          Option 1: Auto-Detect GPS
        </h2>
        <p className="section-desc">
          Works best on <strong>mobile devices</strong> with GPS. Desktop
          browsers may have poor accuracy.
        </p>

        <button
          className={`gps-button ${fetchingGPS ? "loading" : ""}`}
          onClick={getCurrentLocation}
          disabled={fetchingGPS}
        >
          {fetchingGPS ? (
            <>
              <FiRefreshCw className="spinning" />
              Acquiring GPS Signal...
            </>
          ) : (
            <>
              <FiNavigation />
              Try Auto-Detect Location
            </>
          )}
        </button>

        {gpsStatus && (
          <div className={`gps-result ${gpsStatus}`}>
            {gpsStatus === "success" && <FiCheckCircle />}
            {gpsStatus === "warning" && <FiAlertCircle />}
            {gpsStatus === "error" && <FiAlertCircle />}
            <span>
              {gpsStatus === "success" &&
                `Location captured: ±${gpsAccuracy}m accuracy`}
              {gpsStatus === "warning" &&
                `Moderate accuracy: ±${gpsAccuracy}m - verify coordinates below`}
              {gpsStatus === "error" &&
                `Poor accuracy (±${gpsAccuracy || "N/A"}m) - use manual entry`}
            </span>
          </div>
        )}
      </motion.div>

      {/* Method 2: Manual Entry with Google Maps */}
      <motion.div
        className="location-card glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2>
          <FiEdit3 className="section-icon" />
          Option 2: Manual Entry (Recommended for Desktop)
        </h2>
        <p className="section-desc">
          Get exact coordinates from Google Maps for{" "}
          <strong>100% accuracy</strong>.
        </p>

        <button className="maps-button" onClick={openGoogleMaps}>
          <FiExternalLink />
          Open Google Maps
        </button>

        <div className="maps-instructions">
          <strong>How to get coordinates:</strong>
          <ol>
            <li>Open Google Maps (button above)</li>
            <li>Navigate to your campus location</li>
            <li>Right-click on the exact spot</li>
            <li>Click the coordinates at the top of the menu</li>
            <li>Paste them in the fields below</li>
          </ol>
        </div>
      </motion.div>

      {/* Location Details Form */}
      <motion.div
        className="location-card glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2>
          <FiMapPin className="section-icon" />
          Location Coordinates
        </h2>

        <div className="form-grid">
          <div className="form-group">
            <label>Campus Name</label>
            <input
              type="text"
              value={location.name}
              onChange={(e) =>
                setLocation({ ...location, name: e.target.value })
              }
              placeholder="e.g., Main Campus"
            />
          </div>

          <div className="form-group">
            <label>Radius (meters)</label>
            <input
              type="number"
              value={location.radius}
              onChange={(e) =>
                setLocation({
                  ...location,
                  radius: parseInt(e.target.value) || 500,
                })
              }
              min="50"
              max="5000"
              placeholder="500"
            />
          </div>

          <div className="form-group">
            <label>Latitude *</label>
            <input
              type="number"
              step="0.000001"
              value={location.latitude || ""}
              onChange={(e) =>
                setLocation({
                  ...location,
                  latitude: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="e.g., 12.971599"
              className={location.latitude ? "has-value" : ""}
            />
          </div>

          <div className="form-group">
            <label>Longitude *</label>
            <input
              type="number"
              step="0.000001"
              value={location.longitude || ""}
              onChange={(e) =>
                setLocation({
                  ...location,
                  longitude: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="e.g., 77.594566"
              className={location.longitude ? "has-value" : ""}
            />
          </div>
        </div>

        {/* Preview */}
        {location.latitude !== 0 && location.longitude !== 0 && (
          <div className="location-preview">
            <div className="preview-circle">
              <div className="preview-center"></div>
              <div className="preview-radius"></div>
            </div>
            <div className="preview-info">
              <span className="preview-coords">
                📍 {location.latitude.toFixed(6)},{" "}
                {location.longitude.toFixed(6)}
              </span>
              <span className="preview-radius-text">
                Coverage: {location.radius}m radius
              </span>
              <a
                href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="preview-link"
              >
                <FiExternalLink /> View on Google Maps
              </a>
            </div>
          </div>
        )}
      </motion.div>

      {/* Save Button */}
      <motion.div
        className="save-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <button
          className={`save-button ${saving ? "loading" : ""}`}
          onClick={saveLocation}
          disabled={
            saving || (location.latitude === 0 && location.longitude === 0)
          }
        >
          {saving ? (
            <>
              <FiRefreshCw className="spinning" />
              Saving...
            </>
          ) : (
            <>
              <FiSave />
              Save Campus Location
            </>
          )}
        </button>
      </motion.div>

      {/* Info Box */}
      <motion.div
        className="info-box glass-morphism"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <FiAlertCircle className="info-icon" />
        <div className="info-content">
          <h4>Important Notes</h4>
          <ul>
            <li>
              For best accuracy, use <strong>Google Maps coordinates</strong>
            </li>
            <li>
              Teachers will verify their location against this campus center
            </li>
            <li>Students verify against the teacher&apos;s session location</li>
            <li>Recommended radius: 100-500m depending on campus size</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
};

export default LocationSettings;
