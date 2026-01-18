/**
 * Toast Notification Service
 * Centralized notification system for all errors, success, warnings, and info messages
 * Provides both programmatic API and context for React components
 * INCLUDES: Deduplication to prevent duplicate messages
 */

class ToastNotification {
  constructor() {
    this.listeners = [];
    this.queue = [];
    this.recentMessages = new Map(); // Track recent messages for deduplication
    this.DEDUPE_WINDOW_MS = 500; // Ignore duplicate messages within 500ms
  }

  /**
   * Subscribe to toast events
   * @param {Function} listener - Callback when toast is triggered
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Check if this message was recently shown (deduplication)
   * @param {string} type - Toast type
   * @param {string} message - Toast message
   * @returns {boolean} True if this is a duplicate
   */
  isDuplicate(type, message) {
    const key = `${type}:${message}`;
    const now = Date.now();
    const lastShown = this.recentMessages.get(key);

    if (lastShown && now - lastShown < this.DEDUPE_WINDOW_MS) {
      return true; // Duplicate within window
    }

    // Clean up old entries (keep only last 20)
    if (this.recentMessages.size > 20) {
      const oldestKey = this.recentMessages.keys().next().value;
      this.recentMessages.delete(oldestKey);
    }

    this.recentMessages.set(key, now);
    return false;
  }

  /**
   * Emit toast notification to all listeners
   * @param {Object} notification - Toast object {type, message, duration}
   */
  emit(notification) {
    this.listeners.forEach((listener) => listener(notification));
  }

  /**
   * Show error toast (red)
   * @param {string} message - Error message to display
   * @param {number} duration - Duration in ms (default 5000)
   */
  error(message, duration = 5000) {
    if (this.isDuplicate("error", message)) return; // Skip duplicate
    this.emit({
      type: "error",
      message,
      duration,
      timestamp: Date.now(),
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });
  }

  /**
   * Show success toast (green)
   * @param {string} message - Success message to display
   * @param {number} duration - Duration in ms (default 3000)
   */
  success(message, duration = 3000) {
    if (this.isDuplicate("success", message)) return;
    this.emit({
      type: "success",
      message,
      duration,
      timestamp: Date.now(),
      id: `success-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });
  }

  /**
   * Show warning toast (orange)
   * @param {string} message - Warning message to display
   * @param {number} duration - Duration in ms (default 4000)
   */
  warning(message, duration = 4000) {
    if (this.isDuplicate("warning", message)) return;
    this.emit({
      type: "warning",
      message,
      duration,
      timestamp: Date.now(),
      id: `warning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });
  }

  /**
   * Show info toast (blue)
   * @param {string} message - Info message to display
   * @param {number} duration - Duration in ms (default 3000)
   */
  info(message, duration = 3000) {
    if (this.isDuplicate("info", message)) return;
    this.emit({
      type: "info",
      message,
      duration,
      timestamp: Date.now(),
      id: `info-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });
  }

  /**
   * Show loading toast (no auto-close)
   * @param {string} message - Loading message
   * @returns {string} Toast ID for manual dismissal
   */
  loading(message) {
    const id = `loading-${Date.now()}`;
    this.emit({
      type: "loading",
      message,
      duration: 0, // No auto-close
      timestamp: Date.now(),
      id,
    });
    return id;
  }

  /**
   * Dismiss specific toast by ID
   * @param {string} toastId - ID of toast to dismiss
   */
  dismiss(toastId) {
    this.emit({
      type: "dismiss",
      id: toastId,
    });
  }

  /**
   * Clear all toasts
   */
  clearAll() {
    this.emit({
      type: "clearAll",
    });
  }
}

// Singleton instance
const toast = new ToastNotification();

export default toast;
