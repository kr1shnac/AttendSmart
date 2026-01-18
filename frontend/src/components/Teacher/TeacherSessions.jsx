/* eslint-disable */
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiUsers,
  FiPlay,
  FiEdit,
  FiTrash2,
  FiBarChart2,
  FiDownload,
  FiPlus,
  FiFilter,
  FiSearch,
  FiBook,
  FiActivity,
  FiTrendingUp,
  FiAlertCircle,
  FiX,
  FiArrowLeft,
  FiChevronDown,
  FiChevronRight,
} from "react-icons/fi";
import { sessionsAPI } from "../../services/api";
import toast from "../../services/toastService";
import SessionFormModal from "./SessionFormModal";
import SessionReportModal from "./SessionReportModal";
import PullToRefresh from "../common/PullToRefresh";
import "./TeacherSessions.css";

// No mock data - all data fetched from database API

// Timeline Item Component for Teacher
const TimelineItem = ({
  session,
  onViewReport,
  onExportCSV,
  onLiveSessionClick,
  getStatusConfig,
  getAttendanceColor,
}) => {
  const statusConfig = getStatusConfig(session.status);
  const isLive = session.status === "live";

  const handleCardClick = () => {
    if (isLive && onLiveSessionClick) {
      onLiveSessionClick(session);
    }
  };

  return (
    <motion.div
      className={`timeline-row ${isLive ? "clickable" : ""}`}
      initial={{ opacity: 0, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={handleCardClick}
      style={{ cursor: isLive ? "pointer" : "default" }}
    >
      <div className="timeline-date">
        <span className="date-day">
          {new Date(session.date).toLocaleDateString("en-US", {
            day: "numeric",
          })}
        </span>
        <span className="date-month">
          {new Date(session.date).toLocaleDateString("en-US", {
            month: "short",
          })}
        </span>
      </div>

      <div className="timeline-marker-wrapper">
        {/* Vertical Bar Line for Attendance/Status */}
        <div
          className="timeline-marker-bar"
          style={{
            backgroundColor:
              session.status === "completed"
                ? getAttendanceColor(session.attendance)
                : statusConfig.color,
          }}
        />
      </div>

      <div className="timeline-card glass-morphism">
        <div className="card-header">
          <div className="card-header-left">
            <h3 className="session-title">
              <span className="course-code">{session.courseCode}</span>{" "}
              {session.subject}
            </h3>
            <div className="session-meta">
              <span className="session-time">
                <FiClock /> {session.time} ({session.duration} min)
              </span>
            </div>
          </div>
          <span
            className="status-badge"
            style={{
              background: statusConfig.bg,
              borderColor: statusConfig.border,
              color: statusConfig.color,
            }}
          >
            {statusConfig.icon}
            <span>{statusConfig.label}</span>
          </span>
        </div>

        {session.topic && (
          <div className="session-topic">
            <FiBook className="topic-icon" />
            <span>{session.topic}</span>
          </div>
        )}

        <div className="session-details">
          <span className="detail-item">
            <FiMapPin /> {session.room}
          </span>
          <span className="detail-separator">•</span>
          <span className="detail-item">
            <FiUsers /> {session.expectedStudents} students
          </span>
        </div>

        {session.status === "completed" && session.attendance !== undefined && (
          <div className="attendance-section">
            <div className="attendance-header">
              <span>Attendance</span>
              <span
                className="attendance-percentage"
                style={{
                  color: getAttendanceColor(session.attendance),
                }}
              >
                {session.attendance}%
              </span>
            </div>
            <div className="attendance-bar">
              <motion.div
                className="attendance-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${session.attendance}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                style={{
                  background: getAttendanceColor(session.attendance),
                }}
              />
            </div>
            <div className="attendance-stats">
              <span className="stat-item present">
                <FiCheckCircle /> {session.presentStudents} Present
              </span>
              <span className="stat-item absent">
                <FiX /> {session.expectedStudents - session.presentStudents}{" "}
                Absent
              </span>
            </div>
          </div>
        )}

        <div className="session-actions">
          {isLive && (
            <button
              className="action-btn live-action"
              onClick={(e) => {
                e.stopPropagation();
                if (onLiveSessionClick) onLiveSessionClick(session);
              }}
            >
              <FiPlay />
              <span>Return to Session</span>
            </button>
          )}
          {session.status === "completed" && (
            <>
              <button
                className="action-btn"
                onClick={() => onViewReport(session)}
              >
                <FiBarChart2 />
                <span>Report</span>
              </button>
              <button
                className="action-btn"
                onClick={() => onExportCSV(session)}
              >
                <FiDownload />
                <span>Export</span>
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Timeline Day Group Component
const TimelineDayGroup = ({
  date,
  sessions,
  isExpanded,
  onToggle,
  onViewReport,
  onExportCSV,
  getStatusConfig,
  getAttendanceColor,
}) => {
  return (
    <div className="timeline-day-group">
      <div className="timeline-day-header" onClick={onToggle}>
        <div className="timeline-day-info">
          <span className="timeline-day-name">
            {new Date(date).toLocaleDateString("en-US", { weekday: "long" })}
          </span>
          <span className="timeline-day-date">
            {new Date(date).toLocaleDateString()}
          </span>
        </div>
        {onToggle && (isExpanded ? <FiChevronDown /> : <FiChevronRight />)}
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="timeline-day-sessions"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {sessions.map((session, idx) => (
              <TimelineItem
                key={session.id || idx}
                session={session}
                onViewReport={onViewReport}
                onExportCSV={onExportCSV}
                getStatusConfig={getStatusConfig}
                getAttendanceColor={getAttendanceColor}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TeacherSessions = () => {
  // ... (existing state and hooks)
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionsData, setSessionsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [reportSession, setReportSession] = useState(null);
  const [expandedDays, setExpandedDays] = useState({}); // Changed to object for dynamic keys

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      // Try fetching from real API first
      const response = await sessionsAPI.getMySessions();

      // Handle response - check for various data structures
      let sessionsData = [];
      if (response.data?.sessions) {
        sessionsData = response.data.sessions;
      } else if (response.sessions) {
        sessionsData = response.sessions;
      } else if (Array.isArray(response.data)) {
        sessionsData = response.data;
      } else if (Array.isArray(response)) {
        sessionsData = response;
      }

      // If API returns sessions, use them
      if (sessionsData.length > 0) {
        // Transform API data to match component format
        const transformedSessions = sessionsData.map((session) => ({
          id: session._id || session.id,
          subject:
            session.class?.subject || session.subject || "Unknown Subject",
          courseCode: session.class?.courseCode || session.courseCode || "N/A",
          className:
            session.class?.className || session.className || "Unknown Class",
          topic: session.topic || "",
          date: new Date(session.startTime || session.date),
          time: new Date(session.startTime || session.date).toLocaleTimeString(
            "en-US",
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          ),
          duration: session.duration || 60,
          // Handle location as object or string
          room:
            typeof session.location === "object"
              ? session.location?.room || session.location?.building || "TBA"
              : session.location || session.room || "TBA",
          floor: session.floor || "",
          status: session.status || "scheduled",
          expectedStudents:
            session.expectedStudents || session.class?.totalStudents || 0,
          presentStudents:
            session.statistics?.presentCount || session.presentStudents || 0,
          attendance:
            session.statistics?.attendanceRate || session.attendance || 0,
        }));
        setSessionsData(transformedSessions);
        console.log(
          `✅ Loaded ${transformedSessions.length} sessions from API`
        );
      } else {
        // No sessions in database
        console.log("ℹ️ No sessions found in database");
        setSessionsData([]);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      // Show empty state on error
      setSessionsData([]);
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchSessions();
  };

  const handleCreateSession = (newSession) => {
    const sessionWithId = {
      ...newSession,
      id: `sess-${Date.now()}`,
      status: "scheduled",
      attendance: 0,
      presentStudents: 0,
      expectedStudents: newSession.expectedStudents || 0, // Use actual value from form
    };
    setSessionsData((prev) => [sessionWithId, ...prev]);
    setShowCreateModal(false);
    toast.success("Session created successfully");
  };

  const handleViewReport = (session) => {
    setReportSession(session);
  };

  const handleExportCSV = (session) => {
    toast.success(`Exporting CSV for ${session.subject}...`);
    // Mock export logic
    setTimeout(() => {
      toast.success("CSV downloaded successfully");
    }, 1500);
  };

  const handleLiveSessionClick = (session) => {
    // Navigate to the live monitor page for this session
    navigate(`/teacher/live-monitor/${session.id}`);
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "live":
        return {
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.1)",
          border: "rgba(239, 68, 68, 0.2)",
          icon: <FiActivity />,
          label: "Live Now",
        };
      case "upcoming":
      case "scheduled":
        return {
          color: "#0ea5e9",
          bg: "rgba(14, 165, 233, 0.1)",
          border: "rgba(14, 165, 233, 0.2)",
          icon: <FiClock />,
          label: "Upcoming",
        };
      case "completed":
        return {
          color: "#10b981",
          bg: "rgba(16, 185, 129, 0.1)",
          border: "rgba(16, 185, 129, 0.2)",
          icon: <FiCheckCircle />,
          label: "Completed",
        };
      case "cancelled":
        return {
          color: "#6b7280",
          bg: "rgba(107, 114, 128, 0.1)",
          border: "rgba(107, 114, 128, 0.2)",
          icon: <FiX />,
          label: "Cancelled",
        };
      default:
        return {
          color: "#6b7280",
          bg: "rgba(107, 114, 128, 0.1)",
          border: "rgba(107, 114, 128, 0.2)",
          icon: <FiClock />,
          label: status,
        };
    }
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return "#10b981"; // Green
    if (percentage >= 75) return "#3b82f6"; // Blue
    if (percentage >= 60) return "#f59e0b"; // Orange
    return "#ef4444"; // Red
  };

  // Filter sessions
  const filteredSessions = sessionsData.filter((session) => {
    const matchesStatus =
      filterStatus === "all" || session.status === filterStatus;
    const matchesClass =
      filterClass === "all" || session.className === filterClass;
    const matchesSearch =
      (session.subject || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (session.courseCode || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesStatus && matchesClass && matchesSearch;
  });

  // Categorize sessions
  const liveSessions = filteredSessions.filter((s) => s.status === "live");
  const upcomingSessions = filteredSessions.filter(
    (s) => s.status === "scheduled" || s.status === "upcoming"
  );
  const pastSessions = filteredSessions.filter(
    (s) => s.status === "completed" || s.status === "cancelled"
  );

  const toggleDay = (dateKey) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  // Group past sessions by date
  const groupedPastSessions = useMemo(() => {
    const groups = {};
    pastSessions.forEach((session) => {
      const dateKey = new Date(session.date).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(session);
    });
    return groups;
  }, [pastSessions]);

  // Initialize expanded state for new dates
  useEffect(() => {
    const newExpanded = { ...expandedDays };
    Object.keys(groupedPastSessions).forEach((date) => {
      if (newExpanded[date] === undefined) {
        newExpanded[date] = true; // Default to expanded
      }
    });
    setExpandedDays(newExpanded);
  }, [groupedPastSessions]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="teacher-sessions">
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
          className="sessions-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="header-content">
            <div className="header-text">
              <h1 className="section-heading">Sessions</h1>
              <p className="subtitle">
                Manage your class sessions and attendance
              </p>
            </div>
          </div>
        </motion.div>

        <div className="stats-grid">
          <motion.div
            className="stat-card glass-morphism"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="stat-content">
              <div className="stat-value">{sessionsData.length}</div>
              <div className="stat-label">Total Sessions</div>
            </div>
            <FiCalendar className="stat-icon-bg" />
          </motion.div>

          <motion.div
            className="stat-card glass-morphism"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="stat-content">
              <div className="stat-value">
                {Math.round(
                  sessionsData.reduce(
                    (acc, curr) => acc + (curr.attendance || 0),
                    0
                  ) / (sessionsData.filter((s) => s.attendance).length || 1)
                )}
                %
              </div>
              <div className="stat-label">Avg Attendance</div>
            </div>
            <FiTrendingUp className="stat-icon-bg" />
          </motion.div>

          <motion.div
            className="stat-card glass-morphism"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="stat-content">
              <div className="stat-value">
                {
                  sessionsData.filter(
                    (s) => s.status === "scheduled" || s.status === "upcoming"
                  ).length
                }
              </div>
              <div className="stat-label">Upcoming</div>
            </div>
            <FiClock className="stat-icon-bg" />
          </motion.div>
        </div>

        <div className="controls-section">
          <div className="search-bar glass-morphism">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="clear-search"
                onClick={() => setSearchQuery("")}
              >
                <FiX />
              </button>
            )}
          </div>

          <button
            className="filter-toggle-btn glass-morphism"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter /> Filters
            {(filterStatus !== "all" || filterClass !== "all") && (
              <span className="filter-badge" />
            )}
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              className="filters-panel glass-morphism"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="filter-group">
                <label>
                  <FiActivity /> Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="filter-group">
                <label>
                  <FiBook /> Class
                </label>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Classes</option>
                  <option value="CS 3rd Year - Section A">
                    CS 3rd Year - Sec A
                  </option>
                  <option value="CS 3rd Year - Section B">
                    CS 3rd Year - Sec B
                  </option>
                  <option value="CS 4th Year - Section A">
                    CS 4th Year - Sec A
                  </option>
                </select>
              </div>

              <div className="filter-results">
                <span className="results-count">{filteredSessions.length}</span>{" "}
                sessions found
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sessions-section">
          {/* Live Sessions - Keep as is */}
          {liveSessions.length > 0 && (
            // ... (Live sessions rendering)
            <div className="session-group">
              <h2 className="section-title live">
                <FiActivity /> Live Now
              </h2>
              <div className="timeline-wrapper">
                {liveSessions.map((session, index) => (
                  <TimelineItem
                    key={session.id || index}
                    session={session}
                    onViewReport={handleViewReport}
                    onExportCSV={handleExportCSV}
                    onLiveSessionClick={handleLiveSessionClick}
                    getStatusConfig={getStatusConfig}
                    getAttendanceColor={getAttendanceColor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Sessions - Keep as is */}
          {upcomingSessions.length > 0 && (
            <div className="session-group">
              <h2 className="section-title upcoming">
                <FiClock /> Upcoming Sessions
              </h2>
              <div className="timeline-wrapper">
                {upcomingSessions.map((session, index) => (
                  <TimelineItem
                    key={session.id || index}
                    session={session}
                    onViewReport={handleViewReport}
                    onExportCSV={handleExportCSV}
                    getStatusConfig={getStatusConfig}
                    getAttendanceColor={getAttendanceColor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past Sessions - Grouped by Date */}
          {Object.keys(groupedPastSessions).length > 0 && (
            <div className="session-group">
              <h2 className="section-title past">
                <FiCheckCircle /> Past Sessions
              </h2>
              <div className="timeline-wrapper">
                {Object.entries(groupedPastSessions).map(([date, sessions]) => (
                  <TimelineDayGroup
                    key={date}
                    date={date}
                    sessions={sessions}
                    isExpanded={expandedDays[date]}
                    onToggle={() => toggleDay(date)}
                    onViewReport={handleViewReport}
                    onExportCSV={handleExportCSV}
                    getStatusConfig={getStatusConfig}
                    getAttendanceColor={getAttendanceColor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No sessions found */}
          {filteredSessions.length === 0 && (
            <motion.div
              className="no-sessions glass-morphism"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <FiCalendar className="no-sessions-icon-bg" />
              <div className="no-sessions-content">
                <div className="no-sessions-icon-main">
                  <FiAlertCircle />
                </div>
                <h3>No Sessions Found</h3>
                <p>
                  {searchQuery
                    ? `No sessions match "${searchQuery}"`
                    : "You haven't created any sessions yet"}
                </p>
                <button
                  className="create-first-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  <FiPlus />
                  <span>Create Your First Session</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <SessionFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateSession}
        />

        <AnimatePresence>
          {reportSession && (
            <SessionReportModal
              session={reportSession}
              onClose={() => setReportSession(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </PullToRefresh>
  );
};

export default TeacherSessions;
