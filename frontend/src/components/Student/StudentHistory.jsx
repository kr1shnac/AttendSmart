import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiXCircle,
  FiMapPin,
  FiUser,
  FiSearch,
  FiActivity,
  FiClock,
  FiBook,
} from "react-icons/fi";
import toast from "../../services/toastService";
import "./StudentHistory.css";

const StudentHistory = () => {
  const navigate = useNavigate();
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [loading, setLoading] = useState(true);

  // ✅ Real Data State - No Fake Data
  const [historyData, setHistoryData] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);

  const fetchAttendanceData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      // Construct params
      const queryParams = new URLSearchParams();
      if (filterSubject !== "all") queryParams.append("subject", filterSubject);
      if (filterMonth !== "all") queryParams.append("month", filterMonth);

      const response = await fetch(
        `${
          process.env.REACT_APP_API_URL
        }/api/attendance/history?${queryParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const result = await response.json();

      if (result.status === "success" || result.success) {
        // ✅ Map API response to UI structure if needed
        // Assuming API returns { history: [...], summary: [...] }
        setHistoryData(result.data.history || []);
        setSummaryData(result.data.summary || []);

        // Populate dropdown once
        if (filterSubject === "all" && result.data.summary) {
          const subjects = result.data.summary.map((s) => ({
            code: s.code,
            name: s.subject,
          }));
          setSubjectsList(subjects);
        }
      } else {
        toast.error("Failed to retrieve history");
      }
    } catch (error) {
      console.error("History fetch error:", error);
      toast.error("Connection failed");
    } finally {
      setLoading(false);
    }
  }, [filterSubject, filterMonth]);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  const getStatusIcon = (status) => {
    return status === "present" ? <FiCheckCircle /> : <FiXCircle />;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading records...</p>
      </div>
    );
  }

  return (
    <div className="student-history">
      {/* HEADER */}
      <motion.div
        className="history-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button className="back-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft /> <span>Back</span>
        </button>
        <div className="header-content">
          <h1>
            <FiBook /> Attendance History
          </h1>
        </div>
      </motion.div>

      {/* SUBJECT SUMMARY */}
      <div className="summary-section">
        <h2 className="section-title">
          <FiActivity /> Subject Performance
        </h2>

        {summaryData.length > 0 ? (
          <div className="summary-grid">
            {summaryData.map((item, index) => (
              <motion.div
                key={index}
                className="summary-card glass-morphism"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="card-left">
                  <h3 className="subject-name">{item.subject}</h3>
                  <span className="course-code">{item.code}</span>
                  <div className="stats-row">
                    <div className="stat-item">
                      <span className="label">Attended</span>
                      <span className="value green">{item.present}</span>
                    </div>
                    <div className="stat-item">
                      <span className="label">Total</span>
                      <span className="value">{item.total}</span>
                    </div>
                    <div className="stat-item">
                      <span className="label">Missed</span>
                      <span className="value red">
                        {item.total - item.present}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="card-right">
                  <div className="progress-circle">
                    <svg viewBox="0 0 36 36">
                      <path
                        className="circle-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="circle-progress"
                        strokeDasharray={`${item.percentage}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        style={{
                          stroke:
                            item.percentage >= 85
                              ? "#10b981"
                              : item.percentage >= 75
                              ? "#00d4ff"
                              : "#f59e0b",
                        }}
                      />
                    </svg>
                    <div className="percentage">{item.percentage}%</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="no-data glass-morphism">
            <p>No summary data available</p>
          </div>
        )}
      </div>

      {/* TIMELINE SECTION */}
      <div className="timeline-section">
        <h2 className="section-title">Attendance Timeline</h2>

        {/* FILTERS */}
        <div className="timeline-filters">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Subjects</option>
            {subjectsList.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Time</option>
            <option value="current">This Month</option>
            <option value="last">Last Month</option>
          </select>

          <div className="results-badge">{historyData.length} Records</div>
        </div>

        {/* TIMELINE RECORDS */}
        {historyData.length > 0 ? (
          <div className="timeline-wrapper">
            {historyData.map((record, index) => (
              <motion.div
                key={record._id || index}
                className={`timeline-row ${record.status}`}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <div className="timeline-date">
                  <span className="date-day">
                    {new Date(record.date).toLocaleDateString("en-US", {
                      day: "numeric",
                    })}
                  </span>
                  <span className="date-month">
                    {new Date(record.date).toLocaleDateString("en-US", {
                      month: "short",
                    })}
                  </span>
                </div>

                <div className="timeline-dot-wrapper">
                  <div className="timeline-dot">
                    {getStatusIcon(record.status)}
                  </div>
                </div>

                <div className="timeline-card glass-morphism">
                  <div className="card-header">
                    <div>
                      <h3>{record.subject}</h3>
                      <span className="record-time">
                        {new Date(record.date).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <span className={`status-badge ${record.status}`}>
                      {record.status === "present" ? "Present" : "Absent"}
                    </span>
                  </div>

                  <div className="card-details">
                    <div className="detail">
                      <FiMapPin /> <span>{record.room || "N/A"}</span>
                    </div>
                    <div className="detail">
                      <FiUser /> <span>{record.teacher || "Staff"}</span>
                    </div>
                    {record.checkInTime && (
                      <div className="detail highlight">
                        <FiClock />{" "}
                        <span>Checked in: {record.checkInTime}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="no-data glass-morphism">
            <FiSearch className="no-data-icon" />
            <h3>No Records Found</h3>
            <p>Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentHistory;
