/**
 * Encrypted Offline Storage - SQLite with AES-256
 *
 * Provides encrypted local storage for offline attendance data.
 * All data is encrypted before writing to SQLite using hardware-backed keys.
 *
 * Requires:
 *   - @capacitor-community/sqlite
 *   - ./keyStore.js for encryption keys
 *
 * @module services/offlineStorage
 * @version 1.0.0
 */

import { Capacitor } from "@capacitor/core";
// NOTE: CapacitorSQLite is only available for native builds
// For web builds, the code falls back to IndexedDB/localStorage
// import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
// eslint-disable-next-line no-unused-vars
let CapacitorSQLite = null;
// eslint-disable-next-line no-unused-vars
let SQLiteConnection = null;
import { getEncryptionKey, initializeKeyStore } from "./keyStore";

// ============================================
// CONFIGURATION
// ============================================

const DB_NAME = "attendsmart_offline";
const DB_VERSION = 1;

// ============================================
// STATE
// ============================================

let sqlite = null;
let db = null;
let isInitialized = false;

// ============================================
// ENCRYPTION HELPERS
// ============================================

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {string} keyHex - Hex-encoded encryption key
 * @returns {Promise<string>} Base64-encoded encrypted data with IV
 */
const encrypt = async (plaintext, keyHex) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Convert hex key to ArrayBuffer
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );

  // Import key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
};

/**
 * Decrypt data using AES-256-GCM
 * @param {string} ciphertext - Base64-encoded encrypted data
 * @param {string} keyHex - Hex-encoded encryption key
 * @returns {Promise<string>} Decrypted plaintext
 */
const decrypt = async (ciphertext, keyHex) => {
  // Decode base64
  const combined = new Uint8Array(
    atob(ciphertext)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

  // Extract IV (first 12 bytes)
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  // Convert hex key to ArrayBuffer
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );

  // Import key
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encrypted
  );

  // Decode to string
  return new TextDecoder().decode(decrypted);
};

// ============================================
// DATABASE INITIALIZATION
// ============================================

/**
 * Initialize SQLite database with schema
 * @returns {Promise<boolean>} Success status
 */
