/* eslint-disable */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import {
  FiX,
  FiClock,
  FiBook,
  FiPlay,
  FiCalendar,
  FiMapPin,
  FiLayers,
  FiUsers,
} from "react-icons/fi";
import { sessionsAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./SessionFormModal.css"; // Use same styling as SessionFormModal

const CreateSessionModal = ({
  isOpen,
  onClose,
  onStartNow,
  onSchedule,
  classData,
}) => {
  // Session details
  const [topic, setTopic] = useState("");
  const [sessionType, setSessionType] = useState("lecture");
  const [duration, setDuration] = useState(60);

  // Location
  const [room, setRoom] = useState("");
  const [floor, setFloor] = useState("");
  const [building, setBuilding] = useState("Main Block");

  // Scheduling
  const [startMode, setStartMode] = useState("immediate");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setTopic("");
      setSessionType("lecture");
      setDuration(60);
      setRoom("");
      setFloor("");
      setBuilding("Main Block");
      setStartMode("immediate");
      setScheduledDate("");
      setScheduledTime("");
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!room.trim()) {
      toast.error("Please enter a room number");
      return;
    }

    if (startMode === "scheduled" && (!scheduledDate || !scheduledTime)) {
      toast.error("Please select date and time for scheduled session");
      return;
    }

    setSubmitting(true);

    try {
      const sessionData = {
        classId: classData?._id,
        sessionType,
        topic: topic || `${classData?.subject || "Class"} Session`,
        duration,
        room,
        floor,
        building,
        coordinates: {
          latitude: 0,
          longitude: 0,
          radius: 100,
        },
      };

      // If scheduled, add the scheduled start time
      if (startMode === "scheduled") {
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        sessionData.scheduledStartTime = scheduledDateTime.toISOString();
      }

      const response = await sessionsAPI.createSession(sessionData);

      if (response.status === "success" || response.success) {
        toast.success(
          startMode === "immediate"
            ? "Session started successfully!"
            : "Session scheduled successfully!"
        );

        if (startMode === "immediate") {
          onStartNow(response.data?.session || response.session || sessionData);
        } else {
          onSchedule(response.data?.session || response.session || sessionData);
        }
        onClose();
      } else {
        toast.error(response.message || "Failed to create session");
      }
    } catch (error) {
      console.error("Create session error:", error);
      toast.error(error.message || "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  };

  // Get min date (today) for date picker
  const getMinDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  if (!isOpen) return null;

  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <motion.div
        className="um-modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="um-modal-header">
          <h2>
            {startMode === "immediate" ? "Start Session" : "Schedule Session"}
          </h2>
          <button className="um-modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        {/* Form */}
        <form className="um-modal-form" onSubmit={handleSubmit}>
          {/* Class Info (if available) */}
          {classData && (
            <div className="session-info-card">
              <div className="info-item">
                <span className="info-label">Class</span>
                <span className="info-value">{classData.className}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Subject</span>
                <span className="info-value">{classData.subject}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Students</span>
                <span className="info-value">
                  <FiUsers />{" "}
                  {classData.totalStudents || classData.students?.length || 0}
                </span>
              </div>
            </div>
          )}

          {/* Session Type & Duration */}
          <div className="um-form-row">
            <div className="um-form-group">
              <label>
                <FiLayers /> Session Type
              </label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
              >
                <option value="lecture">Lecture</option>
                <option value="lab">Lab</option>
                <option value="tutorial">Tutorial</option>
                <option value="seminar">Seminar</option>
                <option value="exam">Exam</option>
              </select>
            </div>

            <div className="um-form-group">
              <label>
                <FiClock /> Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>1 Hour</option>
                <option value={90}>1.5 Hours</option>
                <option value={120}>2 Hours</option>
              </select>
            </div>
          </div>

          <div className="um-form-group">
            <label>
              <FiBook /> Topic (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Introduction to Data Structures"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="um-form-row">
            <div className="um-form-group">
              <label>
                <FiMapPin /> Room Number *
              </label>
              <input
                type="text"
                placeholder="e.g., 301"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                required
              />
            </div>

            <div className="um-form-group">
              <label>
                <FiLayers /> Floor
              </label>
              <input
                type="text"
                placeholder="e.g., 3rd Floor"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
              />
            </div>
          </div>

          <div className="um-form-group">
            <label>Building</label>
            <input
              type="text"
              placeholder="e.g., Main Block"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
            />
          </div>

          {/* Start Mode Toggle */}
          <div className="um-form-group">
            <label>When to Start?</label>
            <div className="start-mode-toggle">
              <button
                type="button"
                className={`mode-btn ${
                  startMode === "immediate" ? "active" : ""
                }`}
                onClick={() => setStartMode("immediate")}
              >
                <FiPlay /> Start Now
              </button>
              <button
                type="button"
                className={`mode-btn ${
                  startMode === "scheduled" ? "active" : ""
                }`}
                onClick={() => setStartMode("scheduled")}
              >
                <FiCalendar /> Schedule
              </button>
            </div>
          </div>

          {/* Scheduled Date/Time */}
          {startMode === "scheduled" && (
            <div className="um-form-row">
              <div className="um-form-group">
                <label>
                  <FiCalendar /> Date *
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={getMinDate()}
                  required
                />
              </div>

              <div className="um-form-group">
                <label>
                  <FiClock /> Time *
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="um-modal-actions">
            <button
              type="button"
              className="um-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="um-btn-submit"
              disabled={submitting}
            >
              {submitting ? (
                <span className="spinner-small" />
              ) : startMode === "immediate" ? (
                <>
                  <FiPlay /> Start Session
                </>
              ) : (
                <>
                  <FiCalendar /> Schedule Session
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

CreateSessionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onStartNow: PropTypes.func.isRequired,
  onSchedule: PropTypes.func.isRequired,
  classData: PropTypes.object,
};

export default CreateSessionModal;
