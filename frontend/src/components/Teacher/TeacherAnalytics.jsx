import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  FiArrowLeft,
  FiCalendar,
  FiUsers,
  FiTrendingUp,
  FiBook,
  FiDownload,
  FiAward,
  FiAlertTriangle,
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
import { dashboardAPI, classesAPI } from "../../services/api";
import "./TeacherAnalytics.css";

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

const TeacherAnalytics = () => {
  const navigate = useNavigate();
  const [selectedClass, setSelectedClass] = useState("all");
  const [dateRange, setDateRange] = useState("month");
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState({
    overview: {
      totalSessions: 0,
      totalStudents: 0,
      avgAttendance: 0,
      totalClasses: 0,
    },
    weeklyTrend: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      data: [0, 0, 0, 0, 0, 0],
    },
    monthlyComparison: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      data: [0, 0, 0, 0],
    },
    attendanceDistribution: {
      labels: ["90-100%", "75-89%", "60-74%", "Below 60%"],
      data: [0, 0, 0, 0],
    },
    classWise: [],
    topPerformers: [],
    lowAttendance: [],
  });

  useEffect(() => {
    fetchAnalyticsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, dateRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Fetch dashboard analytics
      const [dashboardRes, classesRes] = await Promise.all([
        dashboardAPI.getTeacherDashboard({ dateRange }),
        classesAPI.getMyClasses(),
      ]);

      // Extract classes data
      let classesData = [];
      if (classesRes.data?.classes) {
        classesData = classesRes.data.classes;
      } else if (classesRes.classes) {
        classesData = classesRes.classes;
      } else if (Array.isArray(classesRes.data)) {
        classesData = classesRes.data;
      }

      // Build analytics from real data
      const overview = dashboardRes.data?.overview ||
        dashboardRes.overview || {
          totalSessions: classesData.reduce(
            (acc, c) => acc + (c.totalSessions || 0),
            0
          ),
          totalStudents: classesData.reduce(
            (acc, c) => acc + (c.totalStudents || 0),
            0
          ),
          avgAttendance:
            classesData.length > 0
              ? Math.round(
                  classesData.reduce(
                    (acc, c) =>
                      acc + (c.overallAttendance || c.averageAttendance || 0),
                    0
                  ) / classesData.length
                )
              : 0,
          totalClasses: classesData.length,
        };

      // Build class-wise data from real classes
      const classWise = classesData.map((cls) => ({
        class: `${cls.courseCode || ""} - ${
          cls.subject || cls.className || "Unknown"
        }`,
        sessions: cls.totalSessions || 0,
        students: cls.totalStudents || 0,
        attendance: cls.overallAttendance || cls.averageAttendance || 0,
        _id: cls._id,
      }));

      setAnalyticsData({
        overview,
        weeklyTrend:
          dashboardRes.data?.weeklyTrend || analyticsData.weeklyTrend,
        monthlyComparison:
          dashboardRes.data?.monthlyComparison ||
          analyticsData.monthlyComparison,
        attendanceDistribution:
          dashboardRes.data?.attendanceDistribution ||
          analyticsData.attendanceDistribution,
        classWise,
        topPerformers: dashboardRes.data?.topPerformers || [],
        lowAttendance: dashboardRes.data?.lowAttendance || [],
      });

      console.log("✅ Loaded analytics from database");
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Chart configurations
  const trendData = {
    labels: analyticsData.weeklyTrend.labels,
    datasets: [
      {
        label: "Attendance %",
        data: analyticsData.weeklyTrend.data,
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

  const comparisonData = {
    labels: analyticsData.monthlyComparison.labels,
    datasets: [
      {
        label: "Attendance %",
        data: analyticsData.monthlyComparison.data,
        backgroundColor: "rgba(0, 212, 255, 0.8)",
        borderColor: "#00d4ff",
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const distributionData = {
    labels: analyticsData.attendanceDistribution.labels,
    datasets: [
      {
        data: analyticsData.attendanceDistribution.data,
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

  const exportToCSV = () => {
    const csv = [
      ["Class", "Sessions", "Students", "Avg Attendance"],
      ...analyticsData.classWise.map((c) => [
        c.class,
        c.sessions,
        c.students,
        c.attendance + "%",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${Date.now()}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="teacher-analytics">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-analytics">
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
        className="analytics-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="header-content">
          <div className="header-text">
            <h1 className="section-heading">Analytics & Insights</h1>
            <p className="subtitle">Track performance and attendance metrics</p>
          </div>
        </div>
      </motion.div>
      {/* Filters & Export */}
      <div className="analytics-controls glass-morphism">
        <div className="controls-left">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Classes</option>
            <option value="cs301">CS301 - Data Structures</option>
            <option value="cs302">CS302 - DBMS</option>
            <option value="cs303">CS303 - Operating Systems</option>
            <option value="cs304">CS304 - Computer Architecture</option>
            <option value="cs305">CS305 - Web Technology</option>
            <option value="cs306">CS306 - AI/ML</option>
            <option value="cs307">CS307 - Computer Networks</option>
            <option value="cs308">CS308 - Software Engineering</option>
          </select>

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

        <button className="export-btn" onClick={exportToCSV}>
          <FiDownload />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Overview Stats */}
      <div className="overview-stats">
        <motion.div
          className="stat-card-admin glass-morphism"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="stat-content">
            <div className="stat-value">
              {analyticsData.overview.totalSessions}
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
              {analyticsData.overview.totalStudents}
            </div>
            <div className="stat-label">Total Students</div>
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
              {analyticsData.overview.avgAttendance}%
            </div>
            <div className="stat-label">Avg Attendance</div>
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
            <div className="stat-value">
              {analyticsData.overview.totalClasses}
            </div>
            <div className="stat-label">Active Classes</div>
          </div>
          <FiBook className="stat-icon-bg" />
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
            Weekly Attendance Trend
          </h3>
          <div className="chart-container">
            <Line data={trendData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Monthly Comparison */}
        <motion.div
          className="chart-card glass-morphism"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="chart-title">
            <FiTrendingUp className="inline-icon" />
            Monthly Comparison
          </h3>
          <div className="chart-container">
            <Bar data={comparisonData} options={chartOptions} />
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
            Student Attendance Distribution
          </h3>
          <div className="chart-container-doughnut">
            <Doughnut data={distributionData} options={doughnutOptions} />
          </div>
        </motion.div>
      </div>

      {/* Class-wise Performance Table */}
      <motion.div
        className="class-performance glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h3 className="section-title">
          <FiBook className="inline-icon" />
          Class-wise Performance
        </h3>
        <div className="performance-table-wrapper">
          <table className="performance-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Sessions</th>
                <th>Students</th>
                <th>Attendance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.classWise.map((classData, idx) => (
                <tr
                  key={idx}
                  onClick={() =>
                    navigate(
                      `/teacher/analytics/class/${
                        classData.class.split(" ")[0]
                      }`
                    )
                  }
                  style={{ cursor: "pointer" }}
                >
                  <td className="class-name">{classData.class}</td>
                  <td>{classData.sessions}</td>
                  <td>{classData.students}</td>
                  <td>
                    <div className="attendance-cell">
                      <div className="attendance-bar-mini">
                        <div
                          className="attendance-fill"
                          style={{
                            width: `${classData.attendance}%`,
                            background:
                              classData.attendance >= 85
                                ? "#10b981"
                                : classData.attendance >= 75
                                ? "#00d4ff"
                                : "#fbbf24",
                          }}
                        />
                      </div>
                      <span className="attendance-value">
                        {classData.attendance}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        classData.attendance >= 85
                          ? "excellent"
                          : classData.attendance >= 75
                          ? "good"
                          : "average"
                      }`}
                    >
                      {classData.attendance >= 85
                        ? "Excellent"
                        : classData.attendance >= 75
                        ? "Good"
                        : "Average"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Student Lists - Two Columns */}
      <div className="student-lists">
        {/* Top Performers */}
        <motion.div
          className="list-card glass-morphism top-performers"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="list-header">
            <h3>
              <FiAward className="inline-icon" />
              Top Performers
            </h3>
          </div>
          <div className="students-list">
            {analyticsData.topPerformers.map((student, idx) => (
              <div key={idx} className="student-item top">
                <div className="student-rank">#{idx + 1}</div>
                <div className="student-info">
                  <div className="student-name">{student.name}</div>
                  <div className="student-usn">{student.usn}</div>
                </div>
                <div className="student-stats">
                  <span className="stat-badge">{student.attendance}%</span>
                  <span className="streak-badge">🔥 {student.streak} days</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Low Attendance Students */}
        <motion.div
          className="list-card glass-morphism low-attendance"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="list-header">
            <h3>
              <FiAlertTriangle className="inline-icon" />
              Needs Attention
            </h3>
          </div>
          <div className="students-list">
            {analyticsData.lowAttendance.map((student, idx) => (
              <div key={idx} className="student-item low">
                <div className="student-alert">⚠️</div>
                <div className="student-info">
                  <div className="student-name">{student.name}</div>
                  <div className="student-usn">{student.usn}</div>
                </div>
                <div className="student-stats">
                  <span className="stat-badge low">{student.attendance}%</span>
                  <span className="missed-badge">{student.missed} missed</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TeacherAnalytics;
