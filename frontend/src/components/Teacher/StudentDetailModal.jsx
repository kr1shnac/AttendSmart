/* eslint-disable */
import React from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import {
  FaTimes,
  FaEnvelope,
  FaPhone,
  FaUserGraduate,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaExclamationTriangle,
  FaFire,
  FaTrophy,
  FaChartBar,
} from "react-icons/fa";
import "./StudentDetailModal.css";

// Helper: Get initials
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Helper: Attendance category
const getAttendanceCategory = (percentage) => {
  if (percentage >= 90) return "excellent";
  if (percentage >= 75) return "good";
  if (percentage >= 60) return "average";
  return "poor";
};

const StudentDetailModal = ({ student, onClose }) => {
  if (!student) return null;

  const attendanceCategory = getAttendanceCategory(student.attendance || 0);
  const isAtRisk = (student.attendance || 0) < 75;
  const isTopPerformer = (student.attendance || 0) >= 95;

  // Use real activity data from student prop - no mock data
  const recentActivity = student.recentActivity || [];

  return (
    <motion.div
      className="student-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="student-modal-container"
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="modal-close-button"
          onClick={onClose}
          aria-label="Close"
        >
          <FaTimes />
        </button>

        {/* Scrollable Content */}
        <div className="modal-scroll-content">
          {/* Header Section */}
          <div className="modal-header-section">
            {/* Avatar */}
            <div className={`modal-avatar-large ${attendanceCategory}`}>
              {student.photo ? (
                <img src={student.photo} alt={student.name} />
              ) : (
                <span className="avatar-initials-huge">
                  {getInitials(student.name)}
                </span>
              )}
            </div>

            {/* Name & USN */}
            <h2 className="modal-student-name">{student.name || "N/A"}</h2>
            <p className="modal-student-usn">{student.usn || "N/A"}</p>
            <p className="modal-student-dept">
              {student.department || "N/A"} • Semester{" "}
              {student.semester || "N/A"}
            </p>

            {/* Badges */}
            <div className="modal-badges">
              {isAtRisk && (
                <span className="modal-badge badge-risk">
                  <FaExclamationTriangle /> At Risk
                </span>
              )}
              {isTopPerformer && (
                <span className="modal-badge badge-top">
                  <FaTrophy /> Top Performer
                </span>
              )}
              {student.streak >= 5 && (
                <span className="modal-badge badge-streak">
                  <FaFire /> {student.streak} Day Streak
                </span>
              )}
            </div>

            {/* Contact Info */}
            <div className="modal-contacts-grid">
              {student.email && (
                <div className="contact-item-modal">
                  <FaEnvelope className="contact-icon" />
                  <span>{student.email}</span>
                </div>
              )}
              {student.phone && (
                <div className="contact-item-modal">
                  <FaPhone className="contact-icon" />
                  <span>{student.phone}</span>
                </div>
              )}
              {student.parentPhone && (
                <div className="contact-item-modal parent-contact">
                  <FaPhone className="contact-icon" />
                  <span>Parent: {student.parentPhone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="modal-divider" />

          {/* Attendance Overview */}
          <div className="modal-section">
            <h3 className="section-title-modal">
              <FaChartBar /> Attendance Overview
            </h3>

            <div className={`attendance-overview-card ${attendanceCategory}`}>
              {/* Main Percentage */}
              <div className="attendance-main">
                <span className="attendance-percentage-large">
                  {(student.attendance || 0).toFixed(1)}%
                </span>
                <span className="attendance-label-main">
                  Overall Attendance
                </span>
              </div>

              {/* Horizontal Bar */}
              <div className="attendance-bar-large">
                <motion.div
                  className={`attendance-bar-fill-large ${attendanceCategory}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${student.attendance || 0}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </div>

              {/* Stats Grid */}
              <div className="attendance-stats-grid">
                <div className="stat-box-modal">
                  <FaCheckCircle className="stat-icon-modal present-icon" />
                  <span className="stat-value-modal">
                    {student.totalPresent || 0}
                  </span>
                  <span className="stat-label-modal">Present</span>
                </div>
                <div className="stat-box-modal">
                  <FaTimesCircle className="stat-icon-modal absent-icon" />
                  <span className="stat-value-modal">
                    {student.totalAbsent || 0}
                  </span>
                  <span className="stat-label-modal">Absent</span>
                </div>
                <div className="stat-box-modal">
                  <FaClock className="stat-icon-modal" />
                  <span className="stat-value-modal">
                    {student.totalLeaves || 0}
                  </span>
                  <span className="stat-label-modal">Leaves</span>
                </div>
              </div>

              {/* Status Alert */}
              {isAtRisk ? (
                <div className="status-alert-modal alert-risk">
                  <FaExclamationTriangle />
                  <span>At Risk - Below 75% attendance threshold</span>
                </div>
              ) : (
                <div className="status-alert-modal alert-good">
                  <FaCheckCircle />
                  <span>Good Standing - Above required threshold</span>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="modal-divider" />

          {/* Recent Activity */}
          <div className="modal-section">
            <h3 className="section-title-modal">
              <FaClock /> Recent Activity
            </h3>

            <div className="activity-timeline-modal">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className={`timeline-item-modal ${activity.status}`}
                >
                  <div className="timeline-dot-modal" />
                  <div className="timeline-line-modal" />
                  <div className="timeline-content-modal">
                    <div className="timeline-header-row">
                      <span className="timeline-date-text">
                        {new Date(activity.date).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          weekday: "short",
                        })}
                      </span>
                      <span
                        className={`timeline-status-badge ${activity.status}`}
                      >
                        {activity.status === "present" ? (
                          <>
                            <FaCheckCircle /> Present
                          </>
                        ) : (
                          <>
                            <FaTimesCircle /> Absent
                          </>
                        )}
                      </span>
                    </div>
                    {activity.status === "present" && (
                      <div className="timeline-meta-row">
                        <span className="timeline-time">{activity.time}</span>
                        <span className="timeline-method">
                          via {activity.method}
                        </span>
                        {activity.late && (
                          <span className="timeline-late-badge">Late</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions-section">
            <a
              href={`tel:${student.phone}`}
              className="modal-action-btn btn-primary"
            >
              <FaPhone /> Call Student
            </a>
            <a
              href={`mailto:${student.email}`}
              className="modal-action-btn btn-secondary"
            >
              <FaEnvelope /> Email Student
            </a>
            {student.parentPhone && (
              <a
                href={`tel:${student.parentPhone}`}
                className="modal-action-btn btn-secondary"
              >
                <FaPhone /> Call Parent
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

StudentDetailModal.propTypes = {
  student: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    usn: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    parentPhone: PropTypes.string,
    department: PropTypes.string,
    semester: PropTypes.number,
    photo: PropTypes.string,
    attendance: PropTypes.number,
    totalPresent: PropTypes.number,
    totalAbsent: PropTypes.number,
    totalLeaves: PropTypes.number,
    streak: PropTypes.number,
    recentActivity: PropTypes.array,
  }),
  onClose: PropTypes.func.isRequired,
};

export default StudentDetailModal;
