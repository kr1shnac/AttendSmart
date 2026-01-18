/* eslint-disable */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Line } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import {
  FiCheckCircle,
  FiZap,
  FiCalendar,
  FiRadio,
  FiMapPin,
  FiUser,
  FiFileText,
  FiBell,
  FiSettings,
  FiActivity,
  FiSmartphone,
  FiX,
  FiBook,
  FiClock,
  FiChevronRight,
  FiTrendingUp,
} from "react-icons/fi";

import AttendanceVerificationFlow from "./AttendanceVerificationFlow";
import StudentSubjects from "./StudentSubjects";
import sessionStateManager from "../../services/sessionStateManager";
import toast from "../../services/toastService";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import GPSStatus from "./GPSStatus";
import PullToRefresh from "../common/PullToRefresh";
import SwipeableCard from "../common/SwipeableCard";
import "./StudentHome.css";
import { API_BASE_URL } from "../../config/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// --- Sub-Components ---

const StatsGrid = ({ stats }) => (
  <motion.div
    className="quick-stats-grid"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
  >
    <div className="stat-card-admin glass-morphism">
      <div className="stat-content">
        <div className="stat-value">{stats.attendancePercentage}%</div>
        <div className="stat-label">Overall Attendance</div>
      </div>
      <FiTrendingUp className="stat-icon-bg" />
    </div>
    <div className="stat-card-admin glass-morphism">
      <div className="stat-content">
        <div className="stat-value">
          {stats.presentClasses}/{stats.totalClasses}
        </div>
        <div className="stat-label">Classes Attended</div>
      </div>
      <FiCheckCircle className="stat-icon-bg" />
    </div>
    <div className="stat-card-admin glass-morphism">
      <div className="stat-content">
        <div className="stat-value">{stats.streak}</div>
        <div className="stat-label">Day Streak</div>
      </div>
      <FiZap className="stat-icon-bg" />
    </div>
    <div className="stat-card-admin glass-morphism">
      <div className="stat-content">
        <div className="stat-value">{stats.todayClasses}</div>
        <div className="stat-label">Classes Today</div>
      </div>
      <FiCalendar className="stat-icon-bg" />
    </div>
  </motion.div>
);

StatsGrid.propTypes = {
  stats: PropTypes.shape({
    attendancePercentage: PropTypes.number,
    totalClasses: PropTypes.number,
    presentClasses: PropTypes.number,
    streak: PropTypes.number,
    todayClasses: PropTypes.number,
  }).isRequired,
};

