import React, { useState, useEffect } from "react";
import { Line, Bar, Pie } from "react-chartjs-2";
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
import { motion } from "framer-motion";
import {
  FiUsers,
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiBook,
  FiMapPin,
  FiSettings,
} from "react-icons/fi";
import BubbleMetric from "./BubbleMetric";
import "./Dashboard.css";
import { API_BASE_URL } from "../../config/api";

// Register ChartJS components
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

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [bubbleMetrics, setBubbleMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("token");

      const [statsRes, bubblesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/dashboard/bubble-metrics`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const statsData = await statsRes.json();
      const bubblesData = await bubblesRes.json();

      if (statsData.status === "success") {
        setStats(statsData.data);
      }

      if (bubblesData.status === "success") {
        setBubbleMetrics(bubblesData.data.bubbleMetrics);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    setRefreshInterval(interval);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!stats) {
    return <div className="dashboard-error">Failed to load dashboard data</div>;
  }

  // Chart configurations
  const activityTimelineData = {
    labels: stats.activityTimeline.map((item) => {
      const date = new Date(item._id);
      return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });
    }),
    datasets: [
      {
        label: "Total Activity",
        data: stats.activityTimeline.map((item) => item.count),
        borderColor: "#00d4ff",
        backgroundColor: "rgba(0, 212, 255, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: "Successful",
        data: stats.activityTimeline.map((item) => item.successCount),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const actionsBreakdownData = {
    labels: stats.actionsBreakdown.map((item) =>
      item._id.replace("_", " ").toUpperCase()
    ),
    datasets: [
      {
        label: "Actions",
        data: stats.actionsBreakdown.map((item) => item.count),
        backgroundColor: [
          "rgba(0, 212, 255, 0.8)",
          "rgba(0, 255, 212, 0.8)",
          "rgba(139, 92, 246, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(251, 191, 36, 0.8)",
        ],
        borderColor: [
          "#00d4ff",
          "#00ffd4",
          "#8b5cf6",
          "#3b82f6",
          "#10b981",
          "#fbbf24",
        ],
        borderWidth: 2,
      },
    ],
  };

  const verificationMethodsData = {
    labels: stats.verificationMethods.map((item) => {
      const labels = {
        face_scan: "Face Recognition",
        fingerprint_scan: "Fingerprint",
        ble_connect: "BLE",
      };
      return labels[item._id] || item._id;
    }),
    datasets: [
      {
        data: stats.verificationMethods.map((item) => item.count),
        backgroundColor: [
          "rgba(0, 212, 255, 0.8)",
          "rgba(0, 255, 212, 0.8)",
          "rgba(139, 92, 246, 0.8)",
        ],
        borderColor: ["#00d4ff", "#00ffd4", "#8b5cf6"],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#ffffff",
          font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: "rgba(26, 26, 46, 0.95)",
        titleColor: "#00d4ff",
        bodyColor: "#ffffff",
        borderColor: "#00d4ff",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8" },
        grid: { color: "rgba(255, 255, 255, 0.05)" },
      },
      y: {
        ticks: { color: "#94a3b8" },
        grid: { color: "rgba(255, 255, 255, 0.05)" },
      },
    },
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <motion.div
        className="dashboard-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="header-content">
          <div className="header-text">
            <h1 className="section-heading">Hi, Administrator</h1>
            <p className="subtitle">You command. The system performs.</p>
          </div>
        </div>
      </motion.div>

      {/* Overview Stats Cards */}
      <motion.div
        className="stats-grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="stat-card-admin glass-morphism">
          <div className="stat-content">
            <div className="stat-value">{stats.overview.totalUsers || 88}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <FiUsers className="stat-icon-bg" />
        </div>

        <div className="stat-card-admin glass-morphism">
          <div className="stat-content">
            <div className="stat-value">
              {stats.overview.activeClasses || 7}
            </div>
            <div className="stat-label">Active Classes</div>
          </div>
          <FiBook className="stat-icon-bg" />
        </div>

        <div className="stat-card-admin glass-morphism">
          <div className="stat-content">
            <div className="stat-value">{stats.overview.liveSessions || 7}</div>
            <div className="stat-label">Live Sessions</div>
          </div>
          <FiActivity className="stat-icon-bg" />
        </div>

        <div className="stat-card-admin glass-morphism">
          <div className="stat-content">
            <div className="stat-value">
              {stats.overview.avgAttendance || 0}%
            </div>
            <div className="stat-label">Avg Attendance</div>
          </div>
          <FiCheckCircle className="stat-icon-bg" />
        </div>
      </motion.div>

      {/* Active Modules Section */}
      <motion.div
        className="active-modules-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="section-title-left">Active Modules</h2>
        <div className="modules-grid">
          <motion.div
            className="module-card glass-morphism"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="module-icon">
              <FiUsers />
            </div>
            <div className="module-content">
              <h3>User Management</h3>
              <p>Manage students, teachers, and admin accounts</p>
            </div>
          </motion.div>

          <motion.div
            className="module-card glass-morphism"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="module-icon">
              <FiBook />
            </div>
            <div className="module-content">
              <h3>Class Management</h3>
              <p>Create and manage classes, subjects, and schedules</p>
            </div>
          </motion.div>

          <motion.div
            className="module-card glass-morphism"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="module-icon">
              <FiActivity />
            </div>
            <div className="module-content">
              <h3>Subject Management</h3>
              <p>Manage curriculum subjects and codes</p>
            </div>
          </motion.div>

          <motion.div
            className="module-card glass-morphism"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="module-icon">
              <FiMapPin />
            </div>
            <div className="module-content">
              <h3>Location Settings</h3>
              <p>Set campus GPS location for attendance verification</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Bubble Metrics */}
      <motion.div
        className="bubble-metrics-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="section-title">Key Performance Metrics</h2>
        <div className="bubble-metrics-grid">
          {bubbleMetrics.map((metric, index) => (
            <BubbleMetric key={metric.id} metric={metric} delay={index * 0.1} />
          ))}
        </div>
      </motion.div>

      {/* Charts Section */}
      <div className="charts-section">
        {/* Activity Timeline */}
        <motion.div
          className="chart-container glass-morphism"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="chart-title">Activity Timeline (Last 30 Days)</h3>
          <div className="chart-wrapper">
            <Line data={activityTimelineData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Actions Breakdown */}
        <motion.div
          className="chart-container glass-morphism"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="chart-title">Actions Breakdown (Last 7 Days)</h3>
          <div className="chart-wrapper">
            <Bar data={actionsBreakdownData} options={chartOptions} />
          </div>
        </motion.div>

        {/* Verification Methods */}
        <motion.div
          className="chart-container glass-morphism chart-small"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="chart-title">Verification Methods</h3>
          <div className="chart-wrapper chart-pie">
            <Pie
              data={verificationMethodsData}
              options={{
                ...chartOptions,
                scales: undefined,
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* Recent Activity Feed */}
      <motion.div
        className="recent-activity glass-morphism"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <h3 className="section-title">Recent Activity</h3>
        <div className="activity-feed">
          {stats.recentActivity.map((log, index) => (
            <motion.div
              key={log._id}
              className="activity-item"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.05 }}
            >
              <div className="activity-avatar">
                {log.userId?.name?.charAt(0) || "?"}
              </div>
              <div className="activity-details">
                <p className="activity-user">{log.userId?.name || "Unknown"}</p>
                <p className="activity-description">{log.eventDescription}</p>
              </div>
              <div className="activity-meta">
                <span className="activity-time">
                  {new Date(log.timestamp).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span
                  className={`activity-status ${
                    log.metadata?.success ? "success" : "fail"
                  }`}
                >
                  {log.metadata?.success ? "✓" : "✗"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
