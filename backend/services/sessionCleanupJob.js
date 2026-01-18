/**
 * Session Cleanup Job
 * Background job to cleanup abandoned/stale sessions
 * Runs on a schedule to prevent ghost sessions
 */

const cron = require("node-cron");
const sessionManager = require("./sessionManager");

// Configuration
const CLEANUP_INTERVAL = "*/5 * * * *"; // Every 5 minutes
const STALE_THRESHOLD_MINUTES = 30; // Sessions without heartbeat for 30 min

let isRunning = false;

/**
 * Initialize the cleanup job
 */
function initSessionCleanupJob() {
  console.log("[SessionCleanup] Initializing session cleanup job...");
  console.log(`[SessionCleanup] Schedule: ${CLEANUP_INTERVAL}`);
  console.log(
    `[SessionCleanup] Stale threshold: ${STALE_THRESHOLD_MINUTES} minutes`
  );

  cron.schedule(CLEANUP_INTERVAL, async () => {
    // Prevent concurrent runs
    if (isRunning) {
      console.log(
        "[SessionCleanup] Previous cleanup still running, skipping..."
      );
      return;
    }

    isRunning = true;
    const startTime = Date.now();

    try {
      console.log("[SessionCleanup] Starting cleanup run...");

      const result = await sessionManager.cleanupAbandonedSessions(
        STALE_THRESHOLD_MINUTES
      );

      const duration = Date.now() - startTime;

      if (result.cleanedCount > 0) {
        console.log(
          `[SessionCleanup] Cleaned ${result.cleanedCount} stale sessions in ${duration}ms`
        );
        result.sessions.forEach((s) => {
          console.log(`  - Session ${s.sessionId}: ${s.topic}`);
        });
      } else {
        console.log(`[SessionCleanup] No stale sessions found (${duration}ms)`);
      }
    } catch (error) {
      console.error("[SessionCleanup] Error during cleanup:", error);
    } finally {
      isRunning = false;
    }
  });

  console.log("[SessionCleanup] Cleanup job initialized successfully");
}

/**
 * Run cleanup immediately (for testing or manual trigger)
 */
async function runCleanupNow() {
  console.log("[SessionCleanup] Manual cleanup triggered");
  return await sessionManager.cleanupAbandonedSessions(STALE_THRESHOLD_MINUTES);
}

module.exports = {
  initSessionCleanupJob,
  runCleanupNow,
  STALE_THRESHOLD_MINUTES,
};
