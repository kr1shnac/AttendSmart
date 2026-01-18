/**
 * useAttendanceMutation Hook - Offline-First Attendance Marking
 *
 * Production-grade React Query hook for marking attendance with:
 * - Optimistic UI updates (instant "Marked!" feedback)
 * - Offline detection and local storage
 * - Automatic sync when back online
 * - Retry with exponential backoff
 *
 * Requires TanStack Query v5 with persistence configured in App.jsx
 *
 * @module hooks/useAttendanceMutation
 * @version 1.0.0
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

// ============================================
// CONSTANTS
// ============================================

const OFFLINE_STORAGE_KEY = "attendsmart_offline_queue";
const MAX_RETRY_ATTEMPTS = 3;

// ============================================
// OFFLINE QUEUE HELPERS
// ============================================

/**
 * Generate a unique ID for offline requests
 * Used to deduplicate when syncing
 */
const generateOfflineId = () => {
  return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Save failed request to localStorage for later sync
 * @param {Object} data - Attendance data to save
 */
const saveToOfflineQueue = (data) => {
  try {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_STORAGE_KEY) || "[]");
    queue.push({
      ...data,
      offlineId: data.offlineId || generateOfflineId(),
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    });
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(queue));
    console.log(
      `📥 [Offline] Saved request to queue. Queue size: ${queue.length}`
    );
    return true;
  } catch (error) {
    console.error("❌ [Offline] Failed to save to queue:", error);
    return false;
  }
};

/**
 * Get all pending offline requests
 * @returns {Array} Pending requests
 */
const getOfflineQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

/**
 * Remove a request from offline queue after successful sync
 * @param {string} offlineId - ID of request to remove
 */
const removeFromOfflineQueue = (offlineId) => {
  try {
    const queue = getOfflineQueue().filter(
      (item) => item.offlineId !== offlineId
    );
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(queue));
    console.log(
      `✅ [Offline] Removed ${offlineId} from queue. Remaining: ${queue.length}`
    );
  } catch (error) {
    console.error("❌ [Offline] Failed to remove from queue:", error);
  }
};

/**
 * Clear all offline queue items
 */
const clearOfflineQueue = () => {
  localStorage.removeItem(OFFLINE_STORAGE_KEY);
  console.log("🧹 [Offline] Queue cleared");
};

// ============================================
// API CALL FUNCTION
// ============================================

/**
 * Mark attendance via API (queue-based endpoint)
 * @param {Object} params - Attendance parameters
 * @returns {Promise<Object>} API response
 */
const markAttendanceAPI = async ({
  sessionId,
  gps,
  livenessImage,
  livenessScore,
  deviceId,
  platform,
  offlineId,
  queuedAt,
}) => {
  // Check if offline BEFORE making request
  if (!navigator.onLine) {
    const error = new Error("No internet connection");
    error.code = "OFFLINE";
    error.isOffline = true;
    throw error;
  }

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

  // Make API call to queue-based endpoint
  const response = await api.post("/attendance/mark-queued", {
    sessionId,
    gps,
    livenessImageBase64,
    livenessScore,
    deviceId,
    platform,
    offlineId,
    queuedAt,
  });

  return response.data;
};

// ============================================
// MAIN HOOK
// ============================================

/**
 * useAttendanceMutation - Offline-first attendance marking hook
 *
 * @example
 * const { mutate, isLoading, isOffline } = useAttendanceMutation();
 *
 * // Mark attendance
 * mutate({
 *   sessionId: '123',
 *   gps: { latitude: 12.97, longitude: 77.59, accuracy: 10 },
 *   livenessImage: blob,
 *   livenessScore: 0.95,
 * });
 *
 * @returns {Object} Mutation object with offline-aware state
 */