const ActiveSessionCard = ({
  session,
  onCheckIn,
  attendanceStatus = "none",
}) => {
  // attendanceStatus: "none" | "verified" | "pending" | "rejected"
  const isMarked = attendanceStatus === "verified";
  const isPending = attendanceStatus === "pending";
  const isRejected = attendanceStatus === "rejected";
  const canCheckIn = attendanceStatus === "none";

  const getStatusConfig = () => {
    if (isMarked) {
      return {
        className: "marked",
        icon: <FiCheckCircle className="inline-icon" />,
        heading: "Attendance Verified",
        badge: "VERIFIED",
        badgeClass: "verified",
        message: "✓ Your attendance has been recorded",
      };
    }
    if (isPending) {
      return {
        className: "pending",
        icon: <FiClock className="inline-icon" />,
        heading: "Verification Pending",
        badge: "PENDING",
        badgeClass: "pending",
        message: "⏳ Waiting for peer verification...",
      };
    }
    if (isRejected) {
      return {
        className: "rejected",
        icon: <FiX className="inline-icon" />,
        heading: "Attendance Rejected",
        badge: "REJECTED",
        badgeClass: "rejected",
        message:
          "❌ Your request was rejected. Contact your teacher for manual attendance.",
      };
    }
    return {
      className: "",
      icon: <FiRadio className="inline-icon" />,
      heading: "Active Session",
      badge: "LIVE NOW",
      badgeClass: "live",
      message: null,
    };
  };

  const config = getStatusConfig();

  return (
    <motion.div
      className={`active-session-center-container ${config.className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
    >
      <h2 className="active-session-heading">
        {config.icon}
        {config.heading}
        <span className={`live-badge-center ${config.badgeClass}`}>
          <span className="live-dot-center"></span> {config.badge}
        </span>
      </h2>
      {canCheckIn ? (
        <SwipeableCard onSwipeRight={() => onCheckIn(session)}>
          <motion.div
            className="active-session-card"
            onClick={() => onCheckIn(session)}
            whileTap={{ scale: 0.98 }}
          >
            <div className="module-icon-wrapper-center">
              <FiRadio className="module-icon-center" />
            </div>
            <div className="module-content-center">
              <h3 className="module-title-center">
                {session.topic || session.class?.className || "Class Session"}
              </h3>
              <p className="module-description-center">
                <strong>Subject:</strong> {session.class?.subject || "N/A"}
              </p>
              <p className="module-description-center">
                <FiMapPin className="inline-icon" /> Room:{" "}
                {session.location?.room || "N/A"}{" "}
                <span style={{ marginLeft: "14px" }}>
                  <strong>Floor:</strong> {session.location?.floor || "N/A"}
                </span>
              </p>
              <p className="module-description-center">
                <FiUser className="inline-icon" /> Instructor:{" "}
                {session.teacher?.name || "N/A"}
              </p>
              <p className="session-time-text-center">
                Started at{" "}
                {new Date(session.startTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="module-arrow-center">→</div>
          </motion.div>
        </SwipeableCard>
      ) : (
        <motion.div
          className="active-session-card"
          style={{ cursor: "default" }}
        >
          <div className="module-icon-wrapper-center">{config.icon}</div>
          <div className="module-content-center">
            <h3 className="module-title-center">
              {session.topic || session.class?.className || "Class Session"}
            </h3>
            <p className="module-description-center">
              <strong>Subject:</strong> {session.class?.subject || "N/A"}
            </p>
            <p className="session-time-text-center">{config.message}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

ActiveSessionCard.propTypes = {
  session: PropTypes.object.isRequired,
  onCheckIn: PropTypes.func.isRequired,
  attendanceStatus: PropTypes.oneOf([
    "none",
    "verified",
    "pending",
    "rejected",
  ]),
};

const UpcomingSessionsList = ({ sessions }) => (
  <motion.div
    className="upcoming-section-full"
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3 }}
  >
    <div className="section-header-row">
      <h2 className="section-heading-lg">
        <FiCalendar className="inline-icon" />
        Upcoming Today
      </h2>
      <span className="date-badge">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
      </span>
    </div>

    <div className="upcoming-timeline-list">
      {sessions.map((session, index) => (
        <motion.div
          key={session.id}
          className="upcoming-row-card glass-morphism"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + index * 0.1 }}
        >
          {/* Left: Time Column */}
          <div className="row-time-col">
            <span className="row-start-time">{session.startTime}</span>
            <div className="time-line-decoration"></div>
            <span className="row-duration">{session.duration}</span>
          </div>

          {/* Middle: Info */}
          <div className="row-info-col">
            <h3 className="row-subject">{session.subject}</h3>
            <div className="row-meta">
              <span className="meta-item">
                <FiUser /> {session.instructor}
              </span>
              <span className="meta-item">
                <FiMapPin /> {session.room} ({session.floor})
              </span>
            </div>
          </div>

          {/* Right: Action/Status */}
          <div className="row-action-col">
            <div className="status-pill upcoming">
              <FiClock /> Next
            </div>
            <button className="row-action-btn">
              <FiChevronRight />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  </motion.div>
);

UpcomingSessionsList.propTypes = {
  sessions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      subject: PropTypes.string.isRequired,
      instructor: PropTypes.string.isRequired,
      room: PropTypes.string.isRequired,
      floor: PropTypes.string.isRequired,
      startTime: PropTypes.string.isRequired,
      duration: PropTypes.string.isRequired,
    })
  ).isRequired,
};

const NoSessionsState = ({ hasUpcoming }) => (
  <motion.div
    className="no-sessions glass-morphism"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.2 }}
  >
    <FiRadio className="no-sessions-icon-bg" />
    <div className="no-sessions-content">
      <div className="no-sessions-icon-main">
        <FiRadio />
      </div>
      <h3>No Active Sessions</h3>
      <p>No classes are currently active near you.</p>
      <p className="small-text">
        {hasUpcoming
          ? "Check out your upcoming sessions below."
          : "Move closer to your classroom or wait for teacher to start session."}
      </p>
    </div>
  </motion.div>
);

NoSessionsState.propTypes = {
  hasUpcoming: PropTypes.bool,
};

const QuickActions = ({ navigate, onSubjectsOpen }) => (
  <motion.div
    className="quick-actions-section"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.5 }}
  >
    <h2 className="section-heading">Quick Actions</h2>
    <div className="quick-actions-grid">
      <motion.button
        className="quick-action-btn"
        onClick={onSubjectsOpen}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="btn-icon-glow">
          <FiBook />
        </div>
        <div className="btn-content">
          <span className="btn-title">Your Subjects</span>
          <span className="btn-desc">Teachers & Details</span>
        </div>
        <div className="btn-arrow">→</div>
      </motion.button>

      <motion.button
        className="quick-action-btn"
        onClick={() => navigate("/student/history")}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="btn-icon-glow">
          <FiFileText />
        </div>
        <div className="btn-content">
          <span className="btn-title">View History</span>
          <span className="btn-desc">Attendance records</span>
        </div>
        <div className="btn-arrow">→</div>
      </motion.button>

      <motion.button
        className="quick-action-btn"
        onClick={() => toast.info("No new notifications")}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="btn-icon-glow">
          <FiBell />
        </div>
        <div className="btn-content">
          <span className="btn-title">Notifications</span>
          <span className="btn-desc">Updates & alerts</span>
        </div>
        <div className="btn-arrow">→</div>
      </motion.button>
    </div>
  </motion.div>
);

QuickActions.propTypes = {
  navigate: PropTypes.func.isRequired,
  onSubjectsOpen: PropTypes.func.isRequired,
};

// --- Main Component ---

const StudentHome = () => {
  const navigate = useNavigate();
  const [showVerification, setShowVerification] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [classTeacher, setClassTeacher] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendanceMarkedSessions, setAttendanceMarkedSessions] = useState([]);

  // Real Data States
  const [studentStats, setStudentStats] = useState({
    attendancePercentage: 0,
    totalClasses: 0,
    presentClasses: 0,
    streak: 0,
    todayClasses: 0,
    classDetails: null,
  });

  const [upcomingSessions, setUpcomingSessions] = useState([]);

  const [weeklyData, setWeeklyData] = useState({
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    datasets: [
      {
        label: "Attendance",
        data: [0, 0, 0, 0, 0, 0],
        borderColor: "rgba(0, 212, 255, 1)",
        backgroundColor: "rgba(0, 212, 255, 0.1)",
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "rgba(0, 212, 255, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 5,
      },
    ],
  });

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      // Parallel fetching
      const [activeRes, upcomingRes, statsRes, weeklyRes, subjectsRes] =
        await Promise.all([
          fetch(`${API_BASE_URL}/api/sessions/student/active`, { headers }),
          fetch(`${API_BASE_URL}/api/sessions/student/upcoming`, { headers }),
          fetch(`${API_BASE_URL}/api/dashboard/student/stats`, { headers }),
          fetch(`${API_BASE_URL}/api/dashboard/student/weekly`, { headers }),
          fetch(`${API_BASE_URL}/api/dashboard/student/subjects`, { headers }),
        ]);

      const activeData = await activeRes.json();
      const upcomingData = await upcomingRes.json();
      const statsData = await statsRes.json();
      const weeklyDataRes = await weeklyRes.json();
      const subjectsData = await subjectsRes.json();

      if (subjectsData.status === "success") {
        setSubjects(subjectsData.data.subjects || []);
        setClassTeacher(subjectsData.data.classTeacher || null);
      }

      if (activeData.status === "success") {
        // Handle both array (legacy) and single object (new structure)
        const sessions =
          activeData.data.sessions ||
          (activeData.data.session ? [activeData.data.session] : []);
        setActiveSessions(sessions);
      }

      if (upcomingData.status === "success") {
        setUpcomingSessions(upcomingData.data.sessions || []);
      }

      if (statsData.status === "success") {
        setStudentStats(statsData.data);
      }

      if (weeklyDataRes.status === "success" && weeklyDataRes.data) {
        setWeeklyData({
          labels: weeklyDataRes.data.labels,
          datasets: [
            {
              label: "Attendance %",
              data: weeklyDataRes.data.data,
              borderColor: "rgba(0, 212, 255, 1)",
              backgroundColor: "rgba(0, 212, 255, 0.1)",
              tension: 0.4,
              fill: true,
              pointBackgroundColor: "rgba(0, 212, 255, 1)",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              pointRadius: 5,
            },
          ],
        });
      }
    } catch (error) {
      console.error("Error fetching student dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchAllData();
  };

  // Removed separate fetch functions as they are now consolidated in fetchAllData
  // kept logic functions below

  const handleCheckIn = (session) => {
    setSelectedSession(session);
    setShowVerification(true);
  };

  const handleVerificationSuccess = async (result) => {
    setShowVerification(false);

    // ✅ Update session state so LiveSessionBar appears
    if (selectedSession) {
      sessionStateManager.setActiveSession(selectedSession);
      // Store attendance status in localStorage for persistence
      localStorage.setItem(`attendance_${selectedSession._id}`, "verified");
    }

    setSelectedSession(null);
    toast.success("Attendance Marked Successfully!");
    // Refresh to get updated attendance status from server
    await fetchAllData();
  };

  const handleVerificationCancel = () => {
    setShowVerification(false);
    setSelectedSession(null);
  };

  const handleSettingToggle = (settingName) => {
    toast.info(`${settingName} Updated`);
  };

  // Chart options remain same but rely on weeklyData state now
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        max: 110,
        ticks: { color: "rgba(255, 255, 255, 0.5)" },
        grid: { color: "rgba(255, 255, 255, 0.05)" },
      },
      x: {
        ticks: { color: "rgba(255, 255, 255, 0.5)" },
        grid: { display: false },
      },
    },
    layout: { padding: { top: 10 } },
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const hasActiveSession = activeSessions.length > 0;
  const hasUpcomingSessions = upcomingSessions.length > 0;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="student-home">
        {showVerification && selectedSession && (
          <AttendanceVerificationFlow
            session={selectedSession}
            onComplete={handleVerificationSuccess}
            onCancel={handleVerificationCancel}
          />
        )}

        {/* Welcome Header */}
        <motion.div
          className="dashboard-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1
            className="dashboard-title"
            style={{
              display: "flex",
              flexWrap: "nowrap",
              whiteSpace: "nowrap",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              gap: "6px",
            }}
          >
            <span
              role="img"
              aria-label="wave"
              className="wave-emoji"
              style={{ flexShrink: 0 }}
            >
              👋
            </span>
            <span className="hi-text">Hi,</span>
            <span className="highlighted-name">{user.name || "Student"}</span>
          </h1>
          <p
            className="student-line"
            style={{
              display: "block",
              textAlign: "center",
              margin: "0 auto",
              width: "100%",
            }}
          >
            Attend class, bro… your future is already shaky enough
          </p>
        </motion.div>

        <GPSStatus />

        <StatsGrid stats={studentStats} />

        {/* Session Section - Shows Active AND/OR Upcoming */}
        <div className="sessions-section-wrapper">
          {hasActiveSession && (
            <ActiveSessionCard
              session={activeSessions[0]}
              onCheckIn={handleCheckIn}
              attendanceStatus={activeSessions[0]?.attendanceStatus || "none"}
            />
          )}

          {/* Show Upcoming Sessions BELOW active session if it exists, or as primary if not */}
          {hasUpcomingSessions ? (
            <UpcomingSessionsList sessions={upcomingSessions} />
          ) : (
            !hasActiveSession && <NoSessionsState hasUpcoming={false} />
          )}
        </div>

        {/* Chart */}
        <motion.div
          className="attendance-chart glass-morphism"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3>
            <FiActivity className="inline-icon" /> This Week&apos;s Attendance
          </h3>
          <div className="chart-container">
            <Line data={weeklyData} options={chartOptions} />
          </div>
        </motion.div>

        <br />

        <QuickActions
          navigate={navigate}
          onSubjectsOpen={() => setShowSubjectsModal(true)}
        />

        {showSubjectsModal && (
          <StudentSubjects
            subjects={subjects}
            classTeacher={classTeacher}
            onClose={() => setShowSubjectsModal(false)}
          />
        )}

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettingsModal && (
            <div className="settings-overlay">
              <motion.div
                className="settings-modal glass-morphism"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <div className="modal-header">
                  <div className="modal-logo">
                    <FiSmartphone className="logo-icon" />
                    <span className="logo-text">AttendSmart</span>
                  </div>
                  <button
                    className="close-btn"
                    onClick={() => setShowSettingsModal(false)}
                  >
                    <FiX />
                  </button>
                </div>

                <div className="settings-content">
                  <div className="setting-item">
                    <div className="setting-label">
                      <span>Dark Mode</span>
                      <p>Always On (Aurora Theme)</p>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked disabled />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-item">
                    <div className="setting-label">
                      <span>Notifications</span>
                      <p>Receive alerts for classes</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        defaultChecked
                        onChange={() => handleSettingToggle("Notifications")}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="setting-item">
                    <div className="setting-label">
                      <span>Location Access</span>
                      <p>Required for attendance</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        defaultChecked
                        onChange={() => handleSettingToggle("Location")}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="modal-footer">
                  <p>Version 1.0.0 • AttendSmart Student</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PullToRefresh>
  );
};

export default StudentHome;
