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
  FiSmile,
} from "react-icons/fi";
import { messagesAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./MessageCenter.css";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "👏"];

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
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const messagePanelRef = useRef(null);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const typingTimeoutRef = useRef(null);

  // Fetch conversations when open
  useEffect(() => {
    if (isOpen) fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Scroll messages bottom on load or new message
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isOpen &&
        messagePanelRef.current &&
        !messagePanelRef.current.contains(e.target) &&
        !e.target.closest(".messaging-trigger")
      ) {
        setIsOpen(false);
        setView("conversations");
        setActiveConversation(null);
        setMessages([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Socket event listeners
  useEffect(() => {
    if (!window.socket) return;

    // New message received
    const handleNewMessage = (msg) => {
      if (activeConversation && msg.channelId === activeConversation._id) {
        setMessages((prev) => [...prev, msg]);
      }
      fetchConversations();
    };

    // Urgent notification received
    const handleUrgentNotification = (data) => {
      if (data.conversationId === activeConversation?._id) {
        toast.info(`🚨 Urgent message from ${data.sender}: ${data.message}`, {
          autoClose: 8000,
          pauseOnHover: true,
        });
      }
    };

    // Mention notification received
    const handleMentionNotification = (data) => {
      if (data.conversationId === activeConversation?._id) {
        toast.info(`🔔 You were mentioned by ${data.sender}`, {
          autoClose: 7000,
          pauseOnHover: true,
        });
      }
    };

    // Typing started
    const handleUserTyping = ({ conversationId, userId, userName }) => {
      if (conversationId !== activeConversation?._id) return;
      if (userId === user.id) return;
      setTypingUsers((prev) => {
        if (prev.find((u) => u.userId === userId)) return prev;
        return [...prev, { userId, userName }];
      });
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
      }, 4000);
    };

    // Typing stopped
    const handleUserStoppedTyping = ({ userId }) => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
    };

    // Reaction added or removed - refresh messages for updated reactions
    const handleReactionChanged = () => {
      if (activeConversation) fetchMessages(activeConversation._id);
    };

    window.socket.on("new-message", handleNewMessage);
    window.socket.on("urgent-notification", handleUrgentNotification);
    window.socket.on("mention-notification", handleMentionNotification);
    window.socket.on("user-typing", handleUserTyping);
    window.socket.on("user-stopped-typing", handleUserStoppedTyping);
    window.socket.on("reaction-added", handleReactionChanged);
    window.socket.on("reaction-removed", handleReactionChanged);

    return () => {
      window.socket.off("new-message", handleNewMessage);
      window.socket.off("urgent-notification", handleUrgentNotification);
      window.socket.off("mention-notification", handleMentionNotification);
      window.socket.off("user-typing", handleUserTyping);
      window.socket.off("user-stopped-typing", handleUserStoppedTyping);
      window.socket.off("reaction-added", handleReactionChanged);
      window.socket.off("reaction-removed", handleReactionChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, user.id]);

  // Fetch conversations
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

  // Fetch messages for a conversation
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

  // Fetch contacts for new chat view
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

  // Calculate unread count from conversations
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

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Format timestamps nicely
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

  // Get conversation title logic
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

  // Get conversation icon based on channel/type
  const getConversationIcon = (conversation) => {
    if (conversation.channel === "community")
      return <FiUsers className="conv-icon community" />;
    if (conversation.channel === "teachers")
      return <FiUsers className="conv-icon teachers" />;
    if (conversation.type === "class")
      return <FiUsers className="conv-icon class" />;
    return <FiUser className="conv-icon direct" />;
  };

  // Role badge colors
  const getRoleBadgeColor = (role) => {
    if (role === "admin") return "#8b5cf6";
    if (role === "teacher") return "#10b981";
    return "#3b82f6";
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter((conv) =>
    getConversationTitle(conv).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter contacts by search
  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Send typing notification
  const handleTyping = () => {
    if (!activeConversation) return;
    window.socket.emit("typing-start", {
      conversationId: activeConversation._id,
      userId: user.id || user.userId,
      userName: user.name,
    });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      window.socket.emit("typing-stop", {
        conversationId: activeConversation._id,
        userId: user.id || user.userId,
      });
    }, 3000);
  };

  // Send message handler with reactions + priority later
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeConversation) return;

    const tempMessage = {
      _id: Date.now(),
      message: messageInput.trim(),
      sender: { _id: user.id || user.userId, name: user.name },
      createdAt: new Date().toISOString(),
      sending: true,
      priority: "normal",
      reactions: [],
    };

    setMessages((prev) => [...prev, tempMessage]);
    setMessageInput("");

    try {
      const response = await messagesAPI.sendMessage({
        conversationId: activeConversation._id,
        message: tempMessage.message,
        priority: tempMessage.priority,
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

  // Open conversation and load messages
  const handleOpenConversation = (conversation) => {
    setActiveConversation(conversation);
    setView("chat");
    fetchMessages(conversation._id);
  };

  // Start a new chat with selected contact
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

  // Back button resets to conversations view
  const handleBack = () => {
    if (view !== "conversations") {
      setView("conversations");
      setActiveConversation(null);
      setMessages([]);
    }
  };

  // Add or remove a reaction emoji for the message
  const handleReact = async (messageId, emoji) => {
    try {
      await messagesAPI.reactMessage(messageId, emoji);
      // Optimistic UI update (fetch messages again)
      fetchMessages(activeConversation._id);
    } catch (error) {
      toast.error("Failed to react to message");
    }
  };

  // Highlight @mentions in message text
  const parseMessageWithMentions = (text, mentions = []) => {
    let parsed = text;
    mentions.forEach((mention) => {
      const mentionText = `@${mention.name}`;
      const htmlMention = `<span class="mention">@${mention.name}</span>`;
      parsed = parsed.replace(new RegExp(mentionText, "g"), htmlMention);
    });
    return parsed;
  };

  // Render each message with urgency badge, mentions and reactions
  const renderMessage = (msg) => {
    const isMine = msg.sender._id === user.id || msg.sender._id === user.userId;
    const isUrgent = msg.priority === "urgent";

    return (
      <motion.div
        key={msg._id}
        className={`message-bubble ${isMine ? "mine" : "theirs"} ${
          isUrgent ? "urgent-message" : ""
        }`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {!isMine && <div className="message-sender">{msg.sender.name}</div>}

        {isUrgent && <span className="urgent-badge">🚨 URGENT</span>}

        <div
          className="message-content"
          dangerouslySetInnerHTML={{
            __html: parseMessageWithMentions(msg.message, msg.mentions),
          }}
        />

        <div className="message-meta">
          <FiClock className="meta-icon" />
          <span>{formatTime(msg.createdAt)}</span>
          {isMine && (
            <>
              {msg.sending ? (
                <FiClock className="status-icon sending" />
              ) : (
                <FiCheckCircle className="status-icon sent" />
              )}
            </>
          )}
        </div>

        {/* Reaction Bar */}
        <div className="reaction-bar">
          {msg.reactions?.map((r) => (
            <button
              key={`${r.emoji}-${r.user._id}`}
              onClick={() => handleReact(msg._id, r.emoji)}
              title="React"
            >
              {r.emoji}
            </button>
          ))}
          <ReactionPicker messageId={msg._id} onReact={handleReact} />
        </div>
      </motion.div>
    );
  };

  return (
    <>
      {/* Floating Button */}
      <motion.div
        className="messaging-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
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
            ref={messagePanelRef}
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
                  <button
                    className="back-button"
                    onClick={handleBack}
                    title="Back"
                  >
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
                  title="Close"
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
                        <div className="spinner"></div>
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
                            {isUnread && (
                              <div className="unread-indicator"></div>
                            )}
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
                      messages.map(renderMessage)
                    )}
                    {typingUsers.length > 0 && (
                      <TypingIndicator users={typingUsers} />
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="message-input-container">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        handleTyping();
                      }}
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

// TypingIndicator Component
const TypingIndicator = ({ users }) => {
  return (
    <div className="typing-indicator">
      <FiMessageSquare />
      <span>
        {users.map((u) => u.userName).join(", ")}{" "}
        {users.length === 1 ? "is" : "are"} typing...
      </span>
      <div className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
};

// ReactionPicker Component
const ReactionPicker = ({ messageId, onReact }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="reaction-picker-wrapper"
      onBlur={() => setVisible(false)}
      tabIndex={0}
    >
      <button
        className="reaction-picker-button"
        onClick={() => setVisible((v) => !v)}
        title="Add reaction"
      >
        <FiSmile />
      </button>
      {visible && (
        <div className="reaction-picker-popup">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(messageId, emoji);
                setVisible(false);
              }}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
                <FiUsers /> Everyone
              </button>
              <button
                type="button"
                className={`role-chip ${
                  targetRoles.includes("teacher") ? "active" : ""
                }`}
                onClick={() => toggleRole("teacher")}
              >
                <FiUser /> Teachers Only
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
            <FiUser /> Students
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
              <div className="spinner-small"></div> Sending...
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

MessagingCenter.propTypes = {};

TypingIndicator.propTypes = {
  users: PropTypes.arrayOf(
    PropTypes.shape({
      userId: PropTypes.string,
      userName: PropTypes.string,
    })
  ).isRequired,
};

ReactionPicker.propTypes = {
  messageId: PropTypes.string.isRequired,
  onReact: PropTypes.func.isRequired,
};

BroadcastForm.propTypes = {
  onBack: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};

export default MessagingCenter;
