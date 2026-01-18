import io from "socket.io-client";

// Utility for reading JWT token and user
const getAuthToken = () => localStorage.getItem("token");

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.activeRooms = new Set();
  }

  // Initialize socket connection with authentication
  connect() {
    if (this.socket && this.isConnected) {
      console.log("Socket already connected");
      return;
    }

    // Get token before connecting
    const token = getAuthToken();
    const socketURL =
      process.env.REACT_APP_SOCKET_URL || "http://localhost:5001";

    this.socket = io(socketURL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      auth: { token }, // ✅ JWT authentication
    });

    // Re-authenticate on reconnect
    this.socket.on("reconnect_attempt", () => {
      const currentToken = getAuthToken();
      this.socket.auth = { token: currentToken };
      console.log("🔄 Re-authenticating socket...");
    });

    // Connected
    this.socket.on("connect", () => {
      console.log("✅ Socket connected:", this.socket.id);
      this.isConnected = true;
      // Emit rooms user should join, if any
      this.activeRooms.forEach((room) => {
        this.socket.emit("join-session", room);
      });
    });

    // Disconnected
    this.socket.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
      this.isConnected = false;
      // Optionally, clear active rooms list
      // this.activeRooms.clear();
    });

    // Connection error
    this.socket.on("connect_error", (error) => {
      if (error?.message?.toLowerCase().includes("auth")) {
        console.error("❌ Socket authentication error:", error.message);
        // Possibly show alert, or force logout
      } else {
        console.error("❌ Socket connection error:", error);
      }
      this.isConnected = false;
    });

    // Reconnected
    this.socket.on("reconnect", (attemptNumber) => {
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      this.isConnected = true;
      // Re-join all active rooms after reconnect
      this.activeRooms.forEach((room) => {
        this.socket.emit("join-session", room);
      });
    });
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.activeRooms.clear();
      console.log("🔌 Socket disconnected manually");
    }
  }

  // Subscribe to an event
  on(event, callback) {
    if (!this.socket) {
      console.error("Socket not initialized. Call connect() first.");
      return;
    }
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    this.socket.on(event, callback);
  }

  // Unsubscribe from an event
  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Emit an event (with auth check)
  emit(event, data) {
    if (!this.socket || !this.isConnected) {
      console.error("Socket not connected. Cannot emit event:", event);
      return;
    }
    this.socket.emit(event, data);
  }

  // Subscribe once to an event
  once(event, callback) {
    if (!this.socket) {
      console.error("Socket not initialized. Call connect() first.");
      return;
    }
    this.socket.once(event, callback);
  }

  // Join room/session for real-time updates
  joinSession(sessionId) {
    if (!this.socket) {
      console.error("Socket not initialized. Call connect() first.");
      return;
    }
    this.activeRooms.add(sessionId);
    this.socket.emit("join-session", sessionId);
    console.log(`➡️ Joined session room: ${sessionId}`);
  }

  // Leave room/session
  leaveSession(sessionId) {
    if (!this.socket) return;
    this.activeRooms.delete(sessionId);
    this.socket.emit("leave-session", sessionId);
    console.log(`⬅️ Left session room: ${sessionId}`);
  }

  // Get connection status
  getConnectionStatus() {
    return this.isConnected;
  }

  // Get socket ID
  getSocketId() {
    return this.socket?.id || null;
  }

  // Additional emitters for your messaging features

  notifyTypingStart(conversationId, userId, userName) {
    this.emit("typing-start", { conversationId, userId, userName });
  }

  notifyTypingStop(conversationId, userId) {
    this.emit("typing-stop", { conversationId, userId });
  }

  reactToMessage(messageId, emoji, userId) {
    this.emit("message-reacted", { messageId, emoji, userId });
  }

  sendUrgentNotification(conversationId, message, participants) {
    this.emit("urgent-message-sent", { conversationId, message, participants });
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;

// Event types for reference
export const SocketEvents = {
  // Log events
  NEW_LOG: "new-log",
  LOG_UPDATED: "log-updated",

  // Biometric events
  BIOMETRIC_UPDATE: "biometric-update",
  FACE_ENROLLED: "face-enrollment", // corrected to align with backend event
  FACE_VERIFIED: "face-verification",

  // BLE events
  BLE_DEVICE_CONNECTED: "ble-device-connected",
  BLE_DEVICE_DISCONNECTED: "ble-device-disconnected",

  // Dashboard events
  STATS_UPDATE: "stats-update",

  // System events
  USER_JOINED: "user-joined",
  USER_LEFT: "user-left",
  NOTIFICATION: "notification",

  // Attendance
  ATTENDANCE_UPDATE: "attendance-update",

  // ========== SESSION LIFECYCLE EVENTS ==========
  SESSION_STARTED: "session-started",
  SESSION_ENDED: "session-ended",
  SESSION_SCHEDULED: "session-scheduled",

  // Participant tracking
  PARTICIPANT_JOINED: "participant-joined",
  PARTICIPANT_LEFT: "participant-left",

  // Student check-in
  STUDENT_CHECKIN: "student-checkin",
  VERIFICATION_UPDATE: "verification-update",
  ATTENDANCE_MARKED: "attendance-marked",
};