export const useAttendanceMutation = (options = {}) => {
  const queryClient = useQueryClient();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(getOfflineQueue().length);

  // ============================================
  // ONLINE/OFFLINE DETECTION
  // ============================================

  useEffect(() => {
    const handleOnline = () => {
      console.log("🌐 [Network] Back online - starting sync");
      setIsOffline(false);
      syncOfflineQueue();
    };

    const handleOffline = () => {
      console.log("📴 [Network] Gone offline");
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync if online
    if (navigator.onLine && getOfflineQueue().length > 0) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ============================================
  // OFFLINE QUEUE SYNC
  // ============================================

  const syncOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();

    if (queue.length === 0 || isSyncing) {
      return;
    }

    console.log(`🔄 [Sync] Starting sync of ${queue.length} offline requests`);
    setIsSyncing(true);

    let successCount = 0;
    let failCount = 0;

    for (const item of queue) {
      try {
        // Skip if too many retries
        if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
          console.warn(
            `⚠️ [Sync] Skipping ${item.offlineId} - max retries exceeded`
          );
          continue;
        }

        // Attempt to sync
        await markAttendanceAPI(item);

        // Success - remove from queue
        removeFromOfflineQueue(item.offlineId);
        successCount++;
      } catch (error) {
        console.error(`❌ [Sync] Failed to sync ${item.offlineId}:`, error);
        failCount++;

        // Increment retry count (without removing from queue)
        const updatedQueue = getOfflineQueue().map((q) =>
          q.offlineId === item.offlineId
            ? { ...q, retryCount: (q.retryCount || 0) + 1 }
            : q
        );
        localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(updatedQueue));
      }
    }

    console.log(
      `✅ [Sync] Complete. Success: ${successCount}, Failed: ${failCount}`
    );

    setIsSyncing(false);
    setPendingCount(getOfflineQueue().length);

    // Invalidate attendance queries to refresh UI
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
  }, [isSyncing, queryClient]);

  // ============================================
  // MUTATION
  // ============================================

  const mutation = useMutation({
    mutationKey: ["markAttendance"],

    mutationFn: markAttendanceAPI,

    // Optimistic update - show success immediately
    onMutate: async (variables) => {
      // Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({
        queryKey: ["attendance", "session", variables.sessionId],
      });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData([
        "attendance",
        "session",
        variables.sessionId,
      ]);

      // Optimistically update UI
      queryClient.setQueryData(
        ["attendance", "session", variables.sessionId],
        (old) => ({
          ...old,
          status: "marked",
          markedAt: new Date().toISOString(),
          pending: true,
        })
      );

      console.log('✨ [Optimistic] UI updated - showing "Marked!"');

      return { previousData, variables };
    },

    // On error - handle offline case
    onError: (error, variables, context) => {
      console.error("❌ [Mutation] Failed:", error);

      // Rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(
          ["attendance", "session", variables.sessionId],
          context.previousData
        );
      }

      // If offline, save to local queue
      if (error.isOffline || error.code === "OFFLINE" || !navigator.onLine) {
        saveToOfflineQueue(variables);
        setPendingCount((prev) => prev + 1);

        // Don't throw - we've handled it
        return;
      }

      // For other errors, let error boundary handle
      if (options.onError) {
        options.onError(error);
      }
    },

    // On success
    onSuccess: (data, variables) => {
      console.log("✅ [Mutation] Success:", data);

      // Update cache with real data
      queryClient.setQueryData(["attendance", "session", variables.sessionId], {
        status: "marked",
        markedAt: new Date().toISOString(),
        pending: data.pending || false,
        jobId: data.data?.jobId,
      });

      if (options.onSuccess) {
        options.onSuccess(data);
      }
    },

    // Retry configuration
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (error.isOffline || !navigator.onLine) {
        return false;
      }
      // Retry up to 3 times for network errors
      return failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  // ============================================
  // RETURN ENHANCED MUTATION
  // ============================================

  return {
    ...mutation,

    // Extended state
    isOffline,
    isSyncing,
    pendingCount,

    // Manual sync trigger
    syncOfflineQueue,

    // Clear failed queue
    clearOfflineQueue: () => {
      clearOfflineQueue();
      setPendingCount(0);
    },

    // Network status helpers
    getNetworkStatus: () => ({
      online: !isOffline,
      syncing: isSyncing,
      pendingSync: pendingCount,
    }),
  };
};

export default useAttendanceMutation;
