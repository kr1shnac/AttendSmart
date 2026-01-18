/* eslint-disable */
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  FiX,
  FiUsers,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiBarChart,
  FiAlertTriangle,
} from "react-icons/fi";
import PropTypes from "prop-types";
import { attendanceAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./LiveMonitor.css";

const LiveMonitor = ({ session, classData, onEndSession }) => {
  const [verifiedStudents, setVerifiedStudents] = useState([]);
  const [peerReviewStudents, setPeerReviewStudents] = useState([]);
  const [flaggedStudents, setFlaggedStudents] = useState([]);
  const [processedStudentIds, setProcessedStudentIds] = useState(new Set()); // Track approved/rejected
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);

  // Generate unique QR code value
  const qrValue = useMemo(() => {
    return `ATTENDSMART:${session._id}:${session.courseCode}:${
      session.sessionStartTime || ""
    }`;
  }, [session._id, session.courseCode, session.sessionStartTime]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Elapsed time counter (counts up) and Remaining time counter (counts down)
  useEffect(() => {
    if (!session?.startTime) return;

    // Safely parse start time (handle both Date object and ISO string)
    const startDate = new Date(session.startTime);
    // Validate date
    if (isNaN(startDate.getTime())) return;

    const startTime = startDate.getTime();
    const durationSeconds = (session.duration || 60) * 60; // Convert minutes to seconds

    const updateTimer = () => {
      const now = new Date().getTime();
      const elapsed = Math.floor(Math.max(0, now - startTime) / 1000);
      setElapsedTime(elapsed);

      // Calculate remaining time (countdown)
      const remaining = Math.max(0, durationSeconds - elapsed);
      setRemainingTime(remaining);
    };

    updateTimer(); // Initial update
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [session.startTime, session.duration]);
  // Fetch live attendance data (poll every 5 seconds)
  useEffect(() => {
    if (!session?._id) return;

    const fetchLiveAttendance = async () => {
      try {
        const token = localStorage.getItem("token");
        const apiUrl = process.env.REACT_APP_API_URL || "";
        const response = await fetch(
          `${apiUrl}/api/attendance/live/${session._id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.status === "success") {
            // Backend returns liveStudents array directly
            const verified = (data.data.liveStudents || []).map((s) => ({
              id: s.id,
              name: s.name,
              usn: s.usn,
              status: s.status || "verified",
              method: s.method || "Auto",
              checkInTime: s.checkInTime,
              verificationScore: s.verificationScore,
              distance: s.distance,
              signal: s.signal,
            }));
            setVerifiedStudents(verified);

            // Backend returns alerts for flagged students
            // Filter out students we've already processed locally
            const flagged = (data.data.alerts || [])
              .filter(
                (a) =>
                  a.type === "suspicious" &&
                  !processedStudentIds.has(a.studentId)
              )
              .map((a) => ({
                id: a.studentId,
                name: a.student,
                usn: a.usn || "N/A",
                message: a.message,
                attendanceId: a.attendanceId,
                distance: a.distance || "N/A",
                peerVerification: a.peerVerification,
              }));
            setFlaggedStudents(flagged);
          }
        }
      } catch (error) {
        console.error("Error fetching live attendance:", error);
      }
    };

    // Initial fetch
    fetchLiveAttendance();

    // Poll every 5 seconds
    const pollInterval = setInterval(fetchLiveAttendance, 5000);

    return () => clearInterval(pollInterval);
  }, [session?._id, processedStudentIds]);

  // Real students are received via WebSocket or parent component props
  // No simulation - students appear when they actually check in

  const handleApproveStudent = async (studentId, attendanceId) => {
    try {
      // Add to processed set immediately to prevent reappearing
      setProcessedStudentIds((prev) => new Set([...prev, studentId]));

      // Call API to approve the attendance
      await attendanceAPI.updateStatus(
        attendanceId,
        "present",
        "Approved by teacher"
      );

      // Update local state
      setFlaggedStudents((prev) => {
        const student = prev.find((s) => s.id === studentId);
        if (!student) return prev;

        setVerifiedStudents((prevVerified) => [
          ...prevVerified,
          {
            ...student,
            status: "verified",
            method: "Teacher Approved",
          },
        ]);

        return prev.filter((s) => s.id !== studentId);
      });

      toast.success("Student approved!");
    } catch (error) {
      console.error("Error approving student:", error);
      // Remove from processed set if API fails
      setProcessedStudentIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
      toast.error("Failed to approve student");
    }
  };

  const handleRejectStudent = async (studentId, attendanceId) => {
    try {
      // Add to processed set immediately to prevent reappearing
      setProcessedStudentIds((prev) => new Set([...prev, studentId]));

      // Call API to reject the attendance
      await attendanceAPI.updateStatus(
        attendanceId,
        "absent",
        "Rejected by teacher"
      );

      // Update local state
      setFlaggedStudents((prev) => prev.filter((s) => s.id !== studentId));

      toast.success("Student rejected");
    } catch (error) {
      console.error("Error rejecting student:", error);
      // Remove from processed set if API fails
      setProcessedStudentIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
      toast.error("Failed to reject student");
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSignalColor = (signal) => {
    if (signal >= -50) return "#10b981";
    if (signal >= -60) return "#00d4ff";
    if (signal >= -70) return "#fbbf24";
    return "#ef4444";
  };

  const getDistanceZone = (distance) => {
    if (distance <= 3) return { color: "#10b981", zone: "Near" };
    if (distance <= 7) return { color: "#00d4ff", zone: "Medium" };
    if (distance <= 10) return { color: "#fbbf24", zone: "Far" };
    return { color: "#ef4444", zone: "Very Far" };
  };

  const handleEndSession = () => {
    if (window.confirm("Are you sure you want to end attendance collection?")) {
      onEndSession();
    }
  };

  const totalPresent = verifiedStudents.length;
  const attendancePercentage = Math.round(
    (totalPresent / (session.expectedStudents || 60)) * 100
  );

  return (
    <div className="live-monitor">
      {/* Header */}
      <motion.div
        className="live-header glass-morphism"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="live-badge-container">
          <div className="live-pulse-wrapper">
            <div className="pulse-ring"></div>
            <div className="pulse-ring"></div>
            <div className="live-badge">
              <div className="live-dot"></div>
              <span>LIVE</span>
            </div>
          </div>
        </div>

        <div className="session-info-header">
          <h1>{session.subject}</h1>
          {session.topic && <p className="topic">{session.topic}</p>}
          <div className="session-meta-row">
            <span>{session.courseCode}</span>
            <span>•</span>
            <span>{session.className}</span>
            <span>•</span>
            <span>{session.room}</span>
          </div>
        </div>

        <div className="timer-display countdown">
          <FiClock />
          <span className="timer-value">{formatTime(remainingTime)}</span>
          <span className="timer-label">remaining</span>
        </div>

        <button className="end-session-btn" onClick={handleEndSession}>
          <FiX /> End Session
        </button>
      </motion.div>

      {/* Stats Row */}
      <div className="stats-row">
        <motion.div
          className="stat-box-live glass-morphism"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <FiCheckCircle className="stat-icon-live present" />
          <div className="stat-content-live">
            <div className="stat-value-live">{totalPresent}</div>
            <div className="stat-label-live">Verified</div>
          </div>
        </motion.div>

        <motion.div
          className="stat-box-live glass-morphism"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <FiAlertTriangle className="stat-icon-live warning" />
          <div className="stat-content-live">
            <div className="stat-value-live">{peerReviewStudents.length}</div>
            <div className="stat-label-live">Under Review</div>
          </div>
        </motion.div>

        <motion.div
          className="stat-box-live glass-morphism"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <FiAlertCircle className="stat-icon-live alert" />
          <div className="stat-content-live">
            <div className="stat-value-live">{flaggedStudents.length}</div>
            <div className="stat-label-live">Need Review</div>
          </div>
        </motion.div>

        <motion.div
          className="stat-box-live glass-morphism"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <FiBarChart className="stat-icon-live" />
          <div className="stat-content-live">
            <div className="stat-value-live">{attendancePercentage}%</div>
            <div className="stat-label-live">Attendance</div>
          </div>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="live-content-grid three-section">
        {/* QR Code Section */}
        <motion.div
          className="qr-section glass-morphism"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h3>
            <FiAlertCircle /> Attendance Code
          </h3>
          <div className="qr-code-container">
            <QRCodeSVG
              value={qrValue}
              size={200}
              level="H"
              includeMargin={true}
              fgColor="#00d4ff"
              bgColor="#ffffff"
            />
          </div>
          <div className="access-code">
            <span>Session:</span>
            <strong>{session._id?.slice(-6).toUpperCase() || "ABC123"}</strong>
          </div>
          <p className="qr-instruction">Students scan to check in</p>
        </motion.div>

        {/* Student Sections */}
        <div className="students-sections">
          {/* Verified Students */}
          <motion.div
            className="students-feed glass-morphism"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3>
              <FiCheckCircle style={{ color: "#10b981" }} /> Verified Students (
              {verifiedStudents.length})
            </h3>
            <div className="students-scroll compact">
              <AnimatePresence>
                {verifiedStudents.map((student, index) => (
                  <motion.div
                    key={student.id}
                    className="student-card-compact verified"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <div className="student-avatar-compact">
                      {student.name.charAt(0)}
                    </div>
                    <div className="student-info-compact">
                      <div className="name">{student.name}</div>
                      <div className="usn">{student.usn}</div>
                    </div>
                    <div className="status-badge-compact verified">✓</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Peer Review Students */}
          <motion.div
            className="students-feed glass-morphism"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3>
              <FiAlertTriangle style={{ color: "#fbbf24" }} /> Under Peer Review
              ({peerReviewStudents.length})
            </h3>
            <div className="students-scroll compact">
              <AnimatePresence>
                {peerReviewStudents.map((student) => (
                  <motion.div
                    key={student.id}
                    className="student-card-compact peer-review"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <div className="student-avatar-compact">
                      {student.name.charAt(0)}
                    </div>
                    <div className="student-info-compact">
                      <div className="name">{student.name}</div>
                      <div className="usn">{student.usn}</div>
                      <div className="distance-info">
                        📏 {student.distance}m
                      </div>
                    </div>
                    <div className="status-badge-compact peer-review">
                      <div className="spinner-peer"></div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Flagged Students - Teacher Review */}
          <motion.div
            className="students-feed glass-morphism flagged-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3>
              <FiAlertCircle style={{ color: "#ef4444" }} /> Needs Your Review (
              {flaggedStudents.length})
            </h3>
            <div className="students-scroll">
              <AnimatePresence>
                {flaggedStudents.map((student) => (
                  <motion.div
                    key={student.id}
                    className="student-card-review flagged"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <div className="review-header">
                      <div className="student-avatar-review">
                        {student.name.charAt(0)}
                      </div>
                      <div className="student-info-review">
                        <div className="name">{student.name}</div>
                        <div className="usn">{student.usn}</div>
                      </div>
                    </div>

                    <div className="review-details">
                      <div className="detail-row">
                        <span>Distance:</span>
                        <strong style={{ color: "#ef4444" }}>
                          {student.distance}m
                        </strong>
                      </div>
                      <div className="detail-row">
                        <span>Peer Votes:</span>
                        <strong>
                          {student.peerVerification?.yesVotes || 0} Yes,{" "}
                          {student.peerVerification?.noVotes || 0} No
                        </strong>
                      </div>
                    </div>

                    <div className="review-actions">
                      <button
                        className="approve-btn"
                        onClick={() =>
                          handleApproveStudent(student.id, student.attendanceId)
                        }
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() =>
                          handleRejectStudent(student.id, student.attendanceId)
                        }
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {flaggedStudents.length === 0 && (
                <div className="empty-state">
                  <FiCheckCircle />
                  <p>No students need review</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

LiveMonitor.propTypes = {
  session: PropTypes.object.isRequired,
  classData: PropTypes.object.isRequired,
  onEndSession: PropTypes.func.isRequired,
};

export default LiveMonitor;
