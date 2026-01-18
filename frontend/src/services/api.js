import axios from "axios";
import toast from "./toastService";
import { API_BASE_URL, RETRY_CONFIG, CONNECTION_STATUS } from "../config/api";

// ============================================
// CONNECTION STATE TRACKING (Production Pattern)
// ============================================
let connectionState = {
  status: CONNECTION_STATUS.CONNECTED,
  lastCheck: Date.now(),
  consecutiveFailures: 0,
  listeners: new Set(),
};

/**
 * Subscribe to connection state changes
 * @param {Function} listener - Callback function
 * @returns {Function} Unsubscribe function
 */
export const onConnectionChange = (listener) => {
  connectionState.listeners.add(listener);
  // Immediately notify with current state
  listener(connectionState.status);
  return () => connectionState.listeners.delete(listener);
};

/**
 * Update connection status and notify listeners
 * @param {string} status - New connection status
 */
const updateConnectionStatus = (status) => {
  if (connectionState.status !== status) {
    connectionState.status = status;
    connectionState.lastCheck = Date.now();
    connectionState.listeners.forEach((listener) => listener(status));

    if (process.env.NODE_ENV === "development") {
      console.log(`🔌 Connection status: ${status}`);
    }
  }
};

// ✅ PRODUCTION: Request counter for correlation
let requestCounter = 0;

// ✅ ADDED: Axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
  },
});

// Utility to get auth token (used by interceptor)
/* eslint-disable-next-line no-unused-vars */
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ✅ ADDED: Generate request correlation ID
const generateRequestId = () => {
  requestCounter++;
  return `req_${Date.now()}_${requestCounter}`;
};

/**
 * ====================================
 * AXIOS REQUEST INTERCEPTOR
 * ====================================
 */
apiClient.interceptors.request.use(
  (config) => {
    // Add authentication token
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ ADDED: Add request correlation ID
    const requestId = generateRequestId();
    config.headers["X-Request-ID"] = requestId;

    // ✅ ADDED: Log requests in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[${requestId}] ${config.method.toUpperCase()} ${config.url}`
      );
    }

    return config;
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  }
);

/**
 * ====================================
 * AXIOS RESPONSE INTERCEPTOR - PRODUCTION GRADE
 * Features:
 * - Exponential backoff retry
 * - Connection status tracking
 * - Smart error handling
 * - User-friendly error messages
 * ====================================
 */
