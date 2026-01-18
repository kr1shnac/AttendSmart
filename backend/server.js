const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const helmet = require("helmet"); // ✅ ADDED: Security headers
const rateLimit = require("express-rate-limit"); // ✅ ADDED: Rate limiting
const jwt = require("jsonwebtoken"); // ✅ ADDED: For Socket.IO auth
require("dotenv").config();
const messageRoutes = require("./routes/messageRoutes");
const session = require("express-session");
const sessionManager = require("./services/sessionManager");
const { initSessionCleanupJob } = require("./services/sessionCleanupJob");
const dbService = require("./services/DatabaseService");
const cacheService = require("./services/CacheService"); // ✅ ADDED: Cache service
const queueService = require("./services/queueService"); // ✅ ADDED: BullMQ queue service
const { autoCacheHeaders, etagSupport } = require("./middleware/cacheHeaders"); // ✅ ADDED: Cache headers

// ✅ ADDED: Validate required environment variables
const requiredEnvVars = ["MONGODB_URI", "JWT_SECRET"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  console.error("Please check your .env file");
  process.exit(1);
}

// **1. Initialize Express App first!**
const app = express();
const server = http.createServer(app);

// **2. Initialize Socket.IO with CORS and authentication**
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
  transports: ["websocket", "polling"], // ✅ ADDED: Explicit transports
  pingTimeout: 60000, // ✅ ADDED: Connection timeout
  pingInterval: 25000, // ✅ ADDED: Keep-alive interval
});

// ✅ ADDED: Socket.IO Authentication Middleware
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication required"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error("Invalid token"));
      }

      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.userName = decoded.name;
      next();
    });
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication failed"));
  }
});

