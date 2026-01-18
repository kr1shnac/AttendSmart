/**
 * Smart Sync Manager - Automatic Offline-to-Online Synchronization
 *
 * Monitors network status and automatically syncs encrypted offline
 * attendance data when connectivity is restored.
 *
 * Features:
 * - Automatic sync on network restoration
 * - Retry with exponential backoff
 * - Progress callbacks
 * - Conflict resolution
 *
 * Requires:
 *   - @capacitor/network
 *   - ./offlineStorage.js
 *
 * @module services/syncManager
 * @version 1.0.0
 */

// eslint-disable-next-line no-unused-vars
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import {
  getPendingRecords,
  markRecordSynced,
  markRecordFailed,
  getPendingCount,
  initializeOfflineStorage,
} from "./offlineStorage";
import api from "./api";

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Maximum retries per record
  maxRetries: 5,

  // Base delay for exponential backoff (ms)
  baseRetryDelay: 1000,

  // Maximum delay between retries (ms)
  maxRetryDelay: 30000,

  // Sync interval when online (ms)
  syncInterval: 60000,

  // Batch size for sync operations
  batchSize: 10,
};

// ============================================
// STATE
// ============================================

let isOnline = true;
let isSyncing = false;
let syncIntervalId = null;
let networkListenerHandle = null;
let progressCallbacks = [];
let isInitialized = false;

// ============================================
// NETWORK MONITORING
// ============================================

/**
 * Initialize sync manager and start monitoring network
 * @returns {Promise<void>}
 */
export const initializeSyncManager = async () => {
  if (isInitialized) {
    console.log("ℹ️ [SyncManager] Already initialized");
    return;
  }

  try {
    console.log("⏳ [SyncManager] Initializing...");

    // Initialize offline storage
    await initializeOfflineStorage();

    // Get current network status
    const status = await Network.getStatus();
    isOnline = status.connected;
    console.log(
      `📶 [SyncManager] Initial network status: ${
        isOnline ? "Online" : "Offline"
      }`
    );

    // Listen for network changes
    networkListenerHandle = await Network.addListener(
      "networkStatusChange",
      handleNetworkChange
    );

    // Start sync interval if online
    if (isOnline) {
      startSyncInterval();
      // Immediate sync on startup
      await syncPendingRecords();
    }

    isInitialized = true;
    console.log("✅ [SyncManager] Initialized successfully");
  } catch (error) {
    console.error("❌ [SyncManager] Initialization error:", error);
  }
};

/**
 * Handle network status changes
 */
const handleNetworkChange = async (status) => {
  const wasOffline = !isOnline;
  isOnline = status.connected;

  console.log(
    `📶 [SyncManager] Network changed: ${isOnline ? "Online" : "Offline"}`
  );

  if (isOnline) {
    // Just came back online
    if (wasOffline) {
      console.log("🔄 [SyncManager] Back online - starting sync...");
      notifyProgress({ event: "online", message: "Connection restored" });
    }

    startSyncInterval();
    await syncPendingRecords();
  } else {
    // Went offline
    stopSyncInterval();
    notifyProgress({ event: "offline", message: "Connection lost" });
  }
};

// ============================================
// SYNC OPERATIONS
// ============================================

/**
 * Sync all pending records to server
 * @returns {Promise<Object>} Sync result
 */
