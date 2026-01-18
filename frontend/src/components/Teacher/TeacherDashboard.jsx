import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FiUsers,
  FiCalendar,
  FiTrendingUp,
  FiClock,
  FiMapPin,
  FiArrowLeft,
} from "react-icons/fi";
import ClassDetailView from "./ClassDetailView";
import SessionFormModal from "./SessionFormModal";
import { classesAPI, sessionsAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./TeacherDashboard.css";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSessionFormOpen, setIsSessionFormOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await classesAPI.getMyClasses();

      // Handle response structure - support both nested and direct array
      let classesData = [];
      if (response.data) {
        // If data is nested in data.classes
        if (Array.isArray(response.data.classes)) {
          classesData = response.data.classes;
        }
        // If data is directly an array
        else if (Array.isArray(response.data)) {
          classesData = response.data;
        }
      } else if (response.classes) {
        classesData = response.classes;
      }

      // Transform data to ensure all required fields exist
      const transformedClasses = classesData.map((cls) => ({
        ...cls,
        // Ensure overallAttendance exists (fallback to averageAttendance)
        overallAttendance: cls.overallAttendance ?? cls.averageAttendance ?? 0,
        // Ensure semester is a string
        semester: String(cls.semester || "5"),
        // Ensure department exists
        department: cls.department || "Computer Science",
        // Ensure schedule exists
        schedule: cls.schedule || [],
        // Ensure numeric fields
        totalStudents: cls.totalStudents || 0,
        totalSessions: cls.totalSessions || 0,
      }));

      setClasses(transformedClasses);
      console.log(
        `✅ Loaded ${transformedClasses.length} classes from database`
      );
    } catch (err) {
      console.error("Failed to fetch classes:", err);
      setError("Failed to load classes. Please try again.");
      toast.error("Could not load your classes. Please refresh the page.");
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  function formatTimeToStandard(time24) {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const minute = minuteStr || "00";
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  }

  function extractFloor(room) {
    if (!room || !room.includes("Room")) return "";
    const match = room.match(/Room\s*(\d+)/);
    if (match && match[1]) return match[1][0];
    return "";
  }

  const openSessionForm = () => {
    setSessionToEdit(null);
    setIsSessionFormOpen(true);
  };

  const handleSessionSave = async (sessionData) => {
    try {
      const response = await sessionsAPI.createSession(sessionData);
      if (response.success || response.status === "success") {
        toast.success("Session created successfully!");
        setIsSessionFormOpen(false);
        // Refresh classes to get updated session counts
        fetchClasses();
      } else {
        toast.error(response.message || "Failed to save session");
      }
    } catch (error) {
      console.error("Failed to save session:", error);
      toast.error("Failed to save session. Please try again.");
    }
  };

  const getAttendanceColor = (attendance) => {
    if (attendance >= 85) return "#10b981";
    if (attendance >= 75) return "#fbbf24";
    return "#ef4444";
  };

  const getAttendanceStatus = (attendance) => {
    if (attendance >= 85) return "Excellent";
    if (attendance >= 75) return "Good";
    return "Needs Attention";
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading your classes...</p>
      </div>
    );
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (selectedClass) {
    return (
      <ClassDetailView
        classData={selectedClass}
        onBack={() => setSelectedClass(null)}
        onStartSession={openSessionForm}
      />
    );
  }

  return (
    <div className="teacher-dashboard">
      {/* Back Button */}
      <motion.button
        className="back-button"
        onClick={() => navigate("/teacher")}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ x: -5 }}
        whileTap={{ scale: 0.95 }}
      >
        <FiArrowLeft />
        <span>Back</span>
      </motion.button>

      {/* Header */}
      <motion.div
        className="dashboard-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="header-content">
          <div className="header-text">
            <h1 className="section-heading">Your Classes</h1>
            <p className="subtitle">
              Manage your classes, students, and track performance
            </p>
          </div>
        </div>
      </motion.div>

      <br />

      {classes.length === 0 ? (
        <div className="empty-classes-container">
          <p className="no-classes-text">No classes assigned yet</p>
        </div>
      ) : (
        <>
          <div className="classes-list-premium">
            {classes.map((cls, index) => (
              <motion.div
                key={cls._id}
                className="class-card-premium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedClass(cls)}
              >
                {/* Left Section - Main Info */}
                <div className="class-main-section">
                  {/* Header */}
                  {/* Header */}
                  <div className="class-card-header-prem">
                    <span className="course-code-badge-prem">
                      {cls.courseCode}
                    </span>
                    <span className="semester-badge">{`Sem ${cls.semester}`}</span>
                  </div>

                  {/* Title */}
                  <h3 className="subject-title-prem">{cls.subject}</h3>
                  <p className="class-subtitle-prem">{cls.className}</p>

                  {/* Stats */}
                  <div className="stats-inline">
                    <div className="stat-mini">
                      <FiUsers className="stat-mini-icon" />
                      <span className="stat-mini-value">
                        {cls.totalStudents}
                      </span>
                      <span className="stat-mini-label">Students</span>
                    </div>
                    <div className="stat-mini">
                      <FiCalendar className="stat-mini-icon" />
                      <span className="stat-mini-value">
                        {cls.totalSessions}
                      </span>
                      <span className="stat-mini-label">Sessions</span>
                    </div>
                  </div>

                  {/* Attendance */}
                  {cls.overallAttendance !== undefined && (
                    <div className="attendance-mini">
                      <div className="attendance-mini-header">
                        <span className="attendance-mini-label">
                          Avg. Attendance
                        </span>
                        <span
                          className="attendance-mini-percent"
                          style={{
                            color: getAttendanceColor(cls.overallAttendance),
                          }}
                        >
                          {cls.overallAttendance}%
                        </span>
                      </div>
                      <div className="attendance-mini-bar">
                        <div
                          className="attendance-mini-fill"
                          style={{
                            width: `${cls.overallAttendance}%`,
                            backgroundColor: getAttendanceColor(
                              cls.overallAttendance
                            ),
                          }}
                        />
                      </div>
                      <span
                        className="attendance-mini-status"
                        style={{
                          color: getAttendanceColor(cls.overallAttendance),
                        }}
                      >
                        {getAttendanceStatus(cls.overallAttendance)}
                      </span>
                    </div>
                  )}

                  {/* Next Class Section */}
                  {cls.schedule && cls.schedule.length > 0 && (
                    <div className="next-class-section">
                      <div className="next-class-header">
                        <FiClock className="next-class-icon" />
                        <span className="next-class-label">Next Class</span>
                      </div>
                      <div className="next-class-details">
                        <span className="next-class-day">
                          {cls.schedule[0].day}
                        </span>
                        <span className="next-class-time">
                          {formatTimeToStandard(cls.schedule[0].startTime)} -{" "}
                          {formatTimeToStandard(cls.schedule[0].endTime)}
                        </span>
                        <div className="next-class-room">
                          <FiMapPin className="room-icon-mini" />
                          <span>{cls.schedule[0].room}</span>
                          <span className="floor-badge">
                            Floor {extractFloor(cls.schedule[0].room) || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Section - Watermark + View Details */}
                <div className="class-right-section">
                  <div className="class-watermark-premium">
                    {cls.courseCode}
                  </div>
                  <div className="view-details-row">
                    <span className="view-details-link-prem">
                      View Details <FiTrendingUp className="view-arrow-icon" />
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Session Form Modal */}
      <SessionFormModal
        isOpen={isSessionFormOpen}
        onClose={() => setIsSessionFormOpen(false)}
        onSave={handleSessionSave}
        initialData={sessionToEdit}
      />
    </div>
  );
};

export default TeacherDashboard;
