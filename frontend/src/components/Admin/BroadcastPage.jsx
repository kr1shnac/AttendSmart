import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiSend,
  FiUsers,
  FiUser,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import { messagesAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./BroadcastPage.css";

const BroadcastPage = () => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [targetRoles, setTargetRoles] = useState([]);
  const [priority, setPriority] = useState("normal");
  const [sending, setSending] = useState(false);
  const [sentMessages, setSentMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    fetchSentMessages();
  }, []);

  const fetchSentMessages = async () => {
    try {
      setLoading(true);
      const response = await messagesAPI.getSentMessages();
      if (response.success) {
        setSentMessages(response.data.messages || []);
      }
    } catch (error) {
      console.error("Failed to fetch sent messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      toast.error("Message content is required");
      return;
    }

    if (targetRoles.length === 0) {
      toast.error("Please select at least one target audience");
      return;
    }

    try {
      setSending(true);
      const response = await messagesAPI.sendBroadcast({
        subject: subject.trim(),
        message: message.trim(),
        targetRoles,
        priority,
      });

      if (response.success) {
        toast.success(
          `Broadcast sent to ${response.data.recipientCount} users!`
        );
        setSubject("");
        setMessage("");
        setTargetRoles([]);
        setPriority("normal");
        fetchSentMessages();
      }
    } catch (error) {
      console.error("Failed to send broadcast:", error);
      toast.error(error.response?.data?.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  const toggleRole = (role) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent":
        return "#ef4444";
      case "high":
        return "#f59e0b";
      case "normal":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className="broadcast-page">
      {/* Header */}
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="page-title">
          <FiSend className="title-icon" />
          Broadcast Messages
        </h1>
        <p className="page-subtitle">
          Send announcements to students, teachers, or the entire community
        </p>
      </motion.div>

      <div className="broadcast-content">
        {/* Compose Broadcast */}
        <motion.div
          className="compose-section glass-morphism"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="section-heading">Compose Broadcast</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Subject (Optional)</label>
              <input
                type="text"
                placeholder="Enter subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Message *</label>
              <textarea
                placeholder="Enter your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={8}
                required
                className="form-textarea"
              />
              <span className="char-count">{message.length}/2000</span>
            </div>

            <div className="form-group">
              <label>Target Audience *</label>
              <div className="role-chips">
                {user.role === "admin" && (
                  <>
                    <button
                      type="button"
                      className={`role-chip ${
                        targetRoles.includes("all") ? "active" : ""
                      }`}
                      onClick={() => toggleRole("all")}
                    >
                      <FiUsers />
                      Everyone
                    </button>
                    <button
                      type="button"
                      className={`role-chip ${
                        targetRoles.includes("teacher") ? "active" : ""
                      }`}
                      onClick={() => toggleRole("teacher")}
                    >
                      <FiUser />
                      Teachers Only
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={`role-chip ${
                    targetRoles.includes("student") ? "active" : ""
                  }`}
                  onClick={() => toggleRole("student")}
                >
                  <FiUser />
                  Students
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="form-select"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn-send-broadcast"
              disabled={sending}
            >
              {sending ? (
                <>
                  <div className="spinner-small"></div>
                  Sending...
                </>
              ) : (
                <>
                  <FiSend />
                  Send Broadcast
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Sent Messages History */}
        <motion.div
          className="history-section glass-morphism"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="section-heading">Broadcast History</h2>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading history...</p>
            </div>
          ) : sentMessages.length === 0 ? (
            <div className="empty-state">
              <FiAlertCircle className="empty-icon" />
              <p>No broadcasts sent yet</p>
            </div>
          ) : (
            <div className="messages-history">
              {sentMessages.map((msg) => (
                <div key={msg._id} className="history-item">
                  <div className="history-header">
                    <span
                      className="priority-badge"
                      style={{
                        backgroundColor: getPriorityColor(msg.priority),
                      }}
                    >
                      {msg.priority}
                    </span>
                    <span className="history-time">
                      <FiClock />
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>

                  {msg.subject && (
                    <h4 className="history-subject">{msg.subject}</h4>
                  )}
                  <p className="history-message">{msg.message}</p>

                  <div className="history-meta">
                    <span className="meta-item">
                      <FiUsers />
                      {msg.targetRoles.join(", ")}
                    </span>
                    <span className="meta-item">
                      <FiSend />
                      {msg.recipientCount} recipients
                    </span>
                    <span className="meta-item">
                      <FiCheckCircle />
                      {msg.readCount} read
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default BroadcastPage;
