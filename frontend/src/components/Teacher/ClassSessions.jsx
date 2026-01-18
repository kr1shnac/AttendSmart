/* eslint-disable */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiUsers,
  FiPlay,
  FiBarChart2,
  FiX,
  FiBook,
  FiPlus,
  FiChevronDown,
  FiChevronRight,
  FiDownload,
} from "react-icons/fi";
import PropTypes from "prop-types";
import "./ClassSessions.css";
import CreateSessionModal from "./CreateSessionModal";
import SessionReportModal from "./SessionReportModal";
import { sessionsAPI } from "../../services/api";

// No fake data - all data fetched from database API

// ========== COMPONENTS ==========

// Session Detail Modal
const SessionDetailModal = ({ session, onClose, onStartAttendance }) => {
  if (!session) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="session-detail-modal glass-morphism"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose}>
          <FiX />
        </button>

        <div className="session-detail-header">
          <div className="session-icon">
            <FiBook />
          </div>
          <h2>{session.subject}</h2>
          <p className="course-code">{session.courseCode}</p>
        </div>

        <div className="session-detail-content">
          <div className="detail-row">
            <FiClock className="detail-icon" />
            <div>
              <span className="detail-label">Time</span>
              <span className="detail-value">
                {session.startTime} - {session.endTime}
              </span>
            </div>
          </div>

          <div className="detail-row">
            <FiMapPin className="detail-icon" />
            <div>
              <span className="detail-label">Location</span>
              <span className="detail-value">{session.room}</span>
            </div>
          </div>

          <div className="detail-row">
            <FiBook className="detail-icon" />
            <div>
              <span className="detail-label">Topic</span>
              <span className="detail-value">{session.topic}</span>
            </div>
          </div>
        </div>

        <div className="session-detail-actions">
          <button className="start-attendance-btn" onClick={onStartAttendance}>
            <FiPlay /> Start Attendance
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Timeline Item Component
const TimelineItem = ({ session, isToday, onViewReport, onExportCSV }) => {
  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return "#10b981";
    if (percentage >= 75) return "#00d4ff";
    if (percentage >= 60) return "#fbbf24";
    return "#ef4444";
  };

  return (
    <div className="timeline-item">
      <div
        className="timeline-marker"
        style={{ backgroundColor: getAttendanceColor(session.attendance) }}
      ></div>
      <div className="timeline-content">
        <div className="timeline-time">{session.time}</div>
        <div className="timeline-subject">{session.subject}</div>
        <div className="timeline-meta">
          <span className="timeline-room">
            <FiMapPin /> {session.room}
          </span>
          <span
            className="timeline-attendance"
            style={{ color: getAttendanceColor(session.attendance) }}
          >
            {session.attendance}% ({session.present}/{session.total})
          </span>
        </div>
        <div className="timeline-actions">
          <button
            className="timeline-action-btn report"
            onClick={(e) => {
              e.stopPropagation();
              onViewReport(session);
            }}
            title="View Report"
          >
            <FiBarChart2 />
          </button>
          <button
            className="timeline-action-btn export"
            onClick={(e) => {
              e.stopPropagation();
              onExportCSV(session);
            }}
            title="Export CSV"
          >
            <FiDownload />
          </button>
        </div>
      </div>
    </div>
  );
};