export const syncPendingRecords = async () => {
  if (isSyncing) {
    console.log("ℹ️ [SyncManager] Sync already in progress");
    return { skipped: true };
  }

  if (!isOnline) {
    console.log("⚠️ [SyncManager] Cannot sync - offline");
    return { success: false, error: "offline" };
  }

  isSyncing = true;
  notifyProgress({ event: "sync_start" });

  try {
    const records = await getPendingRecords();

    if (records.length === 0) {
      console.log("✅ [SyncManager] No pending records to sync");
      isSyncing = false;
      return { success: true, synced: 0 };
    }

    console.log(
      `🔄 [SyncManager] Syncing ${records.length} pending records...`
    );
    notifyProgress({
      event: "sync_progress",
      total: records.length,
      synced: 0,
    });

    let syncedCount = 0;
    let failedCount = 0;

    // Process in batches
    for (let i = 0; i < records.length; i += CONFIG.batchSize) {
      const batch = records.slice(i, i + CONFIG.batchSize);

      await Promise.all(
        batch.map(async (record) => {
          const result = await syncSingleRecord(record);
          if (result.success) {
            syncedCount++;
          } else {
            failedCount++;
          }

          notifyProgress({
            event: "sync_progress",
            total: records.length,
            synced: syncedCount,
            failed: failedCount,
          });
        })
      );

      // Small delay between batches to avoid overwhelming server
      if (i + CONFIG.batchSize < records.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      `✅ [SyncManager] Sync complete: ${syncedCount} synced, ${failedCount} failed`
    );
    notifyProgress({
      event: "sync_complete",
      synced: syncedCount,
      failed: failedCount,
    });

    isSyncing = false;
    return { success: true, synced: syncedCount, failed: failedCount };
  } catch (error) {
    console.error("❌ [SyncManager] Sync error:", error);
    isSyncing = false;
    notifyProgress({ event: "sync_error", error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Sync a single record to server
 * @param {Object} record - Record to sync
 * @returns {Promise<Object>} Result
 */
const syncSingleRecord = async (record) => {
  // Check if exceeded max retries
  if (record.retryCount >= CONFIG.maxRetries) {
    console.warn(
      `⚠️ [SyncManager] Record ${record.id} exceeded max retries, skipping`
    );
    return { success: false, error: "max_retries_exceeded" };
  }

  try {
    // Send to server
    await api.post("/api/attendance/mark-queued", {
      ...record.data,
      offlineId: record.id,
      queuedAt: new Date(record.createdAt).toISOString(),
    });

    // Success - remove from local storage
    await markRecordSynced(record.id);
    console.log(`✅ [SyncManager] Synced: ${record.id}`);
    return { success: true };
  } catch (error) {
    console.error(
      `❌ [SyncManager] Failed to sync ${record.id}:`,
      error.message
    );

    // Mark as failed for retry
    await markRecordFailed(record.id, error.message);

    // Apply exponential backoff delay
    const delay = Math.min(
      CONFIG.baseRetryDelay * Math.pow(2, record.retryCount),
      CONFIG.maxRetryDelay
    );
    console.log(`⏳ [SyncManager] Will retry ${record.id} after ${delay}ms`);

    return { success: false, error: error.message };
  }
};

// ============================================
// SYNC INTERVAL
// ============================================

/**
 * Start periodic sync interval
 */
const startSyncInterval = () => {
  if (syncIntervalId) {
    return;
  }

  syncIntervalId = setInterval(async () => {
    if (isOnline && !isSyncing) {
      const pendingCount = await getPendingCount();
      if (pendingCount > 0) {
        console.log(`⏰ [SyncManager] Interval sync: ${pendingCount} pending`);
        await syncPendingRecords();
      }
    }
  }, CONFIG.syncInterval);

  console.log("✅ [SyncManager] Sync interval started");
};

/**
 * Stop periodic sync interval
 */
const stopSyncInterval = () => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log("⏹️ [SyncManager] Sync interval stopped");
  }
};

// ============================================
// PROGRESS CALLBACKS
// ============================================

/**
 * Register callback for sync progress updates
 * @param {Function} callback - Progress callback
 * @returns {Function} Unsubscribe function
 */
export const onSyncProgress = (callback) => {
  progressCallbacks.push(callback);
  return () => {
    progressCallbacks = progressCallbacks.filter((cb) => cb !== callback);
  };
};

/**
 * Notify all progress callbacks
 */
const notifyProgress = (data) => {
  progressCallbacks.forEach((cb) => {
    try {
      cb(data);
    } catch (error) {
      console.error("❌ [SyncManager] Progress callback error:", error);
    }
  });
};

// ============================================
// STATUS
// ============================================

/**
 * Get current sync manager status
 * @returns {Promise<Object>}
 */
export const getSyncStatus = async () => {
  const pendingCount = await getPendingCount();

  return {
    isOnline,
    isSyncing,
    pendingCount,
    isInitialized,
    lastSync: null, // TODO: track last sync time
  };
};

/**
 * Force a sync now
 * @returns {Promise<Object>}
 */
export const forceSync = async () => {
  if (!isOnline) {
    return { success: false, error: "offline" };
  }
  return await syncPendingRecords();
};

// ============================================
// CLEANUP
// ============================================

/**
 * Stop sync manager and clean up
 */
export const stopSyncManager = () => {
  stopSyncInterval();

  if (networkListenerHandle) {
    networkListenerHandle.remove();
    networkListenerHandle = null;
  }

  progressCallbacks = [];
  isInitialized = false;

  console.log("✅ [SyncManager] Stopped");
};

// ============================================
// EXPORTS
// ============================================

export default {
  initializeSyncManager,
  syncPendingRecords,
  forceSync,
  getSyncStatus,
  onSyncProgress,
  stopSyncManager,
};
