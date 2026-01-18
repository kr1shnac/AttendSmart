/* eslint-disable */
import React, { useState } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import "./ClassCalendar.css";

const ClassCalendar = ({ classData }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [extraSessions, setExtraSessions] = useState([]);

  // Indian Holidays (VTU Calendar 2024-2025)
  const indianHolidays = {
    "2024-10-02": "Gandhi Jayanti",
    "2024-10-24": "Dussehra",
    "2024-11-01": "Diwali",
    "2024-11-12": "Guru Nanak Jayanti",
    "2024-12-25": "Christmas",
    "2025-01-01": "New Year",
    "2025-01-14": "Sankranti",
    "2025-01-26": "Republic Day",
    "2025-03-14": "Holi",
    "2025-04-10": "Ugadi",
    "2025-04-18": "Good Friday",
    "2025-08-15": "Independence Day",
    "2025-08-27": "Ganesh Chaturthi",
    "2025-10-02": "Gandhi Jayanti",
  };

  // VTU Off Days
  const vtuOffDays = {
    "2024-12-15": "Mid-term Exams",
    "2024-12-20": "Mid-term Exams",
    "2025-04-25": "Semester Exams",
    "2025-05-10": "Semester Exams",
  };

  // Get schedule from classData (dynamic)
  const classSchedule = classData?.schedule || [];

  // Generate color palette for each scheduled day
  const getColorForDay = (dayIndex) => {
    const colors = [
      {
        bg: "rgba(0, 212, 255, 0.15)",
        border: "rgba(0, 212, 255, 0.5)",
        accent: "#00d4ff",
      },
      {
        bg: "rgba(139, 92, 246, 0.15)",
        border: "rgba(139, 92, 246, 0.5)",
        accent: "#8b5cf6",
      },
      {
        bg: "rgba(16, 185, 129, 0.15)",
        border: "rgba(16, 185, 129, 0.5)",
        accent: "#10b981",
      },
      {
        bg: "rgba(251, 191, 36, 0.15)",
        border: "rgba(251, 191, 36, 0.5)",
        accent: "#fbbf24",
      },
      {
        bg: "rgba(236, 72, 153, 0.15)",
        border: "rgba(236, 72, 153, 0.5)",
        accent: "#ec4899",
      },
    ];
    return colors[dayIndex % colors.length];
  };

  // Calendar calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const formatDate = (day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;

  // Check if date is scheduled class
  const isScheduledClass = (day) => {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    return classSchedule.find((s) => s.day === dayOfWeek);
  };

  // Check if date has extra session
  const getExtraSession = (day) => {
    const dateStr = formatDate(day);
    return extraSessions.find((s) => s.date === dateStr);
  };

  // Check if holiday
  const isHoliday = (day) => {
    const dateStr = formatDate(day);
    return indianHolidays[dateStr] || vtuOffDays[dateStr] || null;
  };

  // Check if today
  const isToday = (day) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  // Check if Sunday
  const isSunday = (day) => {
    const date = new Date(year, month, day);
    return date.getDay() === 0;
  };

  // Handle day click
  const handleDayClick = (day) => {
    const holiday = isHoliday(day);
    const sunday = isSunday(day);

    if (holiday || sunday) return; // Can't interact with holidays/Sundays

    const scheduledClass = isScheduledClass(day);
    const extraSession = getExtraSession(day);

    if (scheduledClass || extraSession) {
      // Show session details
      setSelectedDate({ day, scheduledClass, extraSession });
      setShowSessionModal(true);
    } else {
      // Show add session modal
      setSelectedDate({ day });
      setShowAddModal(true);
    }
  };

  // Add extra session
  const handleAddSession = (topic, time) => {
    const dateStr = formatDate(selectedDate.day);
    setExtraSessions([
      ...extraSessions,
      { date: dateStr, topic, time, day: selectedDate.day },
    ]);
    setShowAddModal(false);
    setSelectedDate(null);
  };

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1));
  };

  // Render day cell
  const renderDay = (day) => {
    const scheduledClass = isScheduledClass(day);
    const extraSession = getExtraSession(day);
    const holiday = isHoliday(day);
    const today = isToday(day);
    const sunday = isSunday(day);

    const dayOfWeek = new Date(year, month, day).getDay();
    const scheduleIndex = classSchedule.findIndex((s) => s.day === dayOfWeek);
    const colors = scheduleIndex >= 0 ? getColorForDay(scheduleIndex) : null;

    let className = "cc-day";
    let style = {};

    if (holiday) {
      className += " tile-holiday";
    } else if (sunday) {
      className += " tile-sunday";
    } else if (extraSession) {
      className += " tile-extra";
      style = {
        background:
          "linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(168, 85, 247, 0.15))",
        borderColor: "rgba(147, 51, 234, 0.5)",
      };
    } else if (scheduledClass && colors) {
      className += " tile-scheduled";
      style = {
        background: colors.bg,
        borderColor: colors.border,
      };
    }

    if (today) className += " tile-today";

    return (
      <motion.div
        key={day}
        className={className}
        style={style}
        onClick={() => handleDayClick(day)}
        whileHover={!holiday && !sunday ? { scale: 1.05 } : {}}
      >
        <span className="day-number">{day}</span>
        {holiday && <span className="day-label holiday-label">{holiday}</span>}
        {extraSession && !holiday && (
          <span className="day-label extra-label">➕</span>
        )}
        {scheduledClass && !holiday && !sunday && !extraSession && (
          <span className="day-label">📘</span>
        )}
      </motion.div>
    );
  };

  return (
    <div className="cc-calendar-container">
      <div className="cc-calendar glass-morphism">
        {/* Header */}
        <div className="cc-header">
          <button className="cc-nav-btn" onClick={handlePrevMonth}>
            ◀
          </button>
          <h2 className="cc-month-title">
            {currentMonth.toLocaleString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button className="cc-nav-btn" onClick={handleNextMonth}>
            ▶
          </button>
        </div>

        {/* Weekdays */}
        <div className="cc-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
            const scheduleForDay = classSchedule.find((s) => s.day === idx);
            const scheduleIndex = classSchedule.findIndex((s) => s.day === idx);
            const colors =
              scheduleIndex >= 0 ? getColorForDay(scheduleIndex) : null;

            return (
              <div
                key={idx}
                className={`cc-weekday ${
                  scheduleForDay ? "cc-weekday-scheduled" : ""
                }`}
                style={
                  scheduleForDay && colors
                    ? {
                        background: colors.bg,
                        borderColor: colors.border,
                        color: colors.accent,
                      }
                    : {}
                }
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Calendar Grid */}
        <div className="cc-grid">
          {[...Array(firstDay)].map((_, i) => (
            <div key={`empty-${i}`} className="cc-day empty"></div>
          ))}
          {[...Array(daysInMonth)].map((_, i) => renderDay(i + 1))}
        </div>

        {/* Legend */}
        <div className="cc-legend glass-morphism">
          {classSchedule.map((schedule, idx) => {
            const colors = getColorForDay(idx);
            const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
              schedule.day
            ];
            return (
              <div key={idx} className="legend-item">
                <span
                  className="legend-box"
                  style={{ background: colors.accent }}
                ></span>
                <span>
                  {dayName} ({schedule.time})
                </span>
              </div>
            );
          })}
          <div className="legend-item">
            <span
              className="legend-box"
              style={{ background: "#a855f7" }}
            ></span>
            <span>Extra Session</span>
          </div>
          <div className="legend-item">
            <span
              className="legend-box"
              style={{ background: "#ef4444" }}
            ></span>
            <span>Holiday</span>
          </div>
        </div>
      </div>

      {/* Session Details Modal */}
      <AnimatePresence>
        {showSessionModal && selectedDate && (
          <motion.div
            className="cc-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSessionModal(false)}
          >
            <motion.div
              className="cc-modal glass-morphism"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>📅 Session Details</h3>
              <div className="modal-date">
                {new Date(year, month, selectedDate.day).toLocaleDateString(
                  "en-IN",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
              </div>

              {selectedDate.scheduledClass && (
                <div className="session-info">
                  <h4>Regular Class</h4>
                  <p>
                    <strong>Time:</strong> {selectedDate.scheduledClass.time}
                  </p>
                  <p>
                    <strong>Type:</strong> Scheduled Class Session
                  </p>
                </div>
              )}

              {selectedDate.extraSession && (
                <div className="session-info extra">
                  <h4>Extra Session</h4>
                  <p>
                    <strong>Topic:</strong> {selectedDate.extraSession.topic}
                  </p>
                  <p>
                    <strong>Time:</strong> {selectedDate.extraSession.time}
                  </p>
                </div>
              )}

              <button
                className="modal-btn"
                onClick={() => setShowSessionModal(false)}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Session Modal */}
      <AnimatePresence>
        {showAddModal && selectedDate && (
          <motion.div
            className="cc-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              className="cc-modal glass-morphism"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>➕ Add Extra Session</h3>
              <div className="modal-date">
                {new Date(year, month, selectedDate.day).toLocaleDateString(
                  "en-IN",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
              </div>

              <div className="form-group">
                <label>Topic</label>
                <input
                  type="text"
                  id="extraTopic"
                  className="cc-input"
                  placeholder="Session topic..."
                />
              </div>

              <div className="form-group">
                <label>Time</label>
                <input type="time" id="extraTime" className="cc-input" />
              </div>

              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn confirm"
                  onClick={() =>
                    handleAddSession(
                      document.getElementById("extraTopic").value,
                      document.getElementById("extraTime").value
                    )
                  }
                >
                  Add Session
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

ClassCalendar.propTypes = {
  classData: PropTypes.shape({
    schedule: PropTypes.array,
  }),
};

export default ClassCalendar;
