/* eslint-disable */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowLeft } from "react-icons/fi";
import LiveMonitor from "../components/Teacher/LiveMonitor";
import { sessionsAPI } from "../services/api";
import sessionStateManager from "../services/sessionStateManager";
import toast from "../services/toastService";
import "./LiveMonitorPage.css";

const LiveMonitorPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSessionData();
  }, [sessionId]);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const response = await sessionsAPI.getById(sessionId);

      if (response.status === "success" && response.data?.session) {
        const sessionData = response.data.session;

        // Transform session data for LiveMonitor
        const transformedSession = {
          _id: sessionData._id,
          subject: sessionData.class?.subject || sessionData.topic || "Session",
          courseCode: sessionData.class?.courseCode || "",
          className: sessionData.class?.className || "",
          topic: sessionData.topic || "",
          room:
            typeof sessionData.location === "object"
              ? sessionData.location?.room || "TBA"
              : sessionData.location || "TBA",
          startTime: sessionData.startTime,
          duration: sessionData.duration || 60,
          expectedStudents:
            sessionData.expectedStudents ||
            sessionData.class?.totalStudents ||
            0,
          status: sessionData.status,
        };

        setSession(transformedSession);
        setClassData(sessionData.class || {});

        // Update session state manager
        sessionStateManager.setActiveSession(sessionData);
      } else {
        setError("Session not found");
      }
    } catch (err) {
      console.error("Error fetching session:", err);
      setError(err.message || "Failed to load session");
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    try {
      await sessionsAPI.end(sessionId);
      sessionStateManager.clearActiveSession();
      toast.success("Session ended successfully!");
      navigate("/teacher/sessions");
    } catch (err) {
      console.error("Error ending session:", err);
      toast.error("Failed to end session");
    }
  };

  const handleBack = () => {
    navigate("/teacher/sessions");
  };

  if (loading) {
    return (
      <div className="live-monitor-page loading">
        <div className="spinner-large"></div>
        <p>Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="live-monitor-page error">
        <h2>Session Not Found</h2>
        <p>
          {error ||
            "The session you're looking for doesn't exist or has ended."}
        </p>
        <button onClick={handleBack} className="back-btn">
          <FiArrowLeft /> Back to Sessions
        </button>
      </div>
    );
  }

  return (
    <div className="live-monitor-page">
      <motion.button
        className="back-button-float"
        onClick={handleBack}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ x: -5 }}
      >
        <FiArrowLeft /> Back
      </motion.button>

      <LiveMonitor
        session={session}
        classData={classData}
        onEndSession={handleEndSession}
      />
    </div>
  );
};

export default LiveMonitorPage;
