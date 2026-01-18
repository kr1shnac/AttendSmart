/**
 * Bull-Board Integration - Queue Dashboard
 *
 * Setup instructions for real-time queue monitoring.
 * Shows: Waiting, Active, Completed, Failed jobs.
 *
 * Add this to your server.js or create as standalone dashboard.
 *
 * @version 1.0.0
 */

const express = require("express");
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const { Queue } = require("bullmq");

// ============================================
// CONFIGURATION
// ============================================

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3001;
const DASHBOARD_PATH = "/admin/queues";

// Parse Redis URL
const getRedisConnection = () => {
  try {
    const url = new URL(REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      tls: url.protocol === "rediss:" ? {} : undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
};

// ============================================
// QUEUE SETUP
// ============================================

const connection = getRedisConnection();

// Connect to the attendance queue
const attendanceQueue = new Queue("attendance-queue", { connection });

// ============================================
// EXPRESS ADAPTER
// ============================================

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(DASHBOARD_PATH);

// Create Bull Board
createBullBoard({
  queues: [new BullMQAdapter(attendanceQueue)],
  serverAdapter,
});

// ============================================
// STANDALONE SERVER
// ============================================

const app = express();

// Mount the Bull Board UI
app.use(DASHBOARD_PATH, serverAdapter.getRouter());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", dashboard: DASHBOARD_PATH });
});

// ============================================
// START SERVER
// ============================================

if (require.main === module) {
  app.listen(DASHBOARD_PORT, () => {
    console.log("");
    console.log("═══════════════════════════════════════════════");
    console.log("📊 Bull-Board Queue Dashboard Running");
    console.log("═══════════════════════════════════════════════");
    console.log(`   URL: http://localhost:${DASHBOARD_PORT}${DASHBOARD_PATH}`);
    console.log(`   Redis: ${connection.host}:${connection.port}`);
    console.log("");
    console.log("   Monitoring:");
    console.log("   • Waiting Jobs (queued, not yet processed)");
    console.log("   • Active Jobs (currently being processed)");
    console.log("   • Completed Jobs (successfully processed)");
    console.log("   • Failed Jobs (errors during processing)");
    console.log("═══════════════════════════════════════════════");
  });
}

// ============================================
// EXPORT FOR INTEGRATION
// ============================================

module.exports = {
  serverAdapter,
  attendanceQueue,
  mountPath: DASHBOARD_PATH,
};
