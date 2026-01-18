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
import { classesAPI, sessionsAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./SessionFormModal.css";

const SessionFormModal = ({ isOpen, onClose, onSave }) => {
  // Class selection
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Session details
  const [topic, setTopic] = useState("");
  const [sessionType, setSessionType] = useState("lecture");
  const [duration, setDuration] = useState(60);

  // Location
  const [room, setRoom] = useState("");
  const [floor, setFloor] = useState("");
  const [building, setBuilding] = useState("Main Block");

  // Scheduling
  const [startMode, setStartMode] = useState("immediate"); // "immediate" or "scheduled"
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);

  // Fetch teacher's classes on modal open
  useEffect(() => {
    if (isOpen) {
      fetchClasses();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setSelectedClassId("");
    setSelectedSubject(null);
    setTopic("");
    setSessionType("lecture");
    setDuration(60);
    setRoom("");
    setFloor("");
    setBuilding("Main Block");
    setStartMode("immediate");
    setScheduledDate("");
    setScheduledTime("");
  };

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const response = await classesAPI.getMyClasses();
      let classData = [];

      if (response.data && Array.isArray(response.data)) {
        classData = response.data;
      } else if (response.data?.classes) {
        classData = response.data.classes;
      }

      setClasses(classData);

      if (classData.length > 0) {
        setSelectedClassId(classData[0]._id);
        updateSubjectFromClass(classData[0]);
      }
    } catch (error) {
      console.error("Failed to fetch classes:", error);
      toast.error("Failed to load your classes");
    } finally {
      setLoadingClasses(false);
    }
  };

  const updateSubjectFromClass = (classDoc) => {
    if (classDoc) {
      // Get subject info from the class
      const subjectInfo = {
        name: classDoc.subject || classDoc.className || "Unknown Subject",
        code: classDoc.courseCode || "N/A",
        className: classDoc.className || "",
        totalStudents: classDoc.students?.length || classDoc.totalStudents || 0,
      };
      setSelectedSubject(subjectInfo);
    }
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    const selectedClass = classes.find((c) => c._id === classId);
    updateSubjectFromClass(selectedClass);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedClassId) {
      toast.error("Please select a class");
      return;
    }

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
        classId: selectedClassId,
        sessionType,
        topic: topic || `${selectedSubject?.name} Session`,
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
        onSave(response.data?.session || response.session);
        onClose();
      } else {
        toast.error(response.message || "Failed to create session");
      }
    } catch (error) {
      console.error("Create session error:", error);
      const serverMessage = error.response?.data?.message;
      toast.error(serverMessage || error.message || "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  };

  // Get min date (today) for date picker
  const getMinDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  // Get min time if today is selected
  const getMinTime = () => {
    if (scheduledDate === getMinDate()) {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;
    }
    return "";
  };

  if (!isOpen) return null;

  return (
    <div className="um-modal-overlay">
      <motion.div
        className="um-modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
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
          {/* Class Selection */}
          <div className="um-form-group">
            <label>
              <FiBook /> Select Class
            </label>
            {loadingClasses ? (
              <div className="loading-text">Loading classes...</div>
            ) : classes.length === 0 ? (
              <div className="no-classes-text">
                No classes assigned. Contact admin.
              </div>
            ) : (
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                required
              >
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.className} - {cls.subject || cls.courseCode}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Auto-filled Subject Info */}
          {selectedSubject && (
            <div className="session-info-card">
              <div className="info-item">
                <span className="info-label">Subject</span>
                <span className="info-value">{selectedSubject.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Code</span>
                <span className="info-value">{selectedSubject.code}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Students</span>
                <span className="info-value">
                  <FiUsers /> {selectedSubject.totalStudents}
                </span>
              </div>
            </div>
          )}

          {/* Session Type & Topic */}
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
                  min={getMinTime()}
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
              disabled={submitting || !selectedClassId}
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

SessionFormModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default SessionFormModal;
