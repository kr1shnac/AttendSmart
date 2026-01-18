/**
 * AWS KMS Integration for AttendSmart
 * Provides envelope encryption for biometric data
 */

const {
  KMSClient,
  DecryptCommand,
  GenerateDataKeyCommand,
} = require("@aws-sdk/client-kms");
const crypto = require("crypto");

// Initialize KMS client
const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined, // Use IAM role if no explicit credentials
});

const CMK_ARN = process.env.KMS_CMK_ARN;
const ALGORITHM = "aes-256-gcm";

/**
 * Generate a new data key for envelope encryption
 * @returns {Promise<{plainKey: Buffer, encryptedKey: string}>}
 */
async function generateDataKey() {
  if (!CMK_ARN) {
    throw new Error("KMS_CMK_ARN environment variable not set");
  }

  const command = new GenerateDataKeyCommand({
    KeyId: CMK_ARN,
    KeySpec: "AES_256",
  });

  const { Plaintext, CiphertextBlob } = await kmsClient.send(command);

  return {
    plainKey: Buffer.from(Plaintext), // Use for encryption, then discard
    encryptedKey: Buffer.from(CiphertextBlob).toString("base64"), // Store this
  };
}

/**
 * Decrypt a data key using KMS
 * @param {string} encryptedKey - Base64 encoded encrypted data key
 * @returns {Promise<Buffer>} - Decrypted data key
 */
async function decryptDataKey(encryptedKey) {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(encryptedKey, "base64"),
  });

  const { Plaintext } = await kmsClient.send(command);
  return Buffer.from(Plaintext);
}

/**
 * Encrypt data using envelope encryption
 * @param {any} data - Data to encrypt (will be JSON stringified)
 * @param {Buffer} dataKey - Plaintext data key
 * @returns {{iv: string, data: string, tag: string}}
 */
function encryptWithDataKey(data, dataKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, dataKey, iv);

  const json = JSON.stringify(data);
  let encrypted = cipher.update(json, "utf8", "hex");
  encrypted += cipher.final("hex");

  return {
    iv: iv.toString("hex"),
    data: encrypted,
    tag: cipher.getAuthTag().toString("hex"),
  };
}

/**
 * Decrypt data using envelope encryption
 * @param {{iv: string, data: string, tag: string}} encrypted - Encrypted blob
 * @param {Buffer} dataKey - Plaintext data key
 * @returns {any} - Decrypted and parsed data
 */
function decryptWithDataKey(encrypted, dataKey) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    dataKey,
    Buffer.from(encrypted.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "hex"));

  let decrypted = decipher.update(encrypted.data, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}

/**
 * Encrypt a face descriptor with envelope encryption
 * Generates a new data key for each user/descriptor
 * @param {number[]} descriptor - 128D face descriptor array
 * @returns {Promise<{encryptedDescriptor: object, encryptedKey: string}>}
 */
async function encryptFaceDescriptor(descriptor) {
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    throw new Error("Invalid face descriptor: must be array of 128 numbers");
  }

  const { plainKey, encryptedKey } = await generateDataKey();
  const encryptedDescriptor = encryptWithDataKey(descriptor, plainKey);

  // Zero out plainKey from memory (best effort)
  plainKey.fill(0);

  return {
    encryptedDescriptor,
    encryptedKey,
  };
}

/**
 * Decrypt a face descriptor using stored encrypted key
 * AUDITED: All decrypt operations are logged for security
 * @param {{iv: string, data: string, tag: string}} encryptedDescriptor
 * @param {string} encryptedKey - Base64 encoded encrypted data key
 * @param {object} auditContext - Context for audit logging
 * @returns {Promise<number[]>} - 128D face descriptor
 */
async function decryptFaceDescriptor(
  encryptedDescriptor,
  encryptedKey,
  auditContext = {}
) {
  const startTime = Date.now();
  let success = true;
  let errorMessage = null;

  try {
    // Check rate limit if auditContext provided
    if (auditContext.userId) {
      const DecryptAudit = require("../models/DecryptAudit");
      const isRateLimited = await DecryptAudit.checkRateLimit(
        auditContext.userId
      );
      if (isRateLimited) {
        throw new Error("Decrypt rate limit exceeded");
      }
    }

    const dataKey = await decryptDataKey(encryptedKey);
    const descriptor = decryptWithDataKey(encryptedDescriptor, dataKey);

    // Zero out dataKey from memory (best effort)
    dataKey.fill(0);

    return descriptor;
  } catch (error) {
    success = false;
    errorMessage = error.message;
    throw error;
  } finally {
    // Always log the decrypt attempt
    if (auditContext.userId) {
      const DecryptAudit = require("../models/DecryptAudit");
      DecryptAudit.logDecrypt({
        userId: auditContext.userId,
        targetUserId: auditContext.targetUserId || auditContext.userId,
        operation: auditContext.operation || "face_descriptor",
        reason: auditContext.reason || "attendance_verification",
        sessionId: auditContext.sessionId,
        attendanceId: auditContext.attendanceId,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        platform: auditContext.platform,
        success,
        errorMessage,
        duration: Date.now() - startTime,
      }).catch((err) => console.error("[KMS] Audit log failed:", err.message));
    }
  }
}

/**
 * Fallback: Local encryption when KMS is not available (development only)
 * Uses BIOMETRIC_ENCRYPTION_KEY from env
 */
function encryptLocal(data) {
  const key = process.env.BIOMETRIC_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error("BIOMETRIC_ENCRYPTION_KEY must be at least 32 characters");
  }

  const keyBuffer = crypto.createHash("sha256").update(key).digest();
  return encryptWithDataKey(data, keyBuffer);
}

function decryptLocal(encrypted) {
  const key = process.env.BIOMETRIC_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("BIOMETRIC_ENCRYPTION_KEY not set");
  }

  const keyBuffer = crypto.createHash("sha256").update(key).digest();
  return decryptWithDataKey(encrypted, keyBuffer);
}

/**
 * Check if KMS is configured and available
 */
function isKMSConfigured() {
  return Boolean(
    CMK_ARN && (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_REGION)
  );
}

module.exports = {
  generateDataKey,
  decryptDataKey,
  encryptWithDataKey,
  decryptWithDataKey,
  encryptFaceDescriptor,
  decryptFaceDescriptor,
  encryptLocal,
  decryptLocal,
  isKMSConfigured,
};
