const mongoose = require("mongoose");

/**
 * DatabaseService - Singleton class for managing MongoDB connections
 * Optimized for MongoDB Free Tier (Atlas M0) with:
 * - Keep-alive heartbeat to detect stale connections
 * - Reduced pool size to avoid overwhelming free tier
 * - Automatic reconnection on disconnect
 * - Network error retry strategy
 */
class DatabaseService {
  constructor() {
    this.isConnected = false;
    this.connection = null;
    this._retryCount = 0;
    this._maxRetries = 5;
    this._heartbeatInterval = null;
    this._reconnectAttempts = 0;
  }

  /**
   * Initialize and connect to the database
   */
  async connect() {
    if (this.isConnected && mongoose.connection.readyState === 1) {
      console.log("ℹ️  Database is already connected");
      return;
    }

    const dbURI = process.env.MONGODB_URI;

    if (!dbURI) {
      console.error("❌ MONGODB_URI is not defined in environment variables");
      process.exit(1);
    }

    // ============================================
    // OPTIMIZED FOR MONGODB FREE TIER (Atlas M0)
    // ============================================
    const options = {
      maxPoolSize: 20, // Reduced from 50 for free tier
      minPoolSize: 5, // Reduced from 10 for free tier
      serverSelectionTimeoutMS: 5000, // Fail fast if DB is down (was 15s)
      socketTimeoutMS: 45000, // 45s timeout (was 60s)
      family: 4, // Use IPv4
      retryWrites: true,
      w: "majority",
      connectTimeoutMS: 10000, // Reduced from 30s
      heartbeatFrequencyMS: 10000, // Internal MongoDB heartbeat
      maxIdleTimeMS: 30000, // Close idle connections faster (was 45s)
      // Auto-reconnect on network errors
      retryReads: true,
    };

    try {
      console.log("⏳ Connecting to MongoDB...");

      // Clear any existing listeners to avoid duplicates on reconnect
      mongoose.connection.removeAllListeners();

      // Event listeners for monitoring
      mongoose.connection.on("connected", () => {
        console.log("✅ MongoDB Connected Successfully");
        this.isConnected = true;
        this._retryCount = 0;
        this._reconnectAttempts = 0;

        // Start keep-alive heartbeat
        this._startHeartbeat();
      });

      mongoose.connection.on("error", (err) => {
        console.error(`❌ MongoDB Connection Error: ${err.message}`);
        this.isConnected = false;

        // Handle specific network errors
        if (this._isNetworkError(err)) {
          console.warn("🔄 Network error detected, will auto-reconnect...");
        }
      });

      mongoose.connection.on("disconnected", () => {
        console.warn("⚠️  MongoDB Disconnected");
        this.isConnected = false;
        this._stopHeartbeat();

        // Attempt automatic reconnection
        this._attemptReconnect();
      });

      mongoose.connection.on("reconnected", () => {
        console.log("✅ MongoDB Reconnected");
        this.isConnected = true;
        this._reconnectAttempts = 0;
        this._startHeartbeat();
      });

      this.connection = await mongoose.connect(dbURI, options);

      console.log(`📊 Database connected to: ${mongoose.connection.name}`);
      console.log(`🌐 Host: ${mongoose.connection.host}`);
      console.log(
        `📈 Pool size: ${options.maxPoolSize} max, ${options.minPoolSize} min`
      );

      // Slow query monitoring in development
      if (process.env.NODE_ENV !== "production") {
        mongoose.set("debug", (collectionName, methodName, ...methodArgs) => {
          const startTime = Date.now();
          setTimeout(() => {
            const duration = Date.now() - startTime;
            if (duration > 100) {
              console.warn(
                `⚠️ Slow query: ${collectionName}.${methodName} (${duration}ms)`
              );
            }
          }, 0);
        });
        console.log("📊 Slow query monitoring enabled (> 100ms)");
      }
    } catch (error) {
      console.error(`❌ Initial Database Connection Failed: ${error.message}`);
      await this._handleConnectionError(error);
    }
  }

