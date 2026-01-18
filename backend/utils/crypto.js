/**
 * Cryptographic utilities for AttendSmart
 * Provides encryption/decryption for biometric data
 */

const crypto = require("crypto");
const kms = require("./kms");

const ALGORITHM = "aes-256-gcm";

/**
 * Encrypt a face descriptor using the best available method
 * Uses KMS envelope encryption in production, local encryption in development
 * @param {number[]} descriptor - 128D face descriptor
 * @returns {Promise<{encrypted: object, keyData: string|null, method: string}>}
 */
async function encryptDescriptor(descriptor) {
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    throw new Error("Face descriptor must be an array of 128 numbers");
  }

  // Use KMS in production
  if (kms.isKMSConfigured()) {
    const { encryptedDescriptor, encryptedKey } =
      await kms.encryptFaceDescriptor(descriptor);
    return {
      encrypted: encryptedDescriptor,
      keyData: encryptedKey,
      method: "kms",
    };
  }

  // Fallback to local encryption (development)
  console.warn("[Crypto] KMS not configured, using local encryption");
  const encrypted = kms.encryptLocal(descriptor);
  return {
    encrypted,
    keyData: null,
    method: "local",
  };
}

/**
 * Decrypt a face descriptor
 * @param {{iv: string, data: string, tag: string}} encrypted
 * @param {string|null} keyData - Encrypted data key (null for local encryption)
 * @param {string} method - 'kms' or 'local'
 * @returns {Promise<number[]>}
 */
async function decryptDescriptor(encrypted, keyData, method) {
  if (method === "kms" && keyData) {
    return kms.decryptFaceDescriptor(encrypted, keyData);
  }

  // Local decryption
  return kms.decryptLocal(encrypted);
}

/**
 * Generate a cryptographically secure random token
 * @param {number} length - Length of token in bytes (default 32)
 * @returns {string} - Hex encoded token
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Generate a nonce for BLE tokens
 * @returns {string} - 16 character hex nonce
 */
function generateNonce() {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Create HMAC signature for BLE beacon payload
 * @param {string} payload - Data to sign
 * @param {string} secret - Session secret
 * @returns {string} - 16 character hex signature
 */
function signBLEPayload(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
    .substring(0, 16);
}

/**
 * Verify HMAC signature
 * @param {string} payload - Original payload
 * @param {string} signature - Signature to verify
 * @param {string} secret - Session secret
 * @returns {boolean}
 */
function verifyBLESignature(payload, signature, secret) {
  const expectedSig = signBLEPayload(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSig, "hex")
  );
}

/**
 * Hash sensitive data for logging (one-way)
 * @param {string} data - Data to hash
 * @returns {string} - SHA256 hash
 */
function hashForLog(data) {
  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex")
    .substring(0, 12);
}

/**
 * Generate per-user salt for key derivation
 * @returns {string} - Base64 encoded salt
 */
function generateUserSalt() {
  return crypto.randomBytes(16).toString("base64");
}

/**
 * Derive a key from user credentials and salt
 * @param {string} userId - User's ID
 * @param {string} salt - Per-user salt
 * @returns {Buffer} - 32 byte derived key
 */
function deriveUserKey(userId, salt) {
  return crypto.pbkdf2Sync(userId, salt, 100000, 32, "sha256");
}

module.exports = {
  encryptDescriptor,
  decryptDescriptor,
  generateSecureToken,
  generateNonce,
  signBLEPayload,
  verifyBLESignature,
  hashForLog,
  generateUserSalt,
  deriveUserKey,
  ALGORITHM,
};
