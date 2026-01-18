/* eslint-disable */
import React, {
  useState,
  useEffect,
  Suspense,
  lazy,
  useMemo,
  useCallback,
} from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft,
  FaSearch,
  FaSortAmountDown,
  FaTimes,
  FaUserGraduate,
} from "react-icons/fa";
import {
  FiUsers,
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiBarChart,
  FiCalendar,
  FiTrendingUp,
} from "react-icons/fi";

import LiveMonitor from "./LiveMonitor";
import StudentDetailModal from "./StudentDetailModal";
import { classesAPI } from "../../services/api";
import "./ClassDetailView.css";

// Lazy load heavy tabs
const ClassCalendar = lazy(() => import("./ClassCalendar"));
const ClassAnalytics = lazy(() => import("./ClassAnalytics"));
const ClassSessions = lazy(() => import("./ClassSessions"));

const tabs = [
  { id: "overview", label: "Overview", icon: FiBarChart },
  { id: "students", label: "Students", icon: FiUsers },
  { id: "sessions", label: "Sessions", icon: FiCalendar },
  { id: "analytics", label: "Analytics", icon: FiTrendingUp },
];

const StartSessionButton = ({ onClick }) => (
  <button className="start-session-btn" onClick={onClick} type="button">
    Start Attendance
  </button>
);

// ========== HELPER FUNCTIONS ==========

// Helper: Get initials from name
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Helper: Format last activity timestamp
const formatLastActivity = (timestamp) => {
  if (!timestamp) return "No activity";
  const now = new Date();
  const activityDate = new Date(timestamp);
  const diffMs = now - activityDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return activityDate.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
};

// Helper: Attendance category
const getAttendanceCategory = (percentage) => {
  if (percentage >= 90) return "excellent";
  if (percentage >= 75) return "good";
  if (percentage >= 60) return "average";
  return "poor";
};

// ========== MAIN COMPONENT ==========

