import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import sessionStateManager from "../../services/sessionStateManager";
import socketService from "../../services/socketService";
import { sessionsAPI } from "../../services/api";
import "./LiveSessionBar.css";

/**
 * LiveSessionBar Component
 * Persistent bar shown below navbar when a live session is active
 * Allows quick return to session and shows live status
 */
const LiveSessionBar = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [remainingTime, setRemainingTime] = useState("");

  useEffect(() => {
    // Initialize session state
    const initSession = async () => {
      await sessionStateManager.initialize();
      const currentSession = sessionStateManager.getActiveSession();
      const currentRole = sessionStateManager.getSessionRole();

      if (currentSession) {
        setSession(currentSession);
        setRole(currentRole);
        setParticipantCount(currentSession.presentCount || 0);

        // Check if attendance was already marked for this session (persisted in localStorage)
        const storedStatus = localStorage.getItem(
          `attendance_${currentSession.id || currentSession._id}`
        );
        if (storedStatus === "verified") {
          setAttendanceMarked(true);
        }
      }
    };

    initSession();

    // Subscribe to session state changes
    const unsubscribe = sessionStateManager.subscribe(({ session, role }) => {
      setSession(session);
      setRole(role);
      if (session) {
        setParticipantCount(session.presentCount || 0);
        // Check attendance status when session updates
        const storedStatus = localStorage.getItem(
          `attendance_${session.id || session._id}`
        );
        if (storedStatus === "verified") {
          setAttendanceMarked(true);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Calculate remaining time
  useEffect(() => {
    if (!session?.startTime) return;

    const updateRemainingTime = () => {
      const start = new Date(session.startTime);
      const now = new Date();
      const diff = Math.floor((now - start) / 1000);

      // Calculate remaining time based on session duration
      const durationSeconds = (session.duration || 60) * 60;
      const remaining = Math.max(0, durationSeconds - diff);

      if (remaining > 0) {
        const remMins = Math.floor(remaining / 60);
        const remSecs = remaining % 60;
        setRemainingTime(`${remMins}:${String(remSecs).padStart(2, "0")}`);
      } else {
        setRemainingTime("00:00");
      }
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 1000);

    return () => clearInterval(interval);
  }, [session?.startTime, session?.duration]);

  // Listen for real-time updates
  useEffect(() => {
    if (!session) return;

    const handleStudentCheckin = () => {
      setParticipantCount((prev) => prev + 1);
      sessionStateManager.updateSessionStats({
        presentCount: participantCount + 1,
      });
    };

    const handleAttendanceMarked = () => {
      setAttendanceMarked(true);
    };

    const handleSessionEnded = (data) => {
      if (data.sessionId === session.id || data.sessionId === session._id) {
        // Clear attendance status from localStorage when session ends
        localStorage.removeItem(`attendance_${session.id || session._id}`);
        sessionStateManager.clearActiveSession();
        setSession(null);
      }
    };

    const handleParticipantUpdate = (data) => {
      setParticipantCount(data.participantCount);
    };

    socketService.on("student-checkin", handleStudentCheckin);
    socketService.on("attendance-marked", handleAttendanceMarked);
    socketService.on("session-ended", handleSessionEnded);
    socketService.on("participant-joined", handleParticipantUpdate);
    socketService.on("participant-left", handleParticipantUpdate);

    return () => {
      socketService.off("student-checkin", handleStudentCheckin);
      socketService.off("attendance-marked", handleAttendanceMarked);
      socketService.off("session-ended", handleSessionEnded);
      socketService.off("participant-joined", handleParticipantUpdate);
      socketService.off("participant-left", handleParticipantUpdate);
    };
  }, [session, participantCount]);

  const handleViewSession = () => {
    if (role === "teacher") {
      navigate(`/teacher/live-monitor/${session._id || session.id}`);
    } else {
      // Students don't navigate, they just see the bar
      navigate(`/student`);
    }
  };

  const handleEndSession = async () => {
    if (!session || isEnding) return;

    const confirmed = window.confirm(
      "Are you sure you want to end this session? All attendance data will be saved."
    );

    if (!confirmed) return;

    setIsEnding(true);
    try {
      await sessionsAPI.end(session._id || session.id);
      sessionStateManager.clearActiveSession();
      setSession(null);
    } catch (error) {
      console.error("Error ending session:", error);
      alert("Failed to end session. Please try again.");
    } finally {
      setIsEnding(false);
    }
  };

  // Don't render if no active session
  if (!session) return null;

  return (
    <div className="live-session-bar">
      <div className="live-session-bar__indicator">
        <span className="live-session-bar__pulse"></span>
        <span className="live-session-bar__live-text">LIVE</span>
      </div>

      <div className="live-session-bar__info">
        <span className="live-session-bar__subject">
          {session.subject || session.className || session.topic}
        </span>
        {session.courseCode && (
          <span className="live-session-bar__code">
            {" "}
            - {session.courseCode}
          </span>
        )}
      </div>

      <div className="live-session-bar__stats">
        <span className="live-session-bar__participants">
          👥 {participantCount} students
        </span>
        {remainingTime && (
          <span className="live-session-bar__countdown">
            ⏱ {remainingTime} left
          </span>
        )}
      </div>

      {role === "student" && attendanceMarked && (
        <div className="live-session-bar__status live-session-bar__status--marked">
          ✓ Attendance Marked
        </div>
      )}

      <div className="live-session-bar__actions">
        <button
          className="live-session-bar__btn live-session-bar__btn--view"
          onClick={handleViewSession}
        >
          {role === "teacher" ? "View Session" : "Return to Session"}
        </button>

        {role === "teacher" && (
          <button
            className="live-session-bar__btn live-session-bar__btn--end"
            onClick={handleEndSession}
            disabled={isEnding}
          >
            {isEnding ? "Ending..." : "End Session"}
          </button>
        )}
      </div>
    </div>
  );
};

export default LiveSessionBar;