  /**
   * Check if error is a network-related error
   */
  _isNetworkError(error) {
    const networkErrors = [
      "MongoNetworkError",
      "MongoTimeoutError",
      "ECONNRESET",
      "ENOTFOUND",
      "ECONNREFUSED",
      "ETIMEDOUT",
    ];

    return networkErrors.some(
      (errType) =>
        error.name === errType ||
        error.message?.includes(errType) ||
        error.code === errType
    );
  }

  /**
   * Start keep-alive heartbeat to detect stale connections
   * Pings the database every 30 seconds
   */
  _startHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
    }

    console.log("💓 Starting database heartbeat (every 30s)");

    this._heartbeatInterval = setInterval(async () => {
      if (!this.isConnected || mongoose.connection.readyState !== 1) {
        console.warn("💔 Heartbeat: Connection lost, attempting reconnect...");
        this._attemptReconnect();
        return;
      }

      try {
        // Ping the database to keep connection alive
        await mongoose.connection.db.admin().ping();
        // Silent success - no spam logging
      } catch (error) {
        console.error(`💔 Heartbeat failed: ${error.message}`);
        this.isConnected = false;

        if (this._isNetworkError(error)) {
          console.warn("🔄 Network error during heartbeat, reconnecting...");
          this._attemptReconnect();
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop the heartbeat interval
   */
  _stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
      console.log("💔 Database heartbeat stopped");
    }
  }

  /**
   * Attempt automatic reconnection with exponential backoff
   */
  async _attemptReconnect() {
    if (this._reconnectAttempts >= 10) {
      console.error(
        "❌ Max reconnect attempts reached, waiting 60s before retry..."
      );
      this._reconnectAttempts = 0;
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }

    this._reconnectAttempts++;
    const backoff = Math.min(
      1000 * Math.pow(2, this._reconnectAttempts),
      30000
    );

    console.log(
      `🔄 Reconnect attempt ${this._reconnectAttempts}/10 in ${
        backoff / 1000
      }s...`
    );

    await new Promise((resolve) => setTimeout(resolve, backoff));

    try {
      // Close existing connection if any
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }

      // Reconnect
      await this.connect();
    } catch (error) {
      console.error(`❌ Reconnect failed: ${error.message}`);
      // Will retry on next heartbeat or disconnect event
    }
  }

  /**
   * Handle connection errors with retry logic
   */
  async _handleConnectionError(error) {
    if (this._retryCount < this._maxRetries) {
      this._retryCount++;
      const waitTime = Math.min(1000 * Math.pow(2, this._retryCount), 30000);

      console.warn(
        `⏳ Retrying connection in ${waitTime / 1000}s... (Attempt ${
          this._retryCount
        }/${this._maxRetries})`
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.connect();
    } else {
      console.error(
        "❌ Failed to connect to database after multiple attempts. Continuing to retry in background..."
      );
      // Reset retry count to keep trying indefinitely but slowly
      this._retryCount = 0;
      await new Promise((resolve) => setTimeout(resolve, 60000));
      return this.connect();
    }
  }

  /**
   * Gracefully disconnect from the database
   */
  async disconnect() {
    this._stopHeartbeat();

    if (!this.isConnected && mongoose.connection.readyState === 0) return;

    try {
      await mongoose.connection.close();
      console.log("✅ Database connection closed gracefully");
      this.isConnected = false;
    } catch (error) {
      console.error("❌ Error closing database connection:", error);
    }
  }

  /**
   * Check connection health (for /api/health endpoint)
   */
  getHealth() {
    const readyState = mongoose.connection.readyState;
    const states = ["disconnected", "connected", "connecting", "disconnecting"];

    return {
      connected: this.isConnected && readyState === 1,
      readyState,
      status: states[readyState] || "unknown",
      host: mongoose.connection.host || "N/A",
      name: mongoose.connection.name || "N/A",
      poolSize: {
        max: 20,
        min: 5,
      },
      heartbeat: !!this._heartbeatInterval,
      reconnectAttempts: this._reconnectAttempts,
    };
  }

  /**
   * Force a connection health check (useful for API health checks)
   */
  async ping() {
    if (!this.isConnected || mongoose.connection.readyState !== 1) {
      return { success: false, error: "Not connected" };
    }

    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      const latency = Date.now() - start;

      return { success: true, latency };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Export a singleton instance
module.exports = new DatabaseService();
