/* eslint-disable */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiX,
  FiCalendar,
  FiClock,
  FiMapPin,
  FiCheckCircle,
  FiXCircle,
  FiUsers,
  FiTrendingUp,
  FiLoader,
} from "react-icons/fi";
import PropTypes from "prop-types";
import { attendanceAPI } from "../../services/api";
import "./SessionReportModal.css";

// No fake data - all students come from real API

const SessionReportModal = ({ session, onClose }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?._id || session?.id) {
      fetchSessionAttendance();
    }
  }, [session]);

  const fetchSessionAttendance = async () => {
    setLoading(true);
    try {
      const sessionId = session._id || session.id;
      const response = await attendanceAPI.getSessionAttendance(sessionId);
      if (response.success && response.data?.attendance) {
        const attendanceRecords = response.data.attendance.map((record) => ({
          usn: record.student?.usn || "N/A",
          name: record.student?.name || "Unknown",
          status: record.status === "present" ? "Present" : "Absent",
          checkInTime: record.checkInTime
            ? new Date(record.checkInTime).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : null,
        }));
        setStudents(attendanceRecords);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error("Error fetching session attendance:", error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  const presentStudents = students.filter((s) => s.status === "Present");
  const absentStudents = students.filter((s) => s.status === "Absent");
  const attendancePercentage =
    students.length > 0
      ? Math.round((presentStudents.length / students.length) * 100)
      : session.attendance || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="session-report-modal glass-morphism"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose}>
          <FiX />
        </button>

        {/* Header */}
        <div className="report-header">
          <h2>{session.subject}</h2>
          <p className="session-date">
            <FiCalendar />{" "}
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Session Details */}
        <div className="session-details">
          <div className="detail-card">
            <FiClock className="detail-icon" />
            <div>
              <span className="detail-label">Time</span>
              <span className="detail-value">{session.time}</span>
            </div>
          </div>
          <div className="detail-card">
            <FiMapPin className="detail-icon" />
            <div>
              <span className="detail-label">Room</span>
              <span className="detail-value">{session.room}</span>
            </div>
          </div>
          <div className="detail-card">
            <FiUsers className="detail-icon" />
            <div>
              <span className="detail-label">Total Students</span>
              <span className="detail-value">{session.total}</span>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="statistics-section">
          <div className="stat-card overall">
            <FiTrendingUp className="stat-icon" />
            <div className="stat-content">
              <span className="stat-label">Overall Attendance</span>
              <span className="stat-value">{attendancePercentage}%</span>
              <span className="stat-count">
                {session.present} / {session.total}
              </span>
            </div>
            <div className="stat-bar">
              <div
                className="stat-fill"
                style={{ width: `${attendancePercentage}%` }}
              ></div>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card present">
              <FiCheckCircle className="stat-icon" />
              <div className="stat-content">
                <span className="stat-label">Present</span>
                <span className="stat-value">{session.present}</span>
              </div>
            </div>
            <div className="stat-card absent">
              <FiXCircle className="stat-icon" />
              <div className="stat-content">
                <span className="stat-label">Absent</span>
                <span className="stat-value">
                  {session.total - session.present}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Student Lists */}
        <div className="student-lists">
          <div className="student-section present-section">
            <h3>
              <FiCheckCircle /> Present Students ({presentStudents.length})
            </h3>
            <div className="student-grid">
              {presentStudents.map((student) => (
                <div key={student.usn} className="student-card">
                  <div className="student-info">
                    <span className="student-name">{student.name}</span>
                    <span className="student-usn">{student.usn}</span>
                  </div>
                  <span className="check-in-time">{student.checkInTime}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="student-section absent-section">
            <h3>
              <FiXCircle /> Absent Students ({absentStudents.length})
            </h3>
            <div className="student-grid">
              {absentStudents.map((student) => (
                <div key={student.usn} className="student-card">
                  <div className="student-info">
                    <span className="student-name">{student.name}</span>
                    <span className="student-usn">{student.usn}</span>
                  </div>
                  <span className="absent-badge">Absent</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

SessionReportModal.propTypes = {
  session: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default SessionReportModal;
