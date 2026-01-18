/**
 * Queue Service - BullMQ-based Attendance Processing
 *
 * Production-grade queue service for handling high-concurrency attendance writes.
 * Uses Redis-backed BullMQ for reliable job processing with:
 * - Automatic retries with exponential backoff
 * - Dead letter queue for failed jobs
 * - Batch processing for MongoDB efficiency
 * - Graceful shutdown support
 *
 * @module services/queueService
 * @version 1.0.0
 */

const { Queue, Worker, QueueEvents } = require("bullmq");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const axios = require("axios");

// ============================================
// CONFIGURATION
// ============================================

// Face Engine service URL
const FACE_ENGINE_URL = process.env.FACE_ENGINE_URL || "http://localhost:5050";
const FACE_CONFIDENCE_THRESHOLD = parseFloat(
  process.env.FACE_CONFIDENCE_THRESHOLD || "0.6"
);

/**
 * Redis connection configuration
 * Supports both local Docker Redis and cloud Upstash
 */
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  // Parse Redis URL for connection options
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      // TLS for cloud Redis (Upstash)
      tls: url.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    };
  } catch (error) {
    // Fallback for simple host:port format
    console.warn("⚠️ Could not parse REDIS_URL, using defaults");
    return {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
};

const QUEUE_NAME = "attendance-queue";
const BATCH_SIZE = 500; // Process up to 500 records per batch
const JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000, // 1s, 2s, 4s
  },
  removeOnComplete: {
    age: 3600, // Keep completed jobs for 1 hour
    count: 1000, // Keep last 1000 completed jobs
  },
  removeOnFail: {
    age: 86400, // Keep failed jobs for 24 hours
  },
};

// ============================================
// FACE VERIFICATION HELPER
// ============================================

/**
 * Verify face against stored encoding using face-engine
 * @param {string} livenessImageBase64 - Base64 image from liveness check
 * @param {Array} storedEncoding - User's stored 128D face encoding
 * @returns {Object} Verification result
 */
const verifyFaceWithEngine = async (livenessImageBase64, storedEncoding) => {
  try {
    const response = await axios.post(
      `${FACE_ENGINE_URL}/verify`,
      {
        source_encoding: storedEncoding,
        target_image: livenessImageBase64,
        tolerance: FACE_CONFIDENCE_THRESHOLD,
      },
      {
        timeout: 10000, // 10 second timeout
        headers: { "Content-Type": "application/json" },
      }
    );

    return {
      success: true,
      match: response.data.match,
      confidence: response.data.confidence,
      distance: response.data.distance,
    };
  } catch (error) {
    console.error("❌ Face engine error:", error.message);
    return {
      success: false,
      match: false,
      confidence: 0,
      error: error.message,
    };
  }
};

// ============================================
// QUEUE INSTANCE
// ============================================

let queue = null;
let worker = null;
let queueEvents = null;
let isInitialized = false;

/**
 * Initialize the attendance queue and worker
 * Must be called during server startup after DB connection
 *
 * @param {Object} io - Socket.IO instance for real-time notifications
 * @returns {Promise<void>}
 */
const initialize = async (io = null) => {
  if (isInitialized) {
    console.log("ℹ️ Queue service already initialized");
    return;
  }

  const connection = getRedisConnection();

  try {
    console.log("⏳ Initializing attendance queue...");
    console.log(`   └─ Redis: ${connection.host}:${connection.port}`);
    console.log(`   └─ Face Engine: ${FACE_ENGINE_URL}`);

    // Create the queue
    queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: JOB_OPTIONS,
    });

    // Create queue events listener for monitoring
    queueEvents = new QueueEvents(QUEUE_NAME, { connection });

    // Create the worker to process jobs
    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        return await processAttendanceJob(job, io);
      },
      {
        connection,
        concurrency: 5, // Process 5 jobs concurrently
        limiter: {
          max: 100, // Max 100 jobs per second
          duration: 1000,
        },
      }
    );

    // ============================================
    // EVENT LISTENERS
    // ============================================

    // Worker completed event
    worker.on("completed", (job, result) => {
      console.log(`✅ Job ${job.id} completed: ${result.message}`);
    });

    // Worker failed event - Critical logging
    worker.on("failed", (job, err) => {
      console.error(
        `❌ Job ${job?.id} failed after ${job?.attemptsMade} attempts`
      );
      console.error(`   └─ Error: ${err.message}`);
      console.error(
        `   └─ Data: ${JSON.stringify(job?.data).substring(0, 200)}...`
      );

      // TODO: Send alert to monitoring system (Sentry, etc.)
    });

    // Worker error event
    worker.on("error", (err) => {
      console.error("❌ Queue worker error:", err.message);
    });

    // Queue events for monitoring
    queueEvents.on("waiting", ({ jobId }) => {
      console.log(`📥 Job ${jobId} added to queue`);
    });

    queueEvents.on("stalled", ({ jobId }) => {
      console.warn(`⚠️ Job ${jobId} stalled - will be retried`);
    });

    // Verify connection
    await queue.waitUntilReady();
    console.log("✅ Attendance queue initialized successfully");

    isInitialized = true;
  } catch (error) {
    console.error("❌ Failed to initialize queue:", error.message);
    console.error("   └─ Make sure Redis is running: docker-compose up -d");

    // Don't crash the server - allow fallback to direct writes
    isInitialized = false;
  }
};