// ========== SOCKET.IO SESSION MANAGEMENT ==========
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.userId} (${socket.userRole})`);

  // Join a session room with participant tracking
  socket.on("join-session", async (sessionId) => {
    try {
      socket.sessionId = sessionId;
      socket.join(`session-${sessionId}`);

      // Track participant in database
      const result = await sessionManager.addParticipant(
        sessionId,
        socket.userId,
        socket.id,
        socket.userRole
      );

      if (result.success) {
        // Notify others in the room
        socket.to(`session-${sessionId}`).emit("participant-joined", {
          odId: socket.userId,
          name: socket.userName,
          role: socket.userRole,
          participantCount: result.participantCount,
        });

        console.log(`➡️ ${socket.userName} joined session ${sessionId}`);
      }
    } catch (error) {
      console.error("Error joining session:", error);
    }
  });

  // Leave a session room
  socket.on("leave-session", async (sessionId) => {
    try {
      socket.leave(`session-${sessionId}`);

      const result = await sessionManager.removeParticipant(
        sessionId,
        socket.userId
      );

      if (result.success) {
        socket.to(`session-${sessionId}`).emit("participant-left", {
          odId: socket.userId,
          name: socket.userName,
          participantCount: result.participantCount,
        });

        console.log(`⬅️ ${socket.userName} left session ${sessionId}`);
      }
    } catch (error) {
      console.error("Error leaving session:", error);
    }
  });

  // Heartbeat to keep session/connection alive
  socket.on("heartbeat", async ({ sessionId }) => {
    try {
      await sessionManager.recordHeartbeat(sessionId, socket.userId);
    } catch (error) {
      console.error("Heartbeat error:", error);
    }
  });

  // Handle disconnect - remove from session
  socket.on("disconnect", async () => {
    console.log(`🔌 User disconnected: ${socket.userId}`);

    if (socket.sessionId) {
      try {
        const result = await sessionManager.removeParticipant(
          socket.sessionId,
          socket.userId
        );

        if (result.success) {
          io.to(`session-${socket.sessionId}`).emit("participant-left", {
            odId: socket.userId,
            name: socket.userName,
            participantCount: result.participantCount,
            wasTeacher: result.wasTeacher,
          });
        }
      } catch (error) {
        console.error("Error handling disconnect:", error);
      }
    }
  });
});

// **3. Set up io for routes**
app.set("io", io);
app.io = io;

// **4. Middleware** (order is important!)

// ✅ ADDED: Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for file uploads
    crossOriginEmbedderPolicy: false,
  })
);

// ✅ ADDED: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Limit login attempts
  message: "Too many login attempts, please try again later.",
  skipSuccessfulRequests: true,
});

app.use("/api/", limiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Session middleware
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true, // ✅ ADDED: Prevent XSS
      sameSite: "strict", // ✅ ADDED: CSRF protection
      maxAge: 10 * 60 * 1000, // 10 minutes
    },
  })
);

// ============================================
// CORS CONFIGURATION - Dynamic based on environment
// ============================================
const isProduction = process.env.NODE_ENV === "production";

// Production: Only allow configured frontend URL
// Development: Allow localhost and Capacitor
const allowedOrigins = isProduction
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "https://localhost:3000",
      "https://localhost:3001",
      "http://10.159.178.5:3000",
      "https://10.159.178.5:3000",
      "capacitor://localhost",
      "http://localhost",
      process.env.FRONTEND_URL,
    ].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development, log but allow anyway
      if (!isProduction) {
        console.warn(`⚠️ CORS: Allowing unlisted origin in dev: ${origin}`);
        return callback(null, true);
      }

      // In production, block unauthorized origins
      console.error(`❌ CORS: Blocked origin: ${origin}`);
      return callback(new Error("CORS not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "x-request-id",
    ],
  })
);

// Body parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ✅ ADDED: Request logging middleware (only in development)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// **5. Health Check Endpoint** (before auth-protected routes)
app.get("/api/health", async (req, res) => {
  const dbHealth = dbService.getHealth();
  const queueHealth = await queueService.getHealth();
  const uptime = process.uptime();

  res.status(dbHealth.connected ? 200 : 503).json({
    status: dbHealth.connected ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    database: dbHealth,
    queue: queueHealth,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
    },
  });
});

// **6. Routes** (in correct order)

// Auth routes (must be before other protected routes)
app.use("/api/auth", require("./routes/biometricAuth"));

// Import all other routes
const classRoutes = require("./routes/classRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const attendanceRoutes = require("./routes/attendance");
let biometricRoutes;
try {
  biometricRoutes = require("./routes/biometric");
} catch (err) {
  console.warn(
    "⚠️  Biometric routes not available - face detection dependency issue:",
    err.message
  );
  biometricRoutes = (req, res) => {
    res.status(503).json({
      status: "error",
      message: "Biometric service temporarily unavailable",
    });
  };
}

const bleRoutes = require("./routes/ble");
const dashboardRoutes = require("./routes/dashboard");
const logsRoutes = require("./routes/logs");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

// Mount routes
app.use("/api/classes", classRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/biometric", biometricRoutes);
app.use("/api/ble", bleRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/settings", settingsRoutes);

// ⚠️ TEST ROUTES - ONLY ENABLED IN DEVELOPMENT
if (process.env.NODE_ENV !== "production") {
  const testRoutes = require("./routes/testRoutes");
  app.use("/api/test", testRoutes);
  console.log("⚠️  Test routes enabled (development mode only)");
} else {
  console.log("🔒 Test routes disabled (production mode)");
}

// **7. Global Error Handler** (must be after all routes)
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);
console.log("✅ Global error handler registered");

// **8. Database Connection & Server Startup**

const startServer = async () => {
  try {
    // Connect to Database first
    await dbService.connect();

    // Initialize cache service (can work without Redis)
    await cacheService.initialize();
    console.log("📦 Cache service initialized");
    console.log(`   └─ Type: ${cacheService.getStats().redis.type}`);

    // Initialize attendance queue service (requires Redis)
    await queueService.initialize(io);
    console.log("📬 Attendance queue service initialized");

    // Start Server only after successful DB connection
    const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => {
      console.log("\n" + "=".repeat(50));
      console.log("🚀 AttendSmart Server Started Successfully!");
      console.log("=".repeat(50));
      console.log(`📍 Server running on: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔌 Socket.IO enabled on port: ${PORT}`);

      // ========== INITIALIZE SESSION CLEANUP JOB ==========
      initSessionCleanupJob();
      console.log("🧹 Session cleanup job initialized");

      console.log("=".repeat(50) + "\n");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// **11. Graceful Shutdown Handlers**
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️  ${signal} signal received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log("✅ HTTP server closed");

    try {
      // Close queue service first (drain pending jobs)
      await queueService.shutdown();

      // Close database connection
      await dbService.disconnect();

      // Close Socket.IO
      io.close(() => {
        console.log("✅ Socket.IO closed");
        console.log("👋 Graceful shutdown completed");
        process.exit(0);
      });
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle unhandled rejections - PROPERLY shutdown to prevent zombie processes
process.on("unhandledRejection", (err) => {
  console.error("❌ UNHANDLED REJECTION! 💥 Shutting down...");
  console.error(err.name, err.message);
  if (process.env.NODE_ENV === "development") {
    console.error(err.stack);
  }

  // Gracefully close server, then exit
  // Let Docker/PM2 restart the server fresh
  server.close(() => {
    console.error("💀 Server closed due to unhandled rejection");
    process.exit(1);
  });

  // Force exit if server doesn't close in 10 seconds
  setTimeout(() => {
    console.error("💀 Forcing exit after timeout");
    process.exit(1);
  }, 10000);
});

// Track uncaught exceptions to prevent crash loops
let uncaughtExceptionCount = 0;
const MAX_UNCAUGHT_EXCEPTIONS = 5;
let lastExceptionTime = Date.now();

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION!");
  console.error(err.name, err.message);
  if (process.env.NODE_ENV === "development") {
    console.error(err.stack);
  }

  const now = Date.now();

  // Reset counter if more than 1 minute has passed since last exception
  if (now - lastExceptionTime > 60000) {
    uncaughtExceptionCount = 0;
  }

  uncaughtExceptionCount++;
  lastExceptionTime = now;

  // Critical errors that should always cause shutdown
  const criticalErrors = ["EADDRINUSE", "EACCES", "EMFILE", "ENFILE", "ENOSPC"];
  const isCriticalError = criticalErrors.some(
    (code) => err.code === code || err.message?.includes(code)
  );

  if (isCriticalError) {
    console.error("💀 Critical error - shutting down...");
    process.exit(1);
  }

  // Too many exceptions in short time - something is very wrong
  if (uncaughtExceptionCount >= MAX_UNCAUGHT_EXCEPTIONS) {
    console.error(
      `💀 Too many exceptions (${uncaughtExceptionCount}) - shutting down for safety`
    );
    process.exit(1);
  }

  // Non-critical error - log and continue
  console.warn(
    `⚠️ Server continuing despite uncaught exception (${uncaughtExceptionCount}/${MAX_UNCAUGHT_EXCEPTIONS})`
  );
  console.warn(
    "⚠️ This error has been logged but the server will try to continue"
  );
});

// **Exports**
module.exports = { app, server, io };