apiClient.interceptors.response.use(
  (response) => {
    // ✅ PRODUCTION: Mark connection as healthy on success
    connectionState.consecutiveFailures = 0;
    updateConnectionStatus(CONNECTION_STATUS.CONNECTED);

    // Log successful responses in development
    if (process.env.NODE_ENV === "development") {
      const requestId = response.config.headers["X-Request-ID"];
      console.log(
        `[${requestId}] ✅ ${response.status} ${response.config.url}`
      );
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const errorMessage = error.response?.data?.message || error.message;
    const status = error.response?.status;
    const requestId = originalRequest?.headers?.["X-Request-ID"];

    // Log errors in development
    if (process.env.NODE_ENV === "development") {
      console.error(
        `[${requestId}] ❌ ${status || "Network Error"} ${originalRequest?.url}`
      );
    }

    // ============================================
    // PRODUCTION: Handle authentication errors
    // ============================================
    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      if (!window.location.pathname.includes("/login")) {
        toast.error("Session expired. Please login again.");
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // ============================================
    // PRODUCTION: Retry logic with exponential backoff
    // Retries on: Network errors + retriable status codes
    // ============================================
    const isNetworkError = !error.response;
    const isRetriableStatus = RETRY_CONFIG.RETRYABLE_STATUSES.includes(status);
    const shouldRetry =
      (isNetworkError || isRetriableStatus) && !originalRequest._noRetry;

    if (shouldRetry) {
      originalRequest._retryCount = originalRequest._retryCount || 0;

      if (originalRequest._retryCount < RETRY_CONFIG.MAX_RETRIES) {
        originalRequest._retryCount++;

        // Update connection status
        updateConnectionStatus(CONNECTION_STATUS.RECONNECTING);
        connectionState.consecutiveFailures++;

        // Calculate delay with exponential backoff + jitter
        const delay = RETRY_CONFIG.getDelay(originalRequest._retryCount);

        console.log(
          `🔄 Retrying request (${originalRequest._retryCount}/${
            RETRY_CONFIG.MAX_RETRIES
          }) in ${Math.round(delay)}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return apiClient(originalRequest);
      }
    }

    // ============================================
    // PRODUCTION: Track connection failures
    // ============================================
    if (isNetworkError) {
      connectionState.consecutiveFailures++;

      if (connectionState.consecutiveFailures >= 3) {
        updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
      } else {
        updateConnectionStatus(CONNECTION_STATUS.ERROR);
      }
    }

    // ============================================
    // USER-FRIENDLY ERROR MESSAGES
    // ============================================
    if (status === 403) {
      toast.error("You don't have permission to perform this action.");
    } else if (status === 404) {
      // Suppress technical error messages
      const technicalMessages = [
        "user not found",
        "not found or no longer exists",
      ];
      const isTechnical = technicalMessages.some((msg) =>
        errorMessage?.toLowerCase()?.includes(msg)
      );
      if (!isTechnical) {
        toast.error(errorMessage || "The requested data could not be found.");
      }
      console.warn("[API] 404:", errorMessage, originalRequest?.url);
    } else if (status === 400) {
      if (
        error.response?.data?.errors &&
        Array.isArray(error.response.data.errors)
      ) {
        error.response.data.errors.forEach((err) => toast.error(err));
      } else {
        toast.error(
          errorMessage || "Invalid request. Please check your input."
        );
      }
    } else if (status === 429) {
      toast.error("Too many requests. Please wait a moment and try again.");
    } else if (status >= 500) {
      toast.error(
        "Server is experiencing issues. Please try again in a moment."
      );
    } else if (isNetworkError) {
      // Show connection error only once per failure streak
      if (connectionState.consecutiveFailures === 1) {
        toast.error("Connection lost. Attempting to reconnect...");
      }
    } else {
      toast.error(errorMessage || "An error occurred. Please try again.");
    }

    return Promise.reject({
      status: status || 500,
      message: errorMessage || "Request failed",
      data: error.response?.data,
      requestId,
      isNetworkError,
    });
  }
);

/**
 * ====================================
 * AUTHENTICATION API
 * ====================================
 */
export const authAPI = {
  login: async (credentials) => {
    const res = await apiClient.post("/api/auth/login", credentials);
    if (res.data.success || res.data.status === "success") {
      const token = res.data.data?.token || res.data.token;
      const user = res.data.data?.user || res.data.user;

      if (token) localStorage.setItem("token", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));
    }
    return res.data;
  },

  register: async (userData) => {
    const res = await apiClient.post("/api/auth/register", userData);
    return res.data;
  },

  getProfile: async () => {
    const res = await apiClient.get("/api/auth/profile");
    return res.data;
  },

  logout: async () => {
    // ✅ IMPROVED: Clear all local storage and session data
    try {
      // Call logout endpoint if it exists
      await apiClient.post("/api/auth/logout").catch(() => {});
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.clear();
    }
    return { success: true };
  },

  verifyToken: async () => {
    const res = await apiClient.get("/api/auth/verify");
    return res.data;
  },
};

/**
 * ====================================
 * USERS API
 * ====================================
 */
export const usersAPI = {
  getById: async (userId) => {
    const res = await apiClient.get(`/api/users/${userId}`);
    return res.data;
  },

  updateProfile: async (userData) => {
    const res = await apiClient.put("/api/users/profile", userData);
    return res.data;
  },

  changePassword: async (oldPassword, newPassword) => {
    const res = await apiClient.post("/api/users/change-password", {
      oldPassword,
      newPassword,
    });
    return res.data;
  },

  getAll: async (page = 1, limit = 20, role = null) => {
    const params = new URLSearchParams({ page, limit });
    if (role) params.append("role", role);

    const res = await apiClient.get(`/api/users?${params}`);
    return res.data;
  },
};

/**
 * ====================================
 * CLASSES API
 * ====================================
 */
export const classesAPI = {
  getMyClasses: async () => {
    const res = await apiClient.get("/api/classes/my-classes");
    return res.data;
  },

  getById: async (classId) => {
    const res = await apiClient.get(`/api/classes/${classId}`);
    return res.data;
  },

  create: async (classData) => {
    const res = await apiClient.post("/api/classes", classData);
    return res.data;
  },

  update: async (classId, classData) => {
    const res = await apiClient.put(`/api/classes/${classId}`, classData);
    return res.data;
  },

  delete: async (classId) => {
    const res = await apiClient.delete(`/api/classes/${classId}`);
    return res.data;
  },

  addStudent: async (classId, studentId) => {
    const res = await apiClient.post(`/api/classes/${classId}/add-student`, {
      studentId,
    });
    return res.data;
  },

  removeStudent: async (classId, studentId) => {
    const res = await apiClient.post(`/api/classes/${classId}/remove-student`, {
      studentId,
    });
    return res.data;
  },

  getSessions: async (classId) => {
    // Reuse sessions API logic
    const res = await apiClient.get(
      `/api/sessions/my-sessions?classId=${classId}`
    );
    return res.data;
  },

  getStudents: async (classId) => {
    const res = await apiClient.get(`/api/classes/${classId}/students`);
    return res.data;
  },
};

/**
 * ====================================
 * SESSIONS API
 * ====================================
 */
export const sessionsAPI = {
  getMySessions: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.courseCode) params.append("courseCode", filters.courseCode);
    if (filters.classId) params.append("classId", filters.classId);
    if (filters.page) params.append("page", filters.page);
    if (filters.limit) params.append("limit", filters.limit);

    const res = await apiClient.get(`/api/sessions/my-sessions?${params}`);
    return res.data;
  },

  getMyTeacherSessions: async (filters = {}) => {
    // Alias for teacher's sessions with filtering support
    return sessionsAPI.getMySessions(filters);
  },

  getActiveSessions: async () => {
    const res = await apiClient.get("/api/ble/sessions/active");
    return res.data;
  },

  getById: async (sessionId) => {
    const res = await apiClient.get(`/api/sessions/${sessionId}`);
    return res.data;
  },

  createSession: async (sessionData) => {
    const res = await apiClient.post("/api/sessions/create", sessionData);
    return res.data;
  },

  create: async (sessionData) => {
    // Alias for backward compatibility
    return sessionsAPI.createSession(sessionData);
  },

  update: async (sessionId, sessionData) => {
    const res = await apiClient.put(`/api/sessions/${sessionId}`, sessionData);
    return res.data;
  },

  cancelSession: async (sessionId) => {
    const res = await apiClient.post(`/api/sessions/${sessionId}/cancel`, {});
    return res.data;
  },

  start: async (sessionId) => {
    const res = await apiClient.post(`/api/sessions/${sessionId}/start`, {});
    return res.data;
  },

  getLiveCheckIns: async (sessionId) => {
    const res = await apiClient.get(
      `/api/attendance/session/${sessionId}/live`
    );
    return res.data;
  },

  // ========== NEW SESSION PERSISTENCE ENDPOINTS ==========

  // Get teacher's active session
  getActiveSession: async () => {
    const res = await apiClient.get("/api/sessions/active");
    return res.data;
  },

  // Get student's joinable active sessions
  getStudentActiveSessions: async () => {
    const res = await apiClient.get("/api/sessions/student/active");
    return res.data;
  },

  // Send heartbeat to keep session alive
  sendHeartbeat: async (sessionId) => {
    const res = await apiClient.post(
      `/api/sessions/${sessionId}/heartbeat`,
      {}
    );
    return res.data;
  },

  // Force end a session (emergency)
  forceEnd: async (sessionId) => {
    const res = await apiClient.post(
      `/api/sessions/${sessionId}/force-end`,
      {}
    );
    return res.data;
  },

  // End session (uses PUT as per backend route)
  end: async (sessionId) => {
    const res = await apiClient.put(`/api/sessions/${sessionId}/end`, {});
    return res.data;
  },

  // Get sessions for a specific class
  getClassSessions: async (classId) => {
    const res = await apiClient.get(`/api/sessions/class/${classId}`);
    return res.data;
  },
};

/**
 * ====================================
 * ATTENDANCE API
 * ====================================
 */
export const attendanceAPI = {
  getHistory: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.courseCode) params.append("courseCode", filters.courseCode);
    if (filters.classId) params.append("classId", filters.classId);
    if (filters.month) params.append("month", filters.month);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.page) params.append("page", filters.page);
    if (filters.limit) params.append("limit", filters.limit);

    const res = await apiClient.get(`/api/attendance/history?${params}`);
    return res.data;
  },

  getMyAttendance: async (filters = {}) => {
    // Alias for student's attendance with filtering
    return attendanceAPI.getHistory(filters);
  },

  markAttendance: async (sessionId, verificationData) => {
    const res = await apiClient.post("/api/attendance/mark", {
      sessionId,
      ...verificationData,
    });
    return res.data;
  },

  getSessionAttendance: async (sessionId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.page) params.append("page", filters.page);
    if (filters.limit) params.append("limit", filters.limit);
    if (filters.status) params.append("status", filters.status);

    const res = await apiClient.get(
      `/api/attendance/session/${sessionId}?${params}`
    );
    return res.data;
  },

  getStatistics: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await apiClient.get(`/api/attendance/statistics?${params}`);
    return res.data;
  },

  updateStatus: async (attendanceId, status, remarks = "") => {
    // Use resolve-red-flag endpoint which handles teacher approval/rejection
    const action = status === "present" ? "approve" : "deny";
    const res = await apiClient.post("/api/attendance/resolve-red-flag", {
      attendanceId,
      action,
      notes: remarks,
    });
    return res.data;
  },

  // ✅ NEW: Queue-based attendance marking (offline-first)
  markAttendanceQueued: async ({
    sessionId,
    gps,
    livenessImage,
    livenessScore,
    deviceId,
    platform,
    offlineId,
    queuedAt,
  }) => {
    // Convert image to base64 if it's a Blob
    let livenessImageBase64 = null;
    if (livenessImage instanceof Blob) {
      livenessImageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(livenessImage);
      });
    }

    const res = await apiClient.post("/api/attendance/mark-queued", {
      sessionId,
      gps,
      livenessImageBase64,
      livenessScore,
      deviceId,
      platform,
      offlineId,
      queuedAt,
    });
    return res.data;
  },
};

/**
 * ====================================
 * BIOMETRIC API (Face Detection Only)
 * Note: Fingerprint/WebAuthn removed to reduce complexity
 * ====================================
 */
export const biometricAPI = {
  // =============================================
  // FACE ENROLLMENT ENDPOINTS (Descriptor-based)
  // =============================================

  // Check if user needs biometric enrollment
  getEnrollmentStatus: async () => {
    const res = await apiClient.get("/api/biometric/enrollment-status");
    return res.data;
  },

  // Enroll face descriptor (128D embedding array)
  enrollFaceDescriptor: async (data) => {
    const res = await apiClient.post("/api/biometric/enroll-face", {
      descriptor: data.descriptor,
      quality: data.quality,
      deviceInfo: data.deviceInfo || navigator.userAgent,
    });
    return res.data;
  },

  // Verify face descriptor during attendance
  verifyFaceDescriptor: async (descriptor) => {
    const res = await apiClient.post("/api/biometric/verify-face", {
      descriptor,
    });
    return res.data;
  },

  // =============================================
  // LEGACY ENDPOINTS (Image-based - Deprecated)
  // =============================================

  enrollFace: async (faceImageBlob, additionalData = {}) => {
    const formData = new FormData();
    formData.append("faceImage", faceImageBlob);

    if (additionalData.isSmiling !== undefined) {
      formData.append("isSmiling", additionalData.isSmiling);
    }
    if (additionalData.smileConfidence !== undefined) {
      formData.append("smileConfidence", additionalData.smileConfidence);
    }

    const res = await apiClient.post("/api/biometric/face/enroll", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  verifyFace: async (faceImageBlob) => {
    const formData = new FormData();
    formData.append("faceImage", faceImageBlob);

    const res = await apiClient.post("/api/biometric/face/verify", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  // Enroll face image from MediaPipe liveness (FormData with faceImage)
  enrollFaceImage: async (formData) => {
    const res = await apiClient.post("/api/biometric/face/enroll", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  // =============================================
  // DATA MANAGEMENT
  // =============================================

  getBiometricData: async () => {
    const res = await apiClient.get("/api/biometric/data");
    return res.data;
  },

  deleteBiometricData: async () => {
    const res = await apiClient.delete("/api/biometric/data");
    return res.data;
  },

  getStatistics: async () => {
    const res = await apiClient.get("/api/biometric/statistics");
    return res.data;
  },
};

/**
 * ====================================
 * BLE API
 * ====================================
 */
export const bleAPI = {
  scanForBeacons: async () => {
    const res = await apiClient.get("/api/ble/scan");
    return res.data;
  },

  recordProximity: async (beaconData) => {
    const res = await apiClient.post("/api/ble/scan/record", beaconData);
    return res.data;
  },

  verifyProximity: async (sessionId) => {
    const res = await apiClient.get(`/api/ble/verify?sessionId=${sessionId}`);
    return res.data;
  },

  getDevices: async () => {
    const res = await apiClient.get("/api/ble/devices");
    return res.data;
  },

  registerDevice: async (deviceData) => {
    const res = await apiClient.post("/api/ble/devices", deviceData);
    return res.data;
  },

  updateDevice: async (deviceId, deviceData) => {
    const res = await apiClient.put(`/api/ble/devices/${deviceId}`, deviceData);
    return res.data;
  },

  deleteDevice: async (deviceId) => {
    const res = await apiClient.delete(`/api/ble/devices/${deviceId}`);
    return res.data;
  },
};

/**
 * ====================================
 * DASHBOARD & ANALYTICS API
 * ====================================
 */
export const dashboardAPI = {
  getTeacherDashboard: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await apiClient.get(`/api/dashboard/teacher?${params}`);
    return res.data;
  },

  getStudentDashboard: async () => {
    const res = await apiClient.get("/api/dashboard/student");
    return res.data;
  },

  getAnalytics: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await apiClient.get(`/api/dashboard/stats?${params}`);
    return res.data;
  },

  getClassAnalytics: async (classId, filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await apiClient.get(
      `/api/dashboard/class/${classId}/analytics?${params}`
    );
    return res.data;
  },
};

/**
 * ====================================
 * LOGS API
 * ====================================
 */
export const logsAPI = {
  getAll: async (page = 1, limit = 50, filters = {}) => {
    const params = new URLSearchParams({ page, limit, ...filters });
    const res = await apiClient.get(`/api/logs?${params}`);
    return res.data;
  },

  getByType: async (logType, page = 1, limit = 50) => {
    const params = new URLSearchParams({ logType, page, limit });
    const res = await apiClient.get(`/api/logs/type?${params}`);
    return res.data;
  },

  getMyLogs: async (page = 1, limit = 50) => {
    const params = new URLSearchParams({ page, limit });
    const res = await apiClient.get(`/api/logs/my-logs?${params}`);
    return res.data;
  },
};

/**
 * ====================================
 * HEALTH CHECK API - PRODUCTION GRADE
 * Used for connection monitoring and status indicators
 * ====================================
 */
export const healthAPI = {
  /**
   * Full health check - includes database status
   */
  check: async () => {
    const res = await apiClient.get("/api/health", {
      _noRetry: true, // Don't retry health checks
    });
    return res.data;
  },

  /**
   * Quick ping with configurable timeout
   * Returns connection status for UI indicators
   */
  quickPing: async (timeoutMs = 5000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const startTime = Date.now();
      const res = await apiClient.get("/api/health", {
        signal: controller.signal,
        timeout: timeoutMs,
        _noRetry: true,
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      return {
        online: true,
        database: res.data?.database?.connected ?? false,
        latency,
        status: res.data?.status || "unknown",
      };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        online: false,
        database: false,
        latency: null,
        error: error.message,
      };
    }
  },

  /**
   * Get current connection state (local, no network call)
   */
  getConnectionState: () => ({
    status: connectionState.status,
    consecutiveFailures: connectionState.consecutiveFailures,
    lastCheck: connectionState.lastCheck,
  }),
};

// ✅ ADDED: Export axios instance for custom requests
export { apiClient };

// ✅ ADDED: Export base URL for websocket connection
export { API_BASE_URL };

// ✅ ADDED: Alias for backward compatibility
export const sessionAPI = sessionsAPI;

/**
 * ====================================
 * ADMIN API
 * ====================================
 */
export const adminAPI = {
  // Dashboard Stats
  getDashboardStats: async () => {
    const res = await apiClient.get("/api/admin/stats");
    return res.data;
  },

  // ============ STUDENTS ============
  getAllStudents: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.search) queryParams.append("search", params.search);
    if (params.branch) queryParams.append("branch", params.branch);
    if (params.semester) queryParams.append("semester", params.semester);
    if (params.section) queryParams.append("section", params.section);

    const res = await apiClient.get(`/api/admin/students?${queryParams}`);
    return res.data;
  },

  createStudent: async (studentData) => {
    const res = await apiClient.post("/api/admin/students", studentData);
    return res.data;
  },

  updateStudent: async (id, studentData) => {
    const res = await apiClient.put(`/api/admin/students/${id}`, studentData);
    return res.data;
  },

  deleteStudent: async (id) => {
    const res = await apiClient.delete(`/api/admin/students/${id}`);
    return res.data;
  },

  // ============ TEACHERS ============
  getAllTeachers: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.includeInactive) queryParams.append("includeInactive", "true");

    const res = await apiClient.get(`/api/admin/teachers?${queryParams}`);
    return res.data;
  },

  createTeacher: async (teacherData) => {
    const res = await apiClient.post("/api/admin/teachers", teacherData);
    return res.data;
  },

  updateTeacher: async (id, teacherData) => {
    const res = await apiClient.put(
      `/api/admin/teachers/${id}/credentials`,
      teacherData
    );
    return res.data;
  },

  deleteTeacher: async (id) => {
    const res = await apiClient.delete(`/api/admin/teachers/${id}`);
    return res.data;
  },

  // ============ CLASSES ============
  getAllClasses: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.semester) queryParams.append("semester", params.semester);
    if (params.teacherId) queryParams.append("teacherId", params.teacherId);

    const res = await apiClient.get(`/api/admin/classes?${queryParams}`);
    return res.data;
  },

  getClassById: async (id) => {
    const res = await apiClient.get(`/api/admin/classes/${id}`);
    return res.data;
  },

  createClass: async (classData) => {
    const res = await apiClient.post("/api/admin/classes", classData);
    return res.data;
  },

  updateClass: async (id, classData) => {
    const res = await apiClient.put(`/api/admin/classes/${id}`, classData);
    return res.data;
  },

  deleteClass: async (id) => {
    const res = await apiClient.delete(`/api/admin/classes/${id}`);
    return res.data;
  },

  // Class Assignment
  assignClassTeacher: async (classId, teacherId) => {
    const res = await apiClient.put(
      `/api/admin/classes/${classId}/class-teacher`,
      {
        teacherId,
      }
    );
    return res.data;
  },

  assignSubjectTeacher: async (classId, teacherId, subjectId) => {
    const res = await apiClient.post(
      `/api/admin/classes/${classId}/subject-teachers`,
      {
        teacherId,
        subjectId,
      }
    );
    return res.data;
  },

  removeSubjectTeacher: async (classId, teacherId, subjectId = null) => {
    const res = await apiClient.delete(
      `/api/admin/classes/${classId}/subject-teachers/${teacherId}`,
      { data: { subjectId } }
    );
    return res.data;
  },

  // Class Student Management
  addStudentsToClass: async (classId, studentIds) => {
    const res = await apiClient.post(`/api/admin/classes/${classId}/students`, {
      studentIds,
    });
    return res.data;
  },

  removeStudentFromClass: async (classId, studentId) => {
    const res = await apiClient.delete(
      `/api/admin/classes/${classId}/students/${studentId}`
    );
    return res.data;
  },

  // ============ SUBJECTS ============
  getAllSubjects: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await apiClient.get(`/api/admin/subjects?${query}`);
    return res.data;
  },

  createSubject: async (subjectData) => {
    const res = await apiClient.post("/api/admin/subjects", subjectData);
    return res.data;
  },

  updateSubject: async (id, subjectData) => {
    const res = await apiClient.put(`/api/admin/subjects/${id}`, subjectData);
    return res.data;
  },

  deleteSubject: async (id) => {
    const res = await apiClient.delete(`/api/admin/subjects/${id}`);
    return res.data;
  },

  // User Status
  setUserActiveStatus: async (userId, isActive) => {
    const res = await apiClient.patch(`/api/admin/users/${userId}/active`, {
      isActive,
    });
    return res.data;
  },

  changeUserRole: async (userId, role) => {
    const res = await apiClient.patch(`/api/admin/users/${userId}/role`, {
      role,
    });
    return res.data;
  },
};

export default {
  authAPI,
  usersAPI,
  classesAPI,
  sessionsAPI,
  attendanceAPI,
  biometricAPI,
  bleAPI,
  dashboardAPI,
  logsAPI,
  healthAPI,
  sessionAPI,
  adminAPI,
};

// ============================================
// MESSAGING API (Add to existing api.js)
// ============================================

export const messagesAPI = {
  // Get all conversations for current user
  getConversations: async () => {
    const res = await apiClient.get("/api/messages/conversations");
    return res.data;
  },

  // Get messages in a conversation
  getConversationMessages: async (conversationId, params = {}) => {
    const res = await apiClient.get(
      `/api/messages/conversations/${conversationId}/messages`,
      { params }
    );
    return res.data;
  },

  // Start new conversation
  startConversation: async (data) => {
    const res = await apiClient.post("/api/messages/conversations", data);
    return res.data;
  },

  // Send message in conversation
  sendMessage: async (data) => {
    const res = await apiClient.post("/api/messages/send", data);
    return res.data;
  },

  // Send broadcast message (admin/teacher)
  sendBroadcast: async (data) => {
    const res = await apiClient.post("/api/messages/broadcast", data);
    return res.data;
  },

  // Get available contacts
  getContacts: async () => {
    const res = await apiClient.get("/api/messages/contacts");
    return res.data;
  },

  // Get unread count
  getUnreadCount: async () => {
    const res = await apiClient.get("/api/messages/unread-count");
    return res.data;
  },

  // Mark message as read
  markAsRead: async (messageId) => {
    const res = await apiClient.patch(`/api/messages/${messageId}/read`);
    return res.data;
  },

  // Delete message
  deleteMessage: async (messageId) => {
    const res = await apiClient.delete(`/api/messages/${messageId}`);
    return res.data;
  },
};

// ============================================
// USER DATA & CONSENT API (GDPR Compliance)
// ============================================

export const userAPI = {
  // Get all active consents for current user
  getConsents: async () => {
    const res = await apiClient.get("/api/users/me/consents");
    return res.data;
  },

  // Record new consent
  recordConsent: async (data) => {
    const res = await apiClient.post("/api/users/me/consents", {
      consentType: data.consentType,
      appVersion: data.appVersion,
      platform: data.platform,
      consentTextVersion: data.consentTextVersion || "1.0",
    });
    return res.data;
  },

  // Revoke specific consent type
  revokeConsent: async (consentType, reason) => {
    const res = await apiClient.delete(
      `/api/users/me/consents/${consentType}`,
      {
        data: { reason },
      }
    );
    return res.data;
  },

  // Export all user data (GDPR DSAR)
  exportData: async () => {
    const res = await apiClient.get("/api/users/me/data");
    return res.data;
  },

  // Delete account and all data
  deleteAccount: async () => {
    const res = await apiClient.delete("/api/users/me", {
      data: { confirmDelete: "DELETE_MY_ACCOUNT" },
    });
    return res.data;
  },

  // Check if user has required consents for enrollment
  hasEnrollmentConsent: async () => {
    try {
      const res = await apiClient.get("/api/users/me/consents");
      if (res.data.success && res.data.data?.consents) {
        const requiredTypes = [
          "biometric_enrollment",
          "face_capture",
          "data_processing",
        ];
        const activeTypes = res.data.data.consents
          .filter((c) => c.active)
          .map((c) => c.consentType);
        return requiredTypes.every((type) => activeTypes.includes(type));
      }
      return false;
    } catch (err) {
      return false;
    }
  },
};