const ClassDetailView = ({ classData: initialClassData, onBack }) => {
  const [classData, setClassData] = useState(initialClassData);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterMode, setFilterMode] = useState("all");

  const studentsList = Array.isArray(classData.students)
    ? classData.students
    : [];

  useEffect(() => {
    async function fetchClassDetails() {
      if (!classData._id) return;
      try {
        setLoading(true);
        setError(null);
        const response = await classesAPI.getById(classData._id);
        const fetchedClass = response.data?.class || response.data || response;
        const transformedData = {
          ...fetchedClass,
          averageAttendance:
            fetchedClass.averageAttendance ??
            fetchedClass.overallAttendance ??
            0,
          overallAttendance:
            fetchedClass.overallAttendance ??
            fetchedClass.averageAttendance ??
            0,
        };
        setClassData(transformedData);
      } catch (err) {
        console.error("Failed to load class details:", err);
        setError("Failed to load class details.");
      } finally {
        setLoading(false);
      }
    }
    fetchClassDetails();
  }, [classData._id]);

  // Filter by category first
  const filteredByCategory = useMemo(() => {
    if (filterMode === "all") return studentsList;
    if (filterMode === "excellent")
      return studentsList.filter(
        (s) => ((s.studentId || s).attendance || 0) >= 90
      );
    if (filterMode === "good")
      return studentsList.filter((s) => {
        const att = (s.studentId || s).attendance || 0;
        return att >= 75 && att < 90;
      });
    if (filterMode === "average")
      return studentsList.filter((s) => {
        const att = (s.studentId || s).attendance || 0;
        return att >= 60 && att < 75;
      });
    if (filterMode === "atrisk")
      return studentsList.filter(
        (s) => ((s.studentId || s).attendance || 0) < 60
      );
    return studentsList;
  }, [studentsList, filterMode]);

  // Then filter by search term (Name & USN only)
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return filteredByCategory;

    const searchLower = searchTerm.toLowerCase();
    return filteredByCategory.filter((student) => {
      const details = student.studentId || student;
      return (
        details.name?.toLowerCase().includes(searchLower) ||
        details.usn?.toLowerCase().includes(searchLower)
      );
    });
  }, [filteredByCategory, searchTerm]);

  // Sort by USN ascending (stable, teacher-preferred)
  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      const usnA = (a.studentId || a).usn || "";
      const usnB = (b.studentId || b).usn || "";
      return usnA.localeCompare(usnB);
    });
  }, [filteredStudents]);

  const handleStartSession = useCallback((sessionData) => {
    setActiveSession(sessionData);
    setShowSessionModal(false);
  }, []);

  if (activeSession) {
    return (
      <LiveMonitor
        session={activeSession}
        classData={classData}
        onEndSession={() => setActiveSession(null)}
      />
    );
  }

  if (loading)
    return <div className="loading-screen">Loading class details...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="class-detail-view">
      <motion.div
        className="detail-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button className="back-btn" type="button" onClick={onBack}>
          <FaArrowLeft />
          <span>Back to Classes</span>
        </button>
        <div className="class-title-section">
          <h1>{classData.subject}</h1>
          <div className="class-meta-info">
            <span className="meta-badge">{classData.courseCode}</span>
            <span className="meta-text">{classData.className}</span>
            <span className="meta-text">• Semester {classData.semester}</span>
          </div>
        </div>
      </motion.div>

      <hr className="section-divider" />

      <nav
        className="segmented-tab-nav"
        role="tablist"
        aria-label="Class sections"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`segmented-tab-button ${
              activeTab === id ? "active" : ""
            }`}
            aria-selected={activeTab === id}
            role="tab"
            onClick={() => setActiveTab(id)}
          >
            <Icon className="tab-icon" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <div className="quick-stats-grid">
            <div className="stat-card-admin glass-morphism">
              <div className="stat-content">
                <div className="stat-value">
                  {classData.totalStudents || studentsList.length || 0}
                </div>
                <div className="stat-label">Total Students</div>
              </div>
              <FiUsers className="stat-icon-bg" />
            </div>
            <div className="stat-card-admin glass-morphism">
              <div className="stat-content">
                <div className="stat-value">
                  {classData.activeSessions?.length || 0}
                </div>
                <div className="stat-label">Active Sessions</div>
              </div>
              <FiActivity className="stat-icon-bg" />
            </div>
            <div className="stat-card-admin glass-morphism">
              <div className="stat-content">
                <div className="stat-value">
                  {classData.averageAttendance ||
                    classData.overallAttendance ||
                    0}
                  %
                </div>
                <div className="stat-label">Avg Attendance</div>
              </div>
              <FiCheckCircle className="stat-icon-bg" />
            </div>
            <div className="stat-card-admin glass-morphism">
              <div className="stat-content">
                <div className="stat-value">{classData.todayClasses || 0}</div>
                <div className="stat-label">Classes Today</div>
              </div>
              <FiClock className="stat-icon-bg" />
            </div>
          </div>

          <Suspense
            fallback={
              <div className="loading-section">Loading Calendar...</div>
            }
          >
            <ClassCalendar
              classData={classData}
              onScheduleSession={(session) =>
                console.log("Scheduled:", session)
              }
            />
          </Suspense>
        </>
      )}

      {activeTab === "students" && (
        <motion.div
          className="students-section-clean"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Controls Bar */}
          <div className="students-controls-bar">
            {/* Filter Dropdown */}
            <div className="filter-dropdown-container">
              <select
                className="filter-dropdown"
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
              >
                <option value="all">All Students</option>
                <option value="excellent">⭐ Excellent (≥90%)</option>
                <option value="good">✓ Good (75-89%)</option>
                <option value="average">⚠ Average (60-74%)</option>
                <option value="atrisk">🚨 At Risk (&lt;60%)</option>
              </select>
            </div>

            {/* Search */}
            <div className="search-container-clean">
              <FaSearch className="search-icon-clean" />
              <input
                type="text"
                className="search-input-clean"
                placeholder="Search name or USN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchTerm("")}
                >
                  <FaTimes />
                </button>
              )}
            </div>
          </div>

          {/* Results Info */}
          <div className="results-count">
            Showing {sortedStudents.length} of {studentsList.length} students
            {searchTerm && (
              <span className="search-term-highlight">
                matching "{searchTerm}"
              </span>
            )}
          </div>

          {/* Students Table */}
          <div className="students-table-wrapper">
            {/* Desktop Table */}
            <div className="students-table desktop-only">
              {/* Header */}
              <div className="table-header-clean">
                <div className="th th-avatar">Avatar</div>
                <div className="th th-name">Name</div>
                <div className="th th-usn">USN</div>
                <div className="th th-attendance">Attendance</div>
                <div className="th th-counts">P / A</div>
                <div className="th th-activity">Last Activity</div>
              </div>

              {/* Body */}
              <div className="table-body-clean">
                {sortedStudents.length > 0 ? (
                  sortedStudents.map((student, index) => {
                    const details = student.studentId || student;
                    const category = getAttendanceCategory(
                      details.attendance || 0
                    );
                    return (
                      <motion.div
                        key={student._id || index}
                        className={`table-row-clean ${category}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        whileHover={{
                          x: 6,
                          backgroundColor: "rgba(0, 212, 255, 0.08)",
                        }}
                        onClick={() => setSelectedStudent(details)}
                      >
                        {/* Avatar */}
                        <div className="td td-avatar">
                          <div className={`student-avatar-small ${category}`}>
                            {details.photo ? (
                              <img src={details.photo} alt={details.name} />
                            ) : (
                              <span>{getInitials(details.name)}</span>
                            )}
                          </div>
                        </div>

                        {/* Name */}
                        <div className="td td-name">
                          {details.name || "N/A"}
                        </div>

                        {/* USN */}
                        <div className="td td-usn">
                          <span className="usn-chip">
                            {details.usn || "N/A"}
                          </span>
                        </div>

                        {/* Attendance Bar */}
                        <div className="td td-attendance">
                          <div className="attendance-bar-inline">
                            <div className="bar-container">
                              <motion.div
                                className={`bar-fill ${category}`}
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${details.attendance || 0}%`,
                                }}
                                transition={{
                                  duration: 0.6,
                                  delay: index * 0.02,
                                }}
                              />
                            </div>
                            <span className={`bar-percentage ${category}`}>
                              {(details.attendance || 0).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* P/A Counts */}
                        <div className="td td-counts">
                          <span className="count-present">
                            {details.totalPresent || 0}
                          </span>
                          <span className="count-separator">/</span>
                          <span className="count-absent">
                            {details.totalAbsent || 0}
                          </span>
                        </div>

                        {/* Last Activity */}
                        <div className="td td-activity">
                          {formatLastActivity(details.lastCheckIn)}
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="no-students-row">
                    <FaUserGraduate className="no-students-icon" />
                    <p>No students found</p>
                    {searchTerm && (
                      <button
                        className="clear-filters-btn"
                        onClick={() => {
                          setSearchTerm("");
                          setFilterMode("all");
                        }}
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Table */}
            <div className="students-table mobile-only">
              {/* Header */}
              <div className="table-header-mobile">
                <div className="th th-name-mobile">Name</div>
                <div className="th th-usn-mobile">USN</div>
                <div className="th th-attendance-mobile">Attendance</div>
              </div>

              {/* Body */}
              <div className="table-body-mobile">
                {sortedStudents.length > 0 ? (
                  sortedStudents.map((student, index) => {
                    const details = student.studentId || student;
                    const category = getAttendanceCategory(
                      details.attendance || 0
                    );
                    return (
                      <motion.div
                        key={student._id || index}
                        className={`table-row-mobile ${category}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedStudent(details)}
                      >
                        {/* Name */}
                        <div className="td-mobile td-name-mobile">
                          <span className="student-name-mobile">
                            {details.name || "N/A"}
                          </span>
                        </div>

                        {/* USN */}
                        <div className="td-mobile td-usn-mobile">
                          <span className="usn-chip-mobile">
                            {details.usn || "N/A"}
                          </span>
                        </div>

                        {/* Attendance */}
                        <div className="td-mobile td-attendance-mobile">
                          <div className="attendance-mobile-wrapper">
                            <div className="bar-mini">
                              <motion.div
                                className={`bar-fill-mini ${category}`}
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${details.attendance || 0}%`,
                                }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                            <span className={`percentage-mobile ${category}`}>
                              {(details.attendance || 0).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="no-students-mobile">
                    <FaUserGraduate />
                    <p>No students found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "sessions" && (
        <Suspense
          fallback={<div className="loading-section">Loading Sessions...</div>}
        >
          <ClassSessions
            classData={classData}
            onStartLiveAttendance={handleStartSession}
          />
        </Suspense>
      )}
      {activeTab === "analytics" && (
        <Suspense
          fallback={<div className="loading-section">Loading Analytics...</div>}
        >
          <ClassAnalytics classData={classData} />
        </Suspense>
      )}

      <AnimatePresence>
        {showSessionModal && (
          <SessionFormModal
            isOpen={showSessionModal}
            classData={classData}
            onClose={() => setShowSessionModal(false)}
            onSave={handleStartSession}
          />
        )}
        {selectedStudent && (
          <StudentDetailModal
            student={selectedStudent}
            onClose={() => setSelectedStudent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

ClassDetailView.propTypes = {
  classData: PropTypes.object.isRequired,
  onBack: PropTypes.func.isRequired,
};

StartSessionButton.propTypes = {
  onClick: PropTypes.func.isRequired,
};

export default ClassDetailView;