export const initializeOfflineStorage = async () => {
  if (isInitialized && db) {
    console.log("ℹ️ [OfflineStorage] Already initialized");
    return true;
  }

  try {
    console.log("⏳ [OfflineStorage] Initializing...");

    // Initialize key store first
    await initializeKeyStore();

    // Check platform
    if (!Capacitor.isNativePlatform()) {
      console.warn("⚠️ [OfflineStorage] Using IndexedDB fallback for web");
      isInitialized = true;
      return true;
    }

    // Create SQLite connection
    sqlite = new SQLiteConnection(CapacitorSQLite);

    // Check connection consistency
    const retCC = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

    if (retCC.result && isConn) {
      db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      db = await sqlite.createConnection(
        DB_NAME,
        false,
        "no-encryption",
        DB_VERSION,
        false
      );
    }

    // Open database
    await db.open();

    // Create tables
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS attendance_queue (
        id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        status TEXT DEFAULT 'pending'
      );
      
      CREATE INDEX IF NOT EXISTS idx_status ON attendance_queue(status);
      CREATE INDEX IF NOT EXISTS idx_created ON attendance_queue(created_at);
    `;

    await db.execute(createTableSQL);

    isInitialized = true;
    console.log("✅ [OfflineStorage] Database initialized");
    return true;
  } catch (error) {
    console.error("❌ [OfflineStorage] Initialization error:", error);
    return false;
  }
};

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Save attendance data to encrypted offline storage
 * @param {Object} data - Attendance data to save
 * @returns {Promise<string>} Record ID
 */
export const saveAttendanceOffline = async (data) => {
  if (!isInitialized) {
    await initializeOfflineStorage();
  }

  const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = Date.now();

  try {
    // Get encryption key
    const key = await getEncryptionKey();

    // Encrypt payload
    const encryptedPayload = await encrypt(JSON.stringify(data), key);

    if (Capacitor.isNativePlatform() && db) {
      // SQLite insert
      await db.run(
        `INSERT INTO attendance_queue (id, payload, created_at, status) 
         VALUES (?, ?, ?, 'pending')`,
        [id, encryptedPayload, createdAt]
      );
    } else {
      // Web fallback - IndexedDB
      const records = JSON.parse(localStorage.getItem("offline_queue") || "[]");
      records.push({
        id,
        payload: encryptedPayload,
        created_at: createdAt,
        status: "pending",
      });
      localStorage.setItem("offline_queue", JSON.stringify(records));
    }

    console.log(`📥 [OfflineStorage] Saved record: ${id}`);
    return id;
  } catch (error) {
    console.error("❌ [OfflineStorage] Save error:", error);
    throw error;
  }
};

/**
 * Get all pending attendance records (decrypted)
 * @returns {Promise<Array>} Array of decrypted attendance records
 */
export const getPendingRecords = async () => {
  if (!isInitialized) {
    await initializeOfflineStorage();
  }

  try {
    const key = await getEncryptionKey();
    let records = [];

    if (Capacitor.isNativePlatform() && db) {
      // SQLite query
      const result = await db.query(
        `SELECT * FROM attendance_queue WHERE status = 'pending' ORDER BY created_at ASC`
      );
      records = result.values || [];
    } else {
      // Web fallback
      const allRecords = JSON.parse(
        localStorage.getItem("offline_queue") || "[]"
      );
      records = allRecords.filter((r) => r.status === "pending");
    }

    // Decrypt all payloads
    const decryptedRecords = await Promise.all(
      records.map(async (record) => {
        try {
          const decryptedPayload = await decrypt(record.payload, key);
          return {
            id: record.id,
            data: JSON.parse(decryptedPayload),
            createdAt: record.created_at,
            retryCount: record.retry_count || 0,
          };
        } catch (decryptError) {
          console.error(
            `❌ Failed to decrypt record ${record.id}:`,
            decryptError
          );
          return null;
        }
      })
    );

    return decryptedRecords.filter((r) => r !== null);
  } catch (error) {
    console.error("❌ [OfflineStorage] Get pending error:", error);
    return [];
  }
};

/**
 * Mark a record as synced (delete it)
 * @param {string} id - Record ID to remove
 */
export const markRecordSynced = async (id) => {
  try {
    if (Capacitor.isNativePlatform() && db) {
      await db.run("DELETE FROM attendance_queue WHERE id = ?", [id]);
    } else {
      const records = JSON.parse(localStorage.getItem("offline_queue") || "[]");
      const filtered = records.filter((r) => r.id !== id);
      localStorage.setItem("offline_queue", JSON.stringify(filtered));
    }

    console.log(`✅ [OfflineStorage] Synced and removed: ${id}`);
  } catch (error) {
    console.error("❌ [OfflineStorage] Mark synced error:", error);
  }
};

/**
 * Mark a record as failed (increment retry count)
 * @param {string} id - Record ID
 * @param {string} error - Error message
 */
export const markRecordFailed = async (id, error) => {
  try {
    if (Capacitor.isNativePlatform() && db) {
      await db.run(
        `UPDATE attendance_queue 
         SET retry_count = retry_count + 1, last_error = ? 
         WHERE id = ?`,
        [error, id]
      );
    } else {
      const records = JSON.parse(localStorage.getItem("offline_queue") || "[]");
      const record = records.find((r) => r.id === id);
      if (record) {
        record.retry_count = (record.retry_count || 0) + 1;
        record.last_error = error;
        localStorage.setItem("offline_queue", JSON.stringify(records));
      }
    }

    console.log(`⚠️ [OfflineStorage] Marked failed: ${id}`);
  } catch (err) {
    console.error("❌ [OfflineStorage] Mark failed error:", err);
  }
};

/**
 * Get count of pending records
 * @returns {Promise<number>}
 */
export const getPendingCount = async () => {
  try {
    if (Capacitor.isNativePlatform() && db) {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM attendance_queue WHERE status = 'pending'`
      );
      return result.values?.[0]?.count || 0;
    } else {
      const records = JSON.parse(localStorage.getItem("offline_queue") || "[]");
      return records.filter((r) => r.status === "pending").length;
    }
  } catch {
    return 0;
  }
};

/**
 * Clear all offline data (for logout)
 */
export const clearOfflineStorage = async () => {
  try {
    if (Capacitor.isNativePlatform() && db) {
      await db.run("DELETE FROM attendance_queue");
    } else {
      localStorage.removeItem("offline_queue");
    }
    console.log("🧹 [OfflineStorage] Cleared all offline data");
  } catch (error) {
    console.error("❌ [OfflineStorage] Clear error:", error);
  }
};

// ============================================
// EXPORTS
// ============================================

export default {
  initializeOfflineStorage,
  saveAttendanceOffline,
  getPendingRecords,
  markRecordSynced,
  markRecordFailed,
  getPendingCount,
  clearOfflineStorage,
};
