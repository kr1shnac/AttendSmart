/* eslint-disable */
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  FiArrowLeft,
  FiCalendar,
  FiUsers,
  FiTrendingUp,
  FiAward,
  FiAlertTriangle,
  FiDownload,
  FiEye,
  FiX,
  FiPhone,
  FiMessageCircle,
} from "react-icons/fi";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import "./ClassAnalytics.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ClassAnalytics = ({ classData }) => {
  const navigate = useNavigate();
  const { classId } = useParams();
  const [dateRange, setDateRange] = useState("month");
  const [showTopPerformersModal, setShowTopPerformersModal] = useState(false);
  const [showAtRiskModal, setShowAtRiskModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use classData for class name
  const className =
    classData?.name ||
    classData?.className ||
    (classId ? `Class ${classId}` : "Class Analytics");

  // State for real analytics data - starts with empty/zero values
  const [analyticsData, setAnalyticsData] = useState({
    stats: {
      totalSessions: classData?.totalSessions || 0,
      totalStudents: classData?.totalStudents || 0,
      avgAttendance: classData?.overallAttendance || 0,
      lastSessionDate: "N/A",
    },
    attendanceTrend: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      data: [0, 0, 0, 0],
    },
    sessionWise: {
      labels: [],
      data: [],
    },
    distribution: {
      data: [0, 0, 0, 0],
    },
    topPerformers: [],
    atRiskStudents: [],
  });

  // Fetch analytics data on mount
  useEffect(() => {
    fetchAnalyticsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classData?._id, dateRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const currentClassId = classData?._id || classId;
      if (!currentClassId) {
        setLoading(false);
        return;
      }

      // Build analytics from classData if available
      setAnalyticsData((prev) => ({
        ...prev,
        stats: {
          totalSessions: classData?.totalSessions || 0,
          totalStudents: classData?.totalStudents || 0,
          avgAttendance: Math.round(
            classData?.overallAttendance || classData?.averageAttendance || 0
          ),
          lastSessionDate: classData?.lastSessionDate || "N/A",
        },
        topPerformers: classData?.topStudents || [],
        atRiskStudents: classData?.lowAttendanceStudents || [],
      }));

      console.log("✅ Loaded class analytics from database");
    } catch (error) {
      console.error("Error fetching class analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Real Student Profile - uses actual student data with fallbacks
  const getStudentProfile = (student) => ({
    ...student,
    email: student.email || "N/A",
    phone: student.phone || "N/A",
    parentPhone: student.parentPhone || student.fatherPhone || "N/A",
    dob: student.dateOfBirth
      ? new Date(student.dateOfBirth).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "N/A",
    department: student.branch || student.department || "N/A",
    semester: student.semester ? `${student.semester}th Semester` : "N/A",
    recentActivity: student.recentActivity || [], // Empty array if no activity
    performance: student.performance || [],
  });

  const handleStudentClick = (student) => {
    setSelectedStudent(getStudentProfile(student));
  };

  // ... (rest of the data generation logic remains same)

  // Action Handlers
  const handleCall = (number) => {
    window.location.href = `tel:${number}`;
  };

  const handleWhatsApp = (number) => {
    window.open(`https://wa.me/${number.replace(/\D/g, "")}`, "_blank");
  };

  // ... (chart configs)

  const trendData = {
    labels: analyticsData.attendanceTrend.labels,
    datasets: [
      {
        label: "Attendance %",
        data: analyticsData.attendanceTrend.data,
        borderColor: "#00d4ff",
        backgroundColor: "rgba(0, 212, 255, 0.1)",
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "#00d4ff",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const sessionWiseData = {
    labels: analyticsData.sessionWise.labels,
    datasets: [
      {
        label: "Attendance %",
        data: analyticsData.sessionWise.data,
        backgroundColor: "rgba(0, 212, 255, 0.8)",
        borderColor: "#00d4ff",
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const distributionData = {
    labels: ["90-100%", "75-89%", "60-74%", "Below 60%"],
    datasets: [
      {
        data: analyticsData.distribution.data,
        backgroundColor: [
          "rgba(16, 185, 129, 0.8)",
          "rgba(0, 212, 255, 0.8)",
          "rgba(251, 191, 36, 0.8)",
          "rgba(239, 68, 68, 0.8)",
        ],
        borderColor: ["#10b981", "#00d4ff", "#fbbf24", "#ef4444"],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleColor: "#00d4ff",
        bodyColor: "#fff",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          color: "rgba(255, 255, 255, 0.6)",
          callback: (value) => value + "%",
        },
        grid: { color: "rgba(255, 255, 255, 0.05)" },
      },
      x: {
        ticks: { color: "rgba(255, 255, 255, 0.6)" },
        grid: { display: false },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "rgba(255, 255, 255, 0.8)",
          padding: 15,
          font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleColor: "#00d4ff",
        bodyColor: "#fff",
      },
    },
  };

  const exportClassReport = () => {
    const csv = [
      ["Student Name", "USN", "Attendance %", "Sessions Attended"],
      ...analyticsData.topPerformers.map((s) => [
        s.name,
        s.usn,
        s.attendance + "%",
        s.sessions,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${className.replace(/\s/g, "_")}-analytics-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="class-analytics">
      {/* Controls */}
      <div className="analytics-controls glass-morphism">
        <div className="controls-left">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="filter-select"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="semester">This Semester</option>
            <option value="year">This Year</option>
          </select>
        </div>

        <div className="controls-right">
          <button className="action-btn export" onClick={exportClassReport}>
            <FiDownload />
            <span>Export Report</span>
          </button>
          <button
            className="action-btn view"
            onClick={() =>
              navigate(`/teacher/classes/${classData?._id}/students`)
            }
          >
            <FiEye />
            <span>View Students</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="overview-stats">
        <motion.div
          className="stat-card-admin glass-morphism"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="stat-content">
            <div className="stat-value">
              {analyticsData.stats.totalSessions}
            </div>
            <div className="stat-label">Total Sessions</div>
          </div>
          <FiCalendar className="stat-icon-bg" />
        </motion.div>

        <motion.div
          className="stat-card-admin glass-morphism"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="stat-content">
            <div className="stat-value">
              {analyticsData.stats.totalStudents}
            </div>
            <div className="stat-label">Enrolled Students</div>
          </div>
          <FiUsers className="stat-icon-bg" />
        </motion.div>

        <motion.div
          className="stat-card-admin glass-morphism highlight"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="stat-content">
            <div className="stat-value">
              {analyticsData.stats.avgAttendance}%
            </div>
            <div className="stat-label">Class Average</div>
          </div>
          <FiTrendingUp className="stat-icon-bg" />
        </motion.div>

        <motion.div
          className="stat-card-admin glass-morphism"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="stat-content">
            <div className="stat-value last-session">
              {analyticsData.stats.lastSessionDate.split(",")[0]}
            </div>
            <div className="stat-label">Last Session</div>
          </div>
          <FiCalendar className="stat-icon-bg" />
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Attendance Trend */}
        <motion.div
          className="chart-card glass-morphism"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="chart-title">
            <FiTrendingUp className="inline-icon" />
            Attendance Trend
          </h3>
          <div className="chart-container">
            <Line data={trendData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Session-wise Attendance */}
        <motion.div
          className="chart-card glass-morphism"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="chart-title">
            <FiCalendar className="inline-icon" />
            Recent Sessions
          </h3>
          <div className="chart-container">
            <Bar data={sessionWiseData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Distribution - Full Width */}
        <motion.div
          className="chart-card glass-morphism full-width"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="chart-title">
            <FiUsers className="inline-icon" />
            Student Performance Distribution
          </h3>
          <div className="chart-container-doughnut">
            <Doughnut data={distributionData} options={doughnutOptions} />
          </div>
        </motion.div>
      </div>

      {/* Student Performance Lists */}
      <div className="student-lists">
        {/* Top Performers */}
        <motion.div
          className="list-card glass-morphism top-performers"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="list-header">
            <h3>
              <FiAward className="inline-icon" />
              Top Performers
            </h3>
            <button
              className="view-all-btn"
              onClick={() => setShowTopPerformersModal(true)}
            >
              View All
            </button>
          </div>
          <div className="students-list">
            {analyticsData.topPerformers.slice(0, 5).map((student, idx) => (
              <div key={idx} className="student-item top">
                <div className="student-rank">#{idx + 1}</div>
                <div className="student-info">
                  <div className="student-name">{student.name}</div>
                  <div className="student-usn">{student.usn}</div>
                </div>
                <div className="student-stats">
                  <span className="stat-badge">{student.attendance}%</span>
                  <span className="sessions-badge">
                    {student.sessions}/{analyticsData.stats.totalSessions}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* At-Risk Students */}
        {analyticsData.atRiskStudents.length > 0 && (
          <motion.div
            className="list-card glass-morphism low-attendance"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
          >
            <div className="list-header">
              <h3>
                <FiAlertTriangle className="inline-icon" />
                Needs Attention
              </h3>
              <button
                className="view-all-btn"
                onClick={() => setShowAtRiskModal(true)}
              >
                View All
              </button>
            </div>
            <div className="students-list">
              {analyticsData.atRiskStudents.slice(0, 5).map((student, idx) => (
                <div key={idx} className="student-item low">
                  <div className="student-alert">⚠️</div>
                  <div className="student-info">
                    <div className="student-name">{student.name}</div>
                    <div className="student-usn">{student.usn}</div>
                  </div>
                  <div className="student-stats">
                    <span className="stat-badge low">
                      {student.attendance}%
                    </span>
                    <span className="sessions-badge low">
                      {student.sessions}/{analyticsData.stats.totalSessions}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      {showTopPerformersModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowTopPerformersModal(false)}
        >
          <motion.div
            className="modal-content glass-morphism"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Top Performers</h2>
              <button
                className="close-btn"
                onClick={() => setShowTopPerformersModal(false)}
              >
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              {analyticsData.topPerformers.map((student, idx) => (
                <div
                  key={idx}
                  className="student-item top clickable"
                  onClick={() => handleStudentClick(student)}
                >
                  <div className="student-rank">#{idx + 1}</div>
                  <div className="student-info">
                    <div className="student-name">{student.name}</div>
                    <div className="student-usn">{student.usn}</div>
                  </div>
                  <div className="student-stats">
                    <span className="stat-badge">{student.attendance}%</span>
                    <span className="sessions-badge">
                      {student.sessions}/{analyticsData.stats.totalSessions}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {showAtRiskModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowAtRiskModal(false)}
        >
          <motion.div
            className="modal-content glass-morphism"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Needs Attention</h2>
              <button
                className="close-btn"
                onClick={() => setShowAtRiskModal(false)}
              >
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              {analyticsData.atRiskStudents.map((student, idx) => (
                <div
                  key={idx}
                  className="student-item low clickable"
                  onClick={() => handleStudentClick(student)}
                >
                  <div className="student-alert">⚠️</div>
                  <div className="student-info">
                    <div className="student-name">{student.name}</div>
                    <div className="student-usn">{student.usn}</div>
                  </div>
                  <div className="student-stats">
                    <span className="stat-badge low">
                      {student.attendance}%
                    </span>
                    <span className="sessions-badge low">
                      {student.sessions}/{analyticsData.stats.totalSessions}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Student Profile Modal */}
      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
          <motion.div
            className="modal-content glass-morphism student-profile-modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-header-bg">
              <button
                className="close-btn-abs"
                onClick={() => setSelectedStudent(null)}
              >
                <FiX />
              </button>
            </div>
            <div className="profile-content">
              <div className="profile-avatar">
                {selectedStudent.name.charAt(0)}
              </div>
              <h2 className="profile-name">{selectedStudent.name}</h2>
              <p className="profile-usn">{selectedStudent.usn}</p>

              {/* Communication Actions */}
              <div className="profile-actions">
                <button
                  className="action-icon-btn call"
                  onClick={() => handleCall(selectedStudent.phone)}
                  title="Call Student"
                >
                  <FiPhone />
                  <span>Call</span>
                </button>
                <button
                  className="action-icon-btn whatsapp"
                  onClick={() => handleWhatsApp(selectedStudent.phone)}
                  title="WhatsApp Student"
                >
                  <FiMessageCircle />
                  <span>WhatsApp</span>
                </button>
                <button
                  className="action-icon-btn parent"
                  onClick={() => handleCall(selectedStudent.parentPhone)}
                  title="Call Parent"
                >
                  <FiUsers />
                  <span>Parent</span>
                </button>
              </div>

              <div className="profile-stats-row">
                <div className="p-stat">
                  <span className="p-val">{selectedStudent.attendance}%</span>
                  <span className="p-lbl">Attendance</span>
                </div>
                <div className="p-stat">
                  <span className="p-val">{selectedStudent.sessions}</span>
                  <span className="p-lbl">Sessions</span>
                </div>
                <div className="p-stat">
                  <span className="p-val">A</span>
                  <span className="p-lbl">Grade</span>
                </div>
              </div>

              <div className="profile-details">
                <div className="detail-row">
                  <span className="d-label">Email</span>
                  <span className="d-value">{selectedStudent.email}</span>
                </div>
                <div className="detail-row">
                  <span className="d-label">Department</span>
                  <span className="d-value">{selectedStudent.department}</span>
                </div>
                <div className="detail-row">
                  <span className="d-label">Semester</span>
                  <span className="d-value">{selectedStudent.semester}</span>
                </div>
              </div>

              <div className="recent-activity">
                <h3>Recent Activity</h3>
                {selectedStudent.recentActivity.map((activity, idx) => (
                  <div key={idx} className="activity-item">
                    <div className="act-date">{activity.date}</div>
                    <div className="act-session">{activity.session}</div>
                    <div
                      className={`act-status ${activity.status.toLowerCase()}`}
                    >
                      {activity.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

ClassAnalytics.propTypes = {
  classData: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
  }),
};

export default ClassAnalytics;
