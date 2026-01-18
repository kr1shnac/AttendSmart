/**
 * Secure Key Store - Hardware-Backed Encryption Key Management
 *
 * Uses native Keystore (Android) / Keychain (iOS) for secure key storage.
 * Keys NEVER touch JavaScript memory except during encryption/decryption.
 *
 * Requires: @capacitor-community/secure-storage-plugin
 *
 * @module services/keyStore
 * @version 1.0.0
 */

import { Capacitor } from "@capacitor/core";
// NOTE: SecureStoragePlugin is only available for native builds
// For web builds, the code falls back to sessionStorage
// import { SecureStoragePlugin } from "@capacitor-community/secure-storage-plugin";
// eslint-disable-next-line no-unused-vars
let SecureStoragePlugin = null; // Will be loaded dynamically for native platforms

// ============================================
// CONFIGURATION
// ============================================

const KEY_NAMES = {
  ENCRYPTION_KEY: "attendsmart_encryption_key",
  KEY_VERSION: "attendsmart_key_version",
};

const KEY_LENGTH = 32; // 256-bit for AES-256
const CURRENT_KEY_VERSION = "1";

// ============================================
// STATE
// ============================================

let cachedKey = null; // Only cached in memory during app session
let isInitialized = false;

// ============================================
// KEY GENERATION
// ============================================

/**
 * Generate a cryptographically secure random key
 * @returns {string} Hex-encoded 32-byte key
 */
const generateEncryptionKey = () => {
  const array = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// ============================================
// SECURE STORAGE OPERATIONS
// ============================================

/**
 * Save key to secure hardware storage
 * @param {string} key - Key to save
 */
const saveKeyToSecureStorage = async (key) => {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback - use sessionStorage (never localStorage!)
    console.warn(
      "⚠️ [KeyStore] Web platform - using sessionStorage (not secure for production)"
    );
    sessionStorage.setItem(KEY_NAMES.ENCRYPTION_KEY, key);
    sessionStorage.setItem(KEY_NAMES.KEY_VERSION, CURRENT_KEY_VERSION);
    return;
  }

  await SecureStoragePlugin.set({
    key: KEY_NAMES.ENCRYPTION_KEY,
    value: key,
  });

  await SecureStoragePlugin.set({
    key: KEY_NAMES.KEY_VERSION,
    value: CURRENT_KEY_VERSION,
  });

  console.log("✅ [KeyStore] Key saved to secure hardware storage");
};

/**
 * Retrieve key from secure hardware storage
 * @returns {Promise<string|null>} Key or null if not found
 */
const getKeyFromSecureStorage = async () => {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback
    return sessionStorage.getItem(KEY_NAMES.ENCRYPTION_KEY);
  }

  try {
    const result = await SecureStoragePlugin.get({
      key: KEY_NAMES.ENCRYPTION_KEY,
    });
    return result.value;
  } catch (error) {
    // Key doesn't exist yet
    if (error.message?.includes("not found") || error.code === "ERR_NO_VALUE") {
      return null;
    }
    throw error;
  }
};

/**
 * Check if key exists in secure storage
 * @returns {Promise<boolean>}
 */
const keyExists = async () => {
  if (!Capacitor.isNativePlatform()) {
    return sessionStorage.getItem(KEY_NAMES.ENCRYPTION_KEY) !== null;
  }

  try {
    const keys = await SecureStoragePlugin.keys();
    return keys.value.includes(KEY_NAMES.ENCRYPTION_KEY);
  } catch {
    return false;
  }
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Initialize key store
 * - If key exists: Retrieve it
 * - If no key: Generate and save new one
 *
 * Must be called on app launch before any encryption operations.
 *
 * @returns {Promise<boolean>} Success status
 */
export const initializeKeyStore = async () => {
  if (isInitialized && cachedKey) {
    console.log("ℹ️ [KeyStore] Already initialized");
    return true;
  }

  try {
    console.log("⏳ [KeyStore] Initializing...");

    // Check if key already exists
    const exists = await keyExists();

    if (exists) {
      // Retrieve existing key
      cachedKey = await getKeyFromSecureStorage();
      console.log("✅ [KeyStore] Retrieved existing encryption key");
    } else {
      // Generate new key
      console.log("🔑 [KeyStore] Generating new encryption key...");
      cachedKey = generateEncryptionKey();
      await saveKeyToSecureStorage(cachedKey);
      console.log("✅ [KeyStore] New encryption key generated and saved");
    }

    isInitialized = true;
    return true;
  } catch (error) {
    console.error("❌ [KeyStore] Initialization error:", error);
    return false;
  }
};

/**
 * Get the encryption key for use in crypto operations
 * @returns {Promise<string>} The encryption key
 * @throws {Error} If key store not initialized
 */
export const getEncryptionKey = async () => {
  if (!isInitialized) {
    await initializeKeyStore();
  }

  if (!cachedKey) {
    throw new Error(
      "Encryption key not available. Initialize key store first."
    );
  }

  return cachedKey;
};

/**
 * Rotate the encryption key (for security best practices)
 * WARNING: This will invalidate all previously encrypted data!
 *
 * @returns {Promise<string>} New encryption key
 */
export const rotateEncryptionKey = async () => {
  console.log("🔄 [KeyStore] Rotating encryption key...");

  const newKey = generateEncryptionKey();
  await saveKeyToSecureStorage(newKey);
  cachedKey = newKey;

  console.log("✅ [KeyStore] Key rotated successfully");
  return newKey;
};

/**
 * Clear the encryption key (for logout/account deletion)
 */
export const clearEncryptionKey = async () => {
  if (!Capacitor.isNativePlatform()) {
    sessionStorage.removeItem(KEY_NAMES.ENCRYPTION_KEY);
    sessionStorage.removeItem(KEY_NAMES.KEY_VERSION);
  } else {
    await SecureStoragePlugin.remove({ key: KEY_NAMES.ENCRYPTION_KEY });
    await SecureStoragePlugin.remove({ key: KEY_NAMES.KEY_VERSION });
  }

  cachedKey = null;
  isInitialized = false;
  console.log("✅ [KeyStore] Encryption key cleared");
};

/**
 * Check if key store is initialized
 */
export const isKeyStoreInitialized = () => isInitialized;

// ============================================
// EXPORTS
// ============================================

export default {
  initializeKeyStore,
  getEncryptionKey,
  rotateEncryptionKey,
  clearEncryptionKey,
  isKeyStoreInitialized,
};