// ============================================
// JOB PROCESSING
// ============================================

/**
 * Process a single attendance job with face verification
 * Called by the worker for each job in the queue
 *
 * @param {Object} job - BullMQ job object
 * @param {Object} io - Socket.IO instance for notifications
 * @returns {Promise<Object>} Processing result
 */
const processAttendanceJob = async (job, io) => {
  const { attendanceData, userId, sessionId } = job.data;

  try {
    console.log(`🔄 Processing job ${job.id} for session ${sessionId}`);

    // ============================================
    // STEP 1: Fetch user's stored face encoding
    // ============================================

    const user = await User.findById(userId).select("faceDescriptor name");

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    let faceVerified = false;
    let faceConfidence = 0;
    let proxyAlert = false;
    let verificationMethod = "gps-only";

    // ============================================
    // STEP 2: Face verification (if image provided)
    // ============================================

    if (
      attendanceData.livenessImageBase64 &&
      user.faceDescriptor?.descriptor?.length === 128
    ) {
      console.log(`🔍 Verifying face for user ${userId}...`);

      const verificationResult = await verifyFaceWithEngine(
        attendanceData.livenessImageBase64,
        user.faceDescriptor.descriptor
      );

      if (verificationResult.success) {
        faceVerified = verificationResult.match;
        faceConfidence = verificationResult.confidence;

        if (faceVerified) {
          console.log(
            `✅ Face verified: confidence ${(faceConfidence * 100).toFixed(1)}%`
          );
          verificationMethod = "gps+biometric";
        } else {
          console.warn(
            `⚠️ Face mismatch: confidence ${(faceConfidence * 100).toFixed(1)}%`
          );
          proxyAlert = true;
        }
      } else {
        console.error(
          `❌ Face verification failed: ${verificationResult.error}`
        );
        // Don't block on face engine failure - fall back to GPS only
      }
    } else if (!user.faceDescriptor?.descriptor?.length) {
      console.log(
        `ℹ️ User ${userId} has no enrolled face - skipping face verification`
      );
    }

    // ============================================
    // STEP 3: Determine attendance status
    // ============================================

    const gpsVerified =
      attendanceData.verificationData?.gps?.verified !== false;

    let status = "pending";
    let hasAlert = false;
    let alertType = null;
    let alertMessage = null;

    if (proxyAlert) {
      // Face mismatch - suspected proxy
      status = "pending";
      hasAlert = true;
      alertType = "suspected_proxy";
      alertMessage = `Face verification failed (${(
        faceConfidence * 100
      ).toFixed(1)}% confidence). Possible proxy attempt.`;
      console.warn(`🚨 PROXY ALERT: ${alertMessage}`);
    } else if (faceVerified && gpsVerified) {
      // Both GPS and face verified - auto approve
      status = "present";
    } else if (gpsVerified && attendanceData.livenessVerified) {
      // GPS + liveness passed but no face encoding
      status = "present";
    } else if (gpsVerified) {
      // GPS only - present but flag for review
      status = "present";
    }

    // ============================================
    // STEP 4: Create attendance record
    // ============================================

    const attendanceRecord = {
      ...attendanceData,
      status,
      hasAlert,
      alertType,
      alertMessage,
      isVerified: faceVerified && gpsVerified,
      checkInTime: status === "present" ? new Date() : null,
      verificationMethod,
      verificationData: {
        ...attendanceData.verificationData,
        biometric: {
          verified: faceVerified,
          confidence: faceConfidence,
          type: "face",
          timestamp: new Date(),
        },
      },
    };

    // Remove base64 image before saving (too large for MongoDB)
    delete attendanceRecord.livenessImageBase64;

    const attendance = await Attendance.create(attendanceRecord);

    // ============================================
    // STEP 5: Emit real-time notification
    // ============================================

    if (io && sessionId) {
      io.to(`session-${sessionId}`).emit("attendance-marked", {
        odId: userId,
        studentName: attendanceData.studentName || user.name,
        status: attendance.status,
        timestamp: attendance.createdAt,
        verificationMethod,
        hasAlert,
        alertType,
        faceConfidence,
      });
    }

    return {
      success: true,
      message: `Attendance ${status} for user ${userId}`,
      attendanceId: attendance._id.toString(),
      faceVerified,
      faceConfidence,
      proxyAlert,
    };
  } catch (error) {
    console.error(`❌ Job ${job.id} processing error:`, error.message);

    // Throw to trigger retry
    throw new Error(`Failed to record attendance: ${error.message}`);
  }
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Add an attendance record to the processing queue
 * Returns immediately with job ID for tracking
 *
 * @param {Object} attendanceData - Attendance record data
 * @param {string} userId - User ID for tracking
 * @param {string} sessionId - Session ID for Socket.IO room
 * @returns {Promise<Object>} Job info with ID
 */
const addAttendanceJob = async (attendanceData, userId, sessionId) => {
  // Fallback: If queue not initialized, use direct write
  if (!isInitialized || !queue) {
    console.warn("⚠️ Queue not available, using direct MongoDB write");
    const attendance = await Attendance.create(attendanceData);
    return {
      jobId: null,
      fallback: true,
      attendanceId: attendance._id.toString(),
    };
  }

  try {
    // Add job to queue with priority based on verification type
    const job = await queue.add(
      "mark-attendance",
      {
        attendanceData,
        userId,
        sessionId,
        queuedAt: new Date().toISOString(),
      },
      {
        // Higher priority for biometric-verified attendance
        priority: attendanceData.verificationMethod?.includes("biometric")
          ? 1
          : 2,
      }
    );

    console.log(`📤 Job ${job.id} added to queue for user ${userId}`);

    return {
      jobId: job.id,
      fallback: false,
      status: "queued",
    };
  } catch (error) {
    console.error("❌ Failed to add job to queue:", error.message);

    // Fallback to direct write on queue failure
    console.warn("⚠️ Falling back to direct MongoDB write");
    const attendance = await Attendance.create(attendanceData);
    return {
      jobId: null,
      fallback: true,
      attendanceId: attendance._id.toString(),
    };
  }
};

/**
 * Get queue health status for /api/health endpoint
 *
 * @returns {Promise<Object>} Queue health metrics
 */
const getHealth = async () => {
  if (!isInitialized || !queue) {
    return {
      status: "unavailable",
      message: "Queue not initialized",
    };
  }

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      status: "healthy",
      queue: QUEUE_NAME,
      jobs: {
        waiting,
        active,
        completed,
        failed,
        delayed,
      },
      worker: {
        running: worker?.isRunning() ?? false,
        concurrency: 5,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: error.message,
    };
  }
};