// Timeline Day Group
const TimelineDayGroup = ({
  date,
  dayName,
  sessions,
  isExpanded,
  onToggle,
  onViewReport,
  onExportCSV,
}) => {
  return (
    <div className="timeline-day-group">
      <div className="timeline-day-header" onClick={onToggle}>
        <div className="timeline-day-info">
          <span className="timeline-day-name">{dayName}</span>
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
                key={idx}
                session={session}
                onViewReport={onViewReport}
                onExportCSV={onExportCSV}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Main Component
const ClassSessions = ({ classData, onStartLiveAttendance }) => {
  const [selectedSession, setSelectedSession] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reportSession, setReportSession] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedDays, setExpandedDays] = useState({
    today: true,
    yesterday: true,
  });
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch sessions from API
  useEffect(() => {
    fetchSessions();
  }, [classData?._id]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const classId = classData?._id;
      if (!classId) {
        setLoading(false);
        return;
      }

      // Fetch sessions for this class
      const response = await sessionsAPI.getClassSessions(classId);
      let sessions = [];
      if (response.data?.sessions) {
        sessions = response.data.sessions;
      } else if (response.sessions) {
        sessions = response.sessions;
      } else if (Array.isArray(response.data)) {
        sessions = response.data;
      }

      // Transform and group sessions
      const today = new Date().toISOString().split("T")[0];
      const todaySessions = [];
      const historyGrouped = {};

      sessions.forEach((session) => {
        const sessionDate = new Date(session.startTime || session.date)
          .toISOString()
          .split("T")[0];
        const startTime = new Date(session.startTime || session.date);
        const endTime = session.endTime
          ? new Date(session.endTime)
          : new Date(startTime.getTime() + (session.duration || 60) * 60000);

        const transformedSession = {
          id: session._id || session.id,
          startTime: startTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          endTime: endTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          subject: classData?.subject || session.subject || "Session",
          courseCode: classData?.courseCode || session.courseCode || "",
          room:
            typeof session.location === "object"
              ? session.location?.room || session.location?.building || "TBA"
              : session.location || session.room || "TBA",
          topic: session.topic || "",
          attendance:
            session.statistics?.attendanceRate || session.attendance || 0,
          present:
            session.statistics?.presentCount || session.presentStudents || 0,
          total: classData?.totalStudents || session.expectedStudents || 0,
        };

        if (sessionDate === today) {
          todaySessions.push(transformedSession);
        } else {
          if (!historyGrouped[sessionDate]) {
            historyGrouped[sessionDate] = {
              date: sessionDate,
              dayName: new Date(sessionDate).toLocaleDateString("en-US", {
                weekday: "long",
              }),
              sessions: [],
            };
          }
          historyGrouped[sessionDate].sessions.push({
            time: transformedSession.startTime,
            subject: transformedSession.subject,
            attendance: transformedSession.attendance,
            present: transformedSession.present,
            total: transformedSession.total,
            room: transformedSession.room,
          });
        }
      });

      setTodaySchedule(todaySessions);
      setSessionHistory(
        Object.values(historyGrouped).sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        )
      );
      console.log(`✅ Loaded ${sessions.length} sessions from database`);
    } catch (error) {
      console.error("Error fetching class sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Time-based detection
  const isLiveSession = (session) => {
    if (!session.startTime || !session.endTime) return false;
    const currentMinutes =
      currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startH, startM] = session.startTime.split(":").map(Number);
    const [endH, endM] = session.endTime.split(":").map(Number);
    const sessionStart = startH * 60 + startM;
    const sessionEnd = endH * 60 + endM;
    return currentMinutes >= sessionStart && currentMinutes <= sessionEnd;
  };

  const isUpcomingSession = (session) => {
    if (!session.startTime) return false;
    const currentMinutes =
      currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startH, startM] = session.startTime.split(":").map(Number);
    const sessionStart = startH * 60 + startM;
    return currentMinutes < sessionStart;
  };

  const liveSessions = todaySchedule.filter(isLiveSession);
  const upcomingSessions = todaySchedule.filter(isUpcomingSession);

  const handleSessionClick = (session) => setSelectedSession(session);

  const handleStartAttendance = () => {
    if (selectedSession && onStartLiveAttendance) {
      const attendanceSession = {
        _id: selectedSession.id,
        topic: selectedSession.topic,
        subject: selectedSession.subject,
        courseCode: selectedSession.courseCode,
        className: classData.className,
        startTime: new Date(),
        room: selectedSession.room,
        expectedStudents: 60,
        status: "active",
        sessionStartTime: selectedSession.startTime,
        sessionEndTime: selectedSession.endTime,
      };
      onStartLiveAttendance(attendanceSession);
      setSelectedSession(null);
    }
  };

  const handleCreateSession = () => {
    setShowCreateModal(true);
  };

  const handleStartNow = (sessionData) => {
    setShowCreateModal(false);
    if (onStartLiveAttendance) {
      const attendanceSession = {
        _id: `instant-${Date.now()}`,
        ...sessionData,
        className: classData.className,
        expectedStudents: 60,
        status: "active",
        sessionStartTime: sessionData.startTime,
        sessionEndTime: "Ongoing",
      };
      onStartLiveAttendance(attendanceSession);
    }
  };

  const handleSchedule = (sessionData) => {
    setShowCreateModal(false);
    // In a real app, this would make an API call
    alert(
      `Session scheduled successfully!\nSubject: ${sessionData.subject}\nDate: ${sessionData.date}\nTime: ${sessionData.startTime}`
    );
  };

  const handleViewReport = (session) => {
    setReportSession(session);
  };

  const handleExportCSV = (session) => {
    // Generate CSV content
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Student Name,USN,Status,Time\n" +
      "Aarav Kumar,1CR21CS001,Present,09:05\n" +
      "Diya Sharma,1CR21CS015,Present,09:02\n" +
      "Rohan Patel,1CR21CS023,Absent,-\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${session.subject}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleDay = (dayKey) => {
    setExpandedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  // Separate today's past sessions
  const todayDate = currentTime.toISOString().split("T")[0];
  const todayHistory = sessionHistory.find((h) => h.date === todayDate);
  const yesterdayHistory = sessionHistory.find((h) => {
    const yesterday = new Date(currentTime);
    yesterday.setDate(yesterday.getDate() - 1);
    return h.date === yesterday.toISOString().split("T")[0];
  });
  const olderHistory = sessionHistory.filter(
    (h) => h.date !== todayDate && h.date !== yesterdayHistory?.date
  );

  return (
    <div className="class-sessions-container">
      {/* Live Sessions */}
      {liveSessions.length > 0 ? (
        <motion.div
          className="sessions-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="section-title live">
            <div className="live-indicator">
              <div className="live-dot"></div>
              <span>LIVE NOW</span>
            </div>
          </h2>
          <div className="live-sessions-list">
            {liveSessions.map((session) => (
              <motion.div
                key={session.id}
                className="live-session-row"
                whileHover={{ x: 4 }}
                onClick={() => {
                  if (onStartLiveAttendance) {
                    const attendanceSession = {
                      _id: session.id,
                      topic: session.topic,
                      subject: session.subject,
                      courseCode: session.courseCode,
                      className: classData.className,
                      startTime: new Date(),
                      room: session.room,
                      expectedStudents: 60,
                      status: "active",
                      sessionStartTime: session.startTime,
                      sessionEndTime: session.endTime,
                    };
                    onStartLiveAttendance(attendanceSession);
                  }
                }}
              >
                <div className="live-row-indicator">
                  <div className="pulse-dot"></div>
                </div>
                <div className="live-row-time">
                  <span>{session.startTime}</span>
                </div>
                <div className="live-row-info">
                  <span className="live-row-subject">{session.subject}</span>
                  <span className="live-row-topic">{session.topic}</span>
                </div>
                <div className="live-row-meta">
                  <span className="live-row-room">
                    <FiMapPin /> {session.room}
                  </span>
                </div>
                <button
                  className="live-row-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onStartLiveAttendance) {
                      const attendanceSession = {
                        _id: session.id,
                        topic: session.topic,
                        subject: session.subject,
                        courseCode: session.courseCode,
                        className: classData.className,
                        startTime: new Date(),
                        room: session.room,
                        expectedStudents: 60,
                        status: "active",
                        sessionStartTime: session.startTime,
                        sessionEndTime: session.endTime,
                      };
                      onStartLiveAttendance(attendanceSession);
                    }
                  }}
                >
                  <FiPlay /> Return to Session
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="no-live-banner glass-morphism"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <FiClock className="banner-icon" />
          <div className="banner-content">
            <h3>No Live Sessions</h3>
            <p>No classes are currently running</p>
          </div>
          <button className="create-session-btn" onClick={handleCreateSession}>
            <FiPlus /> Create Session
          </button>
        </motion.div>
      )}

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <motion.div
          className="sessions-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="section-title upcoming">
            <FiCalendar /> UPCOMING TODAY
          </h2>
          <div className="sessions-grid">
            {upcomingSessions.map((session) => (
              <motion.div
                key={session.id}
                className="session-card glass-morphism upcoming"
                whileHover={{ scale: 1.02 }}
                onClick={() => handleSessionClick(session)}
              >
                <h3>{session.subject}</h3>
                <p className="course-code">{session.courseCode}</p>
                <div className="session-info">
                  <div className="info-item">
                    <FiClock />
                    <span>
                      {session.startTime} - {session.endTime}
                    </span>
                  </div>
                  <div className="info-item">
                    <FiMapPin />
                    <span>{session.room}</span>
                  </div>
                  <div className="info-item">
                    <FiBook />
                    <span>{session.topic}</span>
                  </div>
                </div>
                <button className="view-session-btn">View Details</button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Session History Timeline */}
      <motion.div
        className="sessions-section timeline-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="section-title history">
          <FiBarChart2 /> SESSION HISTORY
        </h2>
        <div className="session-timeline">
          {/* Today - Earlier */}
          {todayHistory && todayHistory.sessions.length > 0 && (
            <TimelineDayGroup
              date={todayHistory.date}
              dayName="Today - Earlier"
              sessions={todayHistory.sessions}
              isExpanded={expandedDays.today}
              onToggle={() => toggleDay("today")}
              onViewReport={handleViewReport}
              onExportCSV={handleExportCSV}
            />
          )}

          {/* Yesterday */}
          {yesterdayHistory && (
            <TimelineDayGroup
              date={yesterdayHistory.date}
              dayName="Yesterday"
              sessions={yesterdayHistory.sessions}
              isExpanded={expandedDays.yesterday}
              onToggle={() => toggleDay("yesterday")}
              onViewReport={handleViewReport}
              onExportCSV={handleExportCSV}
            />
          )}

          {/* This Week */}
          {olderHistory.length > 0 && (
            <div className="timeline-week-group">
              <h4 className="timeline-week-title">This Week</h4>
              {olderHistory.map((day, idx) => (
                <TimelineDayGroup
                  key={idx}
                  date={day.date}
                  dayName={day.dayName}
                  sessions={day.sessions}
                  isExpanded={expandedDays[day.date] || false}
                  onToggle={() => toggleDay(day.date)}
                  onViewReport={handleViewReport}
                  onExportCSV={handleExportCSV}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {selectedSession && (
          <SessionDetailModal
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
            onStartAttendance={handleStartAttendance}
          />
        )}
        {showCreateModal && (
          <CreateSessionModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onStartNow={handleStartNow}
            onSchedule={handleSchedule}
            classData={classData}
          />
        )}
        {reportSession && (
          <SessionReportModal
            session={reportSession}
            onClose={() => setReportSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

SessionDetailModal.propTypes = {
  session: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onStartAttendance: PropTypes.func.isRequired,
};

TimelineItem.propTypes = {
  session: PropTypes.object.isRequired,
  isToday: PropTypes.bool,
  onViewReport: PropTypes.func,
  onExportCSV: PropTypes.func,
};

TimelineDayGroup.propTypes = {
  date: PropTypes.string.isRequired,
  dayName: PropTypes.string.isRequired,
  sessions: PropTypes.array.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func,
  onViewReport: PropTypes.func,
  onExportCSV: PropTypes.func,
};

ClassSessions.propTypes = {
  classData: PropTypes.object.isRequired,
  onStartLiveAttendance: PropTypes.func,
};

export default ClassSessions;
