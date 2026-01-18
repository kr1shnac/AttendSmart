/**
 * Biometric Utility Functions - Enhanced for High Accuracy
 *
 * Helper functions for face descriptor validation and comparison
 * Includes both Euclidean distance and Cosine similarity for robust matching
 */

/**
 * Calculate Euclidean distance between two face descriptors
 * @param {Array<number>} descriptor1 - First 128D face descriptor
 * @param {Array<number>} descriptor2 - Second 128D face descriptor
 * @returns {number} - Euclidean distance (lower = more similar)
 */
function euclideanDistance(descriptor1, descriptor2) {
  if (!descriptor1 || !descriptor2) {
    throw new Error("Invalid descriptors: one or both are null/undefined");
  }

  if (!Array.isArray(descriptor1) || !Array.isArray(descriptor2)) {
    throw new Error("Invalid descriptors: must be arrays");
  }

  if (descriptor1.length !== descriptor2.length) {
    throw new Error(
      `Descriptor dimensions must match: ${descriptor1.length} vs ${descriptor2.length}`
    );
  }

  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate Cosine similarity between two face descriptors
 * More robust to lighting and minor pose variations
 * @param {Array<number>} descriptor1 - First 128D face descriptor
 * @param {Array<number>} descriptor2 - Second 128D face descriptor
 * @returns {number} - Cosine similarity (0-1, higher = more similar)
 */
function cosineSimilarity(descriptor1, descriptor2) {
  if (!descriptor1 || !descriptor2) {
    throw new Error("Invalid descriptors: one or both are null/undefined");
  }

  if (!Array.isArray(descriptor1) || !Array.isArray(descriptor2)) {
    throw new Error("Invalid descriptors: must be arrays");
  }

  if (descriptor1.length !== descriptor2.length) {
    throw new Error(
      `Descriptor dimensions must match: ${descriptor1.length} vs ${descriptor2.length}`
    );
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < descriptor1.length; i++) {
    dotProduct += descriptor1[i] * descriptor2[i];
    magnitude1 += descriptor1[i] * descriptor1[i];
    magnitude2 += descriptor2[i] * descriptor2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Validate face descriptor format
 * @param {Array<number>} descriptor - Face descriptor to validate
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateDescriptor(descriptor) {
  if (!descriptor) {
    return { valid: false, error: "Descriptor is null or undefined" };
  }

  if (!Array.isArray(descriptor)) {
    return { valid: false, error: "Descriptor must be an array" };
  }

  if (descriptor.length !== 128) {
    return {
      valid: false,
      error: `Descriptor must be 128 dimensions, got ${descriptor.length}`,
    };
  }

  if (!descriptor.every((val) => typeof val === "number" && !isNaN(val))) {
    return {
      valid: false,
      error: "All descriptor values must be valid numbers",
    };
  }

  return { valid: true };
}

/**
 * Calculate confidence score combining Euclidean and Cosine metrics
 * Uses the higher confidence from either method for robust matching
 * @param {number} euclidean - Euclidean distance between descriptors
 * @param {number} cosine - Cosine similarity between descriptors
 * @param {number} euclideanThreshold - Maximum distance for a match (default: 0.55)
 * @returns {number} - Confidence percentage (0-100)
 */
function combinedConfidence(euclidean, cosine, euclideanThreshold = 0.55) {
  // Euclidean confidence: scale from 0 at threshold to 100 at 0 distance
  const euclideanConf = Math.max(0, (1 - euclidean / euclideanThreshold) * 100);

  // Cosine confidence: scale to 0-100 (cosine is already 0-1)
  const cosineConf = cosine * 100;

  // Use the higher confidence (more lenient)
  return Math.round(Math.max(euclideanConf, cosineConf));
}

/**
 * Check if two face descriptors match using BOTH metrics
 * A match is found if EITHER Euclidean OR Cosine indicates similarity
 * @param {Array<number>} descriptor1 - First descriptor
 * @param {Array<number>} descriptor2 - Second descriptor
 * @param {number} threshold - Maximum Euclidean distance for match (default: 0.55)
 * @returns {Object} - { match: boolean, distance: number, similarity: number, confidence: number }
 */
function matchDescriptors(descriptor1, descriptor2, threshold = 0.55) {
  const distance = euclideanDistance(descriptor1, descriptor2);
  const similarity = cosineSimilarity(descriptor1, descriptor2);

  // Match if Euclidean is below threshold OR Cosine is above 0.85
  const euclideanMatch = distance < threshold;
  const cosineMatch = similarity > 0.85;
  const match = euclideanMatch || cosineMatch;

  const confidence = combinedConfidence(distance, similarity, threshold);

  return {
    match,
    distance,
    similarity,
    euclideanMatch,
    cosineMatch,
    confidence,
    threshold,
  };
}

/**
 * L2 Normalize a face descriptor
 * Ensures consistent magnitude for accurate matching
 * @param {Array<number>} descriptor - Raw descriptor
 * @returns {Array<number>} - Normalized descriptor
 */
function normalizeDescriptor(descriptor) {
  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    throw new Error("Invalid descriptor for normalization");
  }

  const magnitude = Math.sqrt(
    descriptor.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude === 0) return descriptor;

  return descriptor.map((val) => {
    if (typeof val !== "number" || isNaN(val)) {
      return 0;
    }
    return val / magnitude;
  });
}

/**
 * Find best match from a list of enrolled descriptors
 * Uses combined Euclidean + Cosine scoring for maximum accuracy
 * @param {Array<number>} inputDescriptor - Input descriptor to match
 * @param {Array<Object>} enrolledDescriptors - Array of {descriptor, userId, ...}
 * @param {number} threshold - Match threshold (default: 0.55)
 * @returns {Object|null} - Best match or null if no match found
 */
function findBestMatch(inputDescriptor, enrolledDescriptors, threshold = 0.55) {
  let bestMatch = null;
  let bestScore = -Infinity;

  for (const enrolled of enrolledDescriptors) {
    if (!enrolled.descriptor || enrolled.descriptor.length !== 128) continue;

    const distance = euclideanDistance(inputDescriptor, enrolled.descriptor);
    const similarity = cosineSimilarity(inputDescriptor, enrolled.descriptor);

    // Combined score: favor both low distance AND high similarity
    // Score = similarity * 100 - distance * 50 (weighted combination)
    const score = similarity * 100 - distance * 50;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        ...enrolled,
        distance,
        similarity,
        score,
        confidence: combinedConfidence(distance, similarity, threshold),
      };
    }
  }

  // Check if best match meets threshold
  if (bestMatch) {
    const isMatch =
      bestMatch.distance < threshold || bestMatch.similarity > 0.85;
    if (!isMatch) {
      return null;
    }
  }

  return bestMatch;
}

module.exports = {
  euclideanDistance,
  cosineSimilarity,
  validateDescriptor,
  combinedConfidence,
  matchDescriptors,
  normalizeDescriptor,
  findBestMatch,
};