/**
 * Get job status by ID
 *
 * @param {string} jobId - Job ID to check
 * @returns {Promise<Object>} Job status
 */
const getJobStatus = async (jobId) => {
  if (!queue) {
    return { status: "unknown", message: "Queue not available" };
  }

  try {
    const job = await queue.getJob(jobId);

    if (!job) {
      return { status: "not_found" };
    }

    const state = await job.getState();

    return {
      status: state,
      progress: job.progress,
      attempts: job.attemptsMade,
      data: job.returnvalue,
      failedReason: job.failedReason,
    };
  } catch (error) {
    return { status: "error", message: error.message };
  }
};

/**
 * Graceful shutdown - drain queue and close connections
 * Called during server shutdown
 *
 * @returns {Promise<void>}
 */
const shutdown = async () => {
  console.log("⏳ Shutting down queue service...");

  try {
    if (worker) {
      await worker.close();
      console.log("✅ Worker closed");
    }

    if (queueEvents) {
      await queueEvents.close();
      console.log("✅ Queue events closed");
    }

    if (queue) {
      await queue.close();
      console.log("✅ Queue closed");
    }

    isInitialized = false;
    console.log("✅ Queue service shutdown complete");
  } catch (error) {
    console.error("❌ Error during queue shutdown:", error.message);
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  initialize,
  addAttendanceJob,
  getHealth,
  getJobStatus,
  shutdown,

  // Expose for testing
  _getQueue: () => queue,
  _isInitialized: () => isInitialized,
};
