/**
 * Session State Manager
 * Manages active session state across page loads, tabs, and refreshes
 * Provides central source of truth for session status
 */

import { sessionsAPI } from "./api";
import socketService from "./socketService";

// Storage keys
const ACTIVE_SESSION_KEY = "activeSession";
const SESSION_ROLE_KEY = "sessionRole";

class SessionStateManager {
  constructor() {
    this.listeners = new Set();
    this.currentSession = null;
    this.heartbeatInterval = null;
    this.initialized = false;
  }

  /**
   * Initialize session state manager
   * Should be called once on app startup
   */
  async initialize() {
    if (this.initialized) return;

    // Check for stored session
    const storedSession = this.getStoredSession();

    if (storedSession) {
      // Verify session is still active on server
      try {
        const serverSession = await this.fetchActiveSession();

        if (serverSession && serverSession._id === storedSession.id) {
          this.setActiveSession(serverSession);
        } else {
          // Session ended or different, clear local storage
          this.clearActiveSession();
        }
      } catch (error) {
        console.error("Error verifying session:", error);
        // Keep stored session in case of network error
        this.currentSession = storedSession;
        this.notifyListeners();
      }
    }

    this.initialized = true;
  }

  /**
   * Fetch active session from server based on user role
   */
  async fetchActiveSession() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    try {
      if (user.role === "teacher") {
        const response = await sessionsAPI.getActiveSession();
        // The API returns { status: 'success', data: { session: ... } } or { ... session: null }
        return response.data?.session || null;
      } else if (user.role === "student") {
        // For students, check if they have an active session to join
        const response = await sessionsAPI.getStudentActiveSessions();
        const sessions = response.data?.sessions || [];
        // If student is already "connected" (present), we should prioritize that?
        // For now, return the first active session found
        return sessions.length > 0 ? sessions[0] : null;
      }
    } catch (error) {
      console.error("Error fetching active session:", error);
    }

    return null;
  }

  /**
   * Set active session and persist to storage
   */
  setActiveSession(session) {
    if (!session) {
      this.clearActiveSession();
      return;
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const sessionData = {
      id: session._id,
      topic: session.topic,
      classId: session.class?._id || session.class,
      className: session.class?.className || session.class?.subject,
      subject: session.class?.subject,
      courseCode: session.class?.courseCode,
      teacherName: session.teacher?.name,
      status: session.status,
      startTime: session.startTime,
      duration: session.duration,
      expectedStudents: session.expectedStudents,
      presentCount: session.presentCount || 0,
    };

    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem(SESSION_ROLE_KEY, user.role);

    this.currentSession = sessionData;

    // Join socket room
    socketService.joinSession(session._id);

    // Start heartbeat
    this.startHeartbeat(session._id);

    this.notifyListeners();
  }

  /**
   * Clear active session
   */
  clearActiveSession() {
    const storedSession = this.getStoredSession();

    if (storedSession) {
      socketService.leaveSession(storedSession.id);
    }

    this.stopHeartbeat();

    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(SESSION_ROLE_KEY);

    this.currentSession = null;
    this.notifyListeners();
  }

  /**
   * Get stored session from localStorage
   */
  getStoredSession() {
    try {
      const stored = localStorage.getItem(ACTIVE_SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("Error parsing stored session:", error);
      return null;
    }
  }

  /**
   * Get current active session
   */
  getActiveSession() {
    return this.currentSession || this.getStoredSession();
  }

  /**
   * Get user's role in the session
   */
  getSessionRole() {
    return localStorage.getItem(SESSION_ROLE_KEY) || null;
  }

  /**
   * Check if user has an active session
   */
  hasActiveSession() {
    return !!this.getActiveSession();
  }

  /**
   * Update session stats (e.g., present count)
   */
  updateSessionStats(stats) {
    const session = this.getActiveSession();
    if (!session) return;

    const updatedSession = {
      ...session,
      ...stats,
    };

    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(updatedSession));
    this.currentSession = updatedSession;
    this.notifyListeners();
  }

  /**
   * Start heartbeat to keep session alive
   */
  startHeartbeat(sessionId) {
    this.stopHeartbeat();

    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      socketService.emit("heartbeat", { sessionId });
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Subscribe to session state changes
   */
  subscribe(callback) {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    const session = this.getActiveSession();
    const role = this.getSessionRole();

    this.listeners.forEach((callback) => {
      try {
        callback({ session, role });
      } catch (error) {
        console.error("Error in session state listener:", error);
      }
    });
  }

  /**
   * Handle session end event
   */
  handleSessionEnded(data) {
    const currentSession = this.getActiveSession();

    if (currentSession && currentSession.id === data.sessionId) {
      this.clearActiveSession();
    }
  }

  /**
   * Check if user can logout (teacher must end session first)
   */
  canLogout() {
    const role = this.getSessionRole();
    const session = this.getActiveSession();

    // Teachers cannot logout with active session
    if (role === "teacher" && session) {
      return {
        allowed: false,
        message: "You must end the live session before logging out.",
        sessionId: session.id,
      };
    }

    return { allowed: true };
  }
}

// Create singleton instance
const sessionStateManager = new SessionStateManager();

export default sessionStateManager;
