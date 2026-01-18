/**
 * Offline Queue Service
 *
 * Encrypts and stores pending verifications when offline.
 * Syncs to server when connectivity is restored.
 *
 * Uses device-unique encryption key + AES to protect offline data.
 */

import { Preferences } from "@capacitor/preferences";
import { Network } from "@capacitor/network";
import CryptoJS from "crypto-js";

const QUEUE_KEY = "encrypted_verification_queue";
const DEVICE_SECRET_KEY = "device_secret";
const SYNC_RETRY_DELAY = 5000; // 5 seconds
const MAX_QUEUE_SIZE = 50; // Prevent unbounded growth

// In-memory cache of decrypted queue
let queueCache = null;
let syncInProgress = false;
let networkListener = null;

/**
 * Generate or retrieve device-unique secret
 * This key is unique per device installation
 */
async function getDeviceSecret() {
  try {
    const { value } = await Preferences.get({ key: DEVICE_SECRET_KEY });

    if (value) {
      return value;
    }

    // Generate new device secret
    const newSecret = CryptoJS.lib.WordArray.random(32).toString();
    await Preferences.set({ key: DEVICE_SECRET_KEY, value: newSecret });

    return newSecret;
  } catch (error) {
    console.error("[OfflineQueue] Failed to get device secret:", error);
    // Fallback to ephemeral key (data lost on restart)
    return "ephemeral-" + Date.now();
  }
}

/**
 * Encrypt data using device secret
 */
function encrypt(data, secret) {
  try {
    const jsonStr = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonStr, secret).toString();
  } catch (error) {
    console.error("[OfflineQueue] Encryption failed:", error);
    throw new Error("Failed to encrypt offline data");
  }
}

/**
 * Decrypt data using device secret
 */
function decrypt(encryptedData, secret) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, secret);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      throw new Error("Decryption produced empty result");
    }

    return JSON.parse(decrypted);
  } catch (error) {
    console.error("[OfflineQueue] Decryption failed:", error);
    return [];
  }
}

/**
 * Get the current queue (decrypted)
 */
async function getQueue() {
  try {
    if (queueCache !== null) {
      return queueCache;
    }

    const { value } = await Preferences.get({ key: QUEUE_KEY });

    if (!value) {
      queueCache = [];
      return [];
    }

    const secret = await getDeviceSecret();
    queueCache = decrypt(value, secret);

    return queueCache;
  } catch (error) {
    console.error("[OfflineQueue] Failed to get queue:", error);
    queueCache = [];
    return [];
  }
}

/**
 * Save the queue (encrypted)
 */
async function saveQueue(queue) {
  try {
    const secret = await getDeviceSecret();
    const encrypted = encrypt(queue, secret);

    await Preferences.set({ key: QUEUE_KEY, value: encrypted });
    queueCache = queue;

    return true;
  } catch (error) {
    console.error("[OfflineQueue] Failed to save queue:", error);
    return false;
  }
}

/**
 * Add verification to offline queue
 */
export async function enqueue(verification) {
  try {
    const queue = await getQueue();

    // Prevent queue from growing too large
    if (queue.length >= MAX_QUEUE_SIZE) {
      console.warn("[OfflineQueue] Queue full, removing oldest item");
      queue.shift();
    }

    const queueItem = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      verification,
      timestamp: Date.now(),
      attempts: 0,
      lastAttempt: null,
    };

    queue.push(queueItem);
    await saveQueue(queue);

    console.log(`[OfflineQueue] Enqueued verification: ${queueItem.id}`);

    return queueItem.id;
  } catch (error) {
    console.error("[OfflineQueue] Enqueue failed:", error);
    throw error;
  }
}

/**
 * Remove item from queue after successful sync
 */
async function removeFromQueue(itemId) {
  try {
    const queue = await getQueue();
    const updatedQueue = queue.filter((item) => item.id !== itemId);

    await saveQueue(updatedQueue);
    console.log(`[OfflineQueue] Removed: ${itemId}`);
  } catch (error) {
    console.error("[OfflineQueue] Remove failed:", error);
  }
}

/**
 * Update item retry count
 */
async function updateItemAttempt(itemId) {
  try {
    const queue = await getQueue();
    const item = queue.find((i) => i.id === itemId);

    if (item) {
      item.attempts++;
      item.lastAttempt = Date.now();
      await saveQueue(queue);
    }
  } catch (error) {
    console.error("[OfflineQueue] Update attempt failed:", error);
  }
}

/**
 * Sync all pending verifications to server
 */
export async function sync(apiClient) {
  if (syncInProgress) {
    console.log("[OfflineQueue] Sync already in progress");
    return { synced: 0, failed: 0 };
  }

  syncInProgress = true;
  let synced = 0;
  let failed = 0;

  try {
    const queue = await getQueue();

    if (queue.length === 0) {
      console.log("[OfflineQueue] No items to sync");
      return { synced: 0, failed: 0 };
    }

    console.log(`[OfflineQueue] Syncing ${queue.length} items...`);

    for (const item of queue) {
      // Skip items that have failed too many times
      if (item.attempts >= 5) {
        console.warn(`[OfflineQueue] Item ${item.id} exceeded max attempts`);
        failed++;
        continue;
      }

      try {
        await apiClient.post("/api/attendance/verify-unified", {
          ...item.verification,
          offlineId: item.id,
          queuedAt: item.timestamp,
        });

        await removeFromQueue(item.id);
        synced++;
      } catch (error) {
        console.error(`[OfflineQueue] Failed to sync ${item.id}:`, error);
        await updateItemAttempt(item.id);
        failed++;

        // If server error (not network), mark for later
        if (
          error.response &&
          error.response.status >= 400 &&
          error.response.status < 500
        ) {
          console.warn(`[OfflineQueue] Permanent failure for ${item.id}`);
        }
      }
    }

    console.log(
      `[OfflineQueue] Sync complete: ${synced} synced, ${failed} failed`
    );
    return { synced, failed };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Get queue status
 */
export async function getStatus() {
  const queue = await getQueue();

  return {
    count: queue.length,
    oldest: queue.length > 0 ? queue[0].timestamp : null,
    totalAttempts: queue.reduce((sum, item) => sum + item.attempts, 0),
    isSyncing: syncInProgress,
  };
}

/**
 * Clear all queued items (use with caution)
 */
export async function clearQueue() {
  await saveQueue([]);
  queueCache = [];
  console.log("[OfflineQueue] Queue cleared");
}

/**
 * Initialize network listener for auto-sync
 */
export async function initNetworkSync(apiClient) {
  if (networkListener) {
    return; // Already initialized
  }

  try {
    // Initial check
    const status = await Network.getStatus();
    if (status.connected) {
      sync(apiClient);
    }

    // Listen for connectivity changes
    networkListener = Network.addListener(
      "networkStatusChange",
      async (status) => {
        console.log(
          `[OfflineQueue] Network status: ${
            status.connected ? "online" : "offline"
          }`
        );

        if (status.connected) {
          // Small delay to let connection stabilize
          setTimeout(() => sync(apiClient), SYNC_RETRY_DELAY);
        }
      }
    );

    console.log("[OfflineQueue] Network sync initialized");
  } catch (error) {
    console.error("[OfflineQueue] Failed to init network sync:", error);
  }
}

/**
 * Cleanup listeners
 */
export function cleanup() {
  if (networkListener) {
    networkListener.remove();
    networkListener = null;
  }
}

export default {
  enqueue,
  sync,
  getStatus,
  clearQueue,
  initNetworkSync,
  cleanup,
};
