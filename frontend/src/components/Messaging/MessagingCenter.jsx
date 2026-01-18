import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMessageSquare,
  FiX,
  FiSend,
  FiUsers,
  FiUser,
  FiClock,
  FiSearch,
  FiPlus,
  FiCheckCircle,
  FiAlertCircle,
  FiChevronLeft,
} from "react-icons/fi";
import { messagesAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./MessagingCenter.css";

const MessagingCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("conversations"); // conversations, chat, newChat, broadcast
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Fetch conversations when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchConversations();
    }
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await messagesAPI.getConversations();
      if (response.success) {
        setConversations(response.data.conversations || []);
        calculateUnreadCount(response.data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await messagesAPI.getConversationMessages(
        conversationId
      );
      if (response.success) {
        setMessages(response.data.messages || []);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await messagesAPI.getContacts();
      if (response.success) {
        setContacts(response.data.contacts || []);
      }
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
      toast.error("Failed to load contacts");
    }
  };

  const calculateUnreadCount = (convos) => {
    const count = convos.reduce((acc, convo) => {
      const participant = convo.participants.find(
        (p) => p.user._id === user.id || p.user._id === user.userId
      );
      if (participant && convo.lastMessage) {
        const isUnread =
          !participant.lastRead ||
          new Date(convo.lastMessage.timestamp) >
            new Date(participant.lastRead);
        return isUnread ? acc + 1 : acc;
      }
      return acc;
    }, 0);
    setUnreadCount(count);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeConversation) return;
    const tempMessage = {
      _id: Date.now(),
      message: messageInput.trim(),
      sender: { _id: user.id || user.userId, name: user.name },
      createdAt: new Date().toISOString(),
      sending: true,
    };
    setMessages((prev) => [...prev, tempMessage]);
    setMessageInput("");
    try {
      const response = await messagesAPI.sendMessage({
        conversationId: activeConversation._id,
        message: messageInput.trim(),
      });
      if (response.success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === tempMessage._id ? response.data.message : msg
          )
        );
        fetchConversations();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
      setMessages((prev) => prev.filter((msg) => msg._id !== tempMessage._id));
    }
  };

  const handleOpenConversation = (conversation) => {
    setActiveConversation(conversation);
    setView("chat");
    fetchMessages(conversation._id);
  };

  const handleStartNewChat = async (contact) => {
    try {
      const response = await messagesAPI.startConversation({
        recipientId: contact._id,
        type: "direct",
      });
      if (response.success) {
        setActiveConversation(response.data.conversation);
        setView("chat");
        fetchMessages(response.data.conversation._id);
      }
    } catch (error) {
      console.error("Failed to start conversation:", error);
      toast.error(
        error.response?.data?.message || "Failed to start conversation"
      );
    }
  };

  const handleBack = () => {
    if (view === "chat" || view === "newChat" || view === "broadcast") {
      setView("conversations");
      setActiveConversation(null);
      setMessages([]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 48) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const getConversationTitle = (conversation) => {
    if (conversation.name) return conversation.name;
    if (conversation.type === "direct") {
      const otherUser = conversation.participants.find(
        (p) => p.user._id !== user.id && p.user._id !== user.userId
      );
      return otherUser?.user.name || "Unknown User";
    }
    return "Conversation";
  };

  const getConversationIcon = (conversation) => {
    if (conversation.channel === "community")
      return <FiUsers className="conv-icon community" />;
    if (conversation.channel === "teachers")
      return <FiUsers className="conv-icon teachers" />;
    if (conversation.type === "class")
      return <FiUsers className="conv-icon class" />;
    return <FiUser className="conv-icon direct" />;
  };

  const getRoleBadgeColor = (role) => {
    if (role === "admin") return "#8b5cf6";
    if (role === "teacher") return "#10b981";
    return "#3b82f6";
  };

  const filteredConversations = conversations.filter((conv) =>
    getConversationTitle(conv).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Floating Button */}
      <motion.div
        className="messaging-trigger"
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <FiMessageSquare className="trigger-icon" />
        {unreadCount > 0 && (
          <motion.div
            className="unread-badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.div>
        )}
      </motion.div>

      {/* Messaging Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="messaging-panel glass-morphism"
            initial={{ opacity: 0, scale: 0.95, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 50 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="messaging-header">
              <div className="header-left">
                {view !== "conversations" && (
                  <button className="back-button" onClick={handleBack}>
                    <FiChevronLeft />
                  </button>
                )}
                <FiMessageSquare className="header-icon" />
                <h3>
                  {view === "conversations" && "Messages"}
                  {view === "chat" && getConversationTitle(activeConversation)}
                  {view === "newChat" && "New Chat"}
                  {view === "broadcast" && "Broadcast Message"}
                </h3>
              </div>
              <div className="header-actions">
                {view === "conversations" &&
                  (user.role === "admin" || user.role === "teacher") && (
                    <button
                      className="action-button"
                      onClick={() => setView("broadcast")}
                      title="Broadcast Message"
                    >
                      <FiAlertCircle />
                    </button>
                  )}
                {view === "conversations" && (
                  <button
                    className="action-button"
                    onClick={() => {
                      setView("newChat");
                      fetchContacts();
                    }}
                    title="New Chat"
                  >
                    <FiPlus />
                  </button>
                )}
                <button
                  className="close-button"
                  onClick={() => setIsOpen(false)}
                >
                  <FiX />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="messaging-content">
              {/* CONVERSATIONS VIEW */}
              {view === "conversations" && (
                <>
                  <div className="search-bar">
                    <FiSearch className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="conversations-list">
                    {loading ? (
                      <div className="loading-state">
                        <div className="spinner" />
                        <p>Loading conversations...</p>
                      </div>
                    ) : filteredConversations.length === 0 ? (
                      <div className="empty-state">
                        <FiMessageSquare className="empty-icon" />
                        <p>No conversations yet</p>
                        <span>Start a new chat to begin messaging</span>
                      </div>
                    ) : (
                      filteredConversations.map((conversation) => {
                        const participant = conversation.participants.find(
                          (p) =>
                            p.user._id === user.id || p.user._id === user.userId
                        );
                        const isUnread =
                          conversation.lastMessage &&
                          (!participant?.lastRead ||
                            new Date(conversation.lastMessage.timestamp) >
                              new Date(participant.lastRead));
                        return (
                          <motion.div
                            key={conversation._id}
                            className={`conversation-item ${
                              isUnread ? "unread" : ""
                            }`}
                            onClick={() => handleOpenConversation(conversation)}
                            whileHover={{
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                            }}
                          >
                            <div className="conv-avatar">
                              {getConversationIcon(conversation)}
                            </div>
                            <div className="conv-info">
                              <div className="conv-header">
                                <span className="conv-name">
                                  {getConversationTitle(conversation)}
                                </span>
                                {conversation.lastMessage && (
                                  <span className="conv-time">
                                    {formatTime(
                                      conversation.lastMessage.timestamp
                                    )}
                                  </span>
                                )}
                              </div>
                              {conversation.lastMessage && (
                                <p className="conv-last-message">
                                  {conversation.lastMessage.text}
                                </p>
                              )}
                            </div>
                            {isUnread && <div className="unread-indicator" />}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {/* CHAT VIEW */}
              {view === "chat" && activeConversation && (
                <>
                  <div className="messages-container">
                    {messages.length === 0 ? (
                      <div className="empty-chat">
                        <FiMessageSquare className="empty-icon" />
                        <p>No messages yet</p>
                        <span>Start the conversation!</span>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isMine =
                          message.sender._id === user.id ||
                          message.sender._id === user.userId;
                        return (
                          <motion.div
                            key={message._id}
                            className={`message-bubble ${
                              isMine ? "mine" : "theirs"
                            }`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            {!isMine && (
                              <div className="message-sender">
                                {message.sender.name}
                              </div>
                            )}
                            <div className="message-content">
                              {message.message}
                            </div>
                            <div className="message-meta">
                              <FiClock className="meta-icon" />
                              <span>{formatTime(message.createdAt)}</span>
                              {isMine && (
                                <>
                                  {message.sending ? (
                                    <FiClock className="status-icon sending" />
                                  ) : (
                                    <FiCheckCircle className="status-icon sent" />
                                  )}
                                </>
                              )}
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="message-input-container">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleSendMessage()
                      }
                    />
                    <button
                      className="send-button"
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                    >
                      <FiSend />
                    </button>
                  </div>
                </>
              )}

              {/* NEW CHAT VIEW */}
              {view === "newChat" && (
                <>
                  <div className="search-bar">
                    <FiSearch className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="contacts-list">
                    {filteredContacts.length === 0 ? (
                      <div className="empty-state">
                        <FiUser className="empty-icon" />
                        <p>No contacts found</p>
                      </div>
                    ) : (
                      filteredContacts.map((contact) => (
                        <motion.div
                          key={contact._id}
                          className="contact-item"
                          onClick={() => handleStartNewChat(contact)}
                          whileHover={{
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                          }}
                        >
                          <div className="contact-avatar">
                            <FiUser />
                          </div>
                          <div className="contact-info">
                            <span className="contact-name">{contact.name}</span>
                            <span
                              className="contact-role"
                              style={{ color: getRoleBadgeColor(contact.role) }}
                            >
                              {contact.role}
                            </span>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* BROADCAST VIEW */}
              {view === "broadcast" && (
                <BroadcastForm
                  onBack={handleBack}
                  onSuccess={fetchConversations}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Broadcast Form Component
const BroadcastForm = ({ onBack, onSuccess }) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [targetRoles, setTargetRoles] = useState([]);
  const [priority, setPriority] = useState("normal");
  const [sending, setSending] = useState(false);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

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
        onSuccess();
        onBack();
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

  return (
    <form className="broadcast-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Subject (Optional)</label>
        <input
          type="text"
          placeholder="Enter subject..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="form-group">
        <label>Message *</label>
        <textarea
          placeholder="Enter your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={6}
          required
        />
        <span className="char-count">{message.length}/2000</span>
      </div>
      <div className="form-group">
        <label>Target Audience *</label>
        <div className="role-options">
          {user.role === "admin" && (
            <>
              <button
                type="button"
                className={`role-chip ${
                  targetRoles.includes("all") ? "active" : ""
                }`}
                onClick={() => toggleRole("all")}
              >
                {" "}
                <FiUsers /> Everyone{" "}
              </button>
              <button
                type="button"
                className={`role-chip ${
                  targetRoles.includes("teacher") ? "active" : ""
                }`}
                onClick={() => toggleRole("teacher")}
              >
                {" "}
                <FiUser /> Teachers Only{" "}
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
            {" "}
            <FiUser /> Students{" "}
          </button>
        </div>
      </div>
      <div className="form-group">
        <label>Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="btn-cancel"
          onClick={onBack}
          disabled={sending}
        >
          Cancel
        </button>
        <button type="submit" className="btn-send" disabled={sending}>
          {sending ? (
            <>
              <div className="spinner-small" /> Sending...
            </>
          ) : (
            <>
              <FiSend /> Send Broadcast
            </>
          )}
        </button>
      </div>
    </form>
  );
};

BroadcastForm.propTypes = {
  onBack: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};

export default MessagingCenter;
