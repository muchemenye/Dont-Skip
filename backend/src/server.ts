import express from "express";
import dotenv from "dotenv";
import { Database } from "./config/database";
import { EncryptionService } from "./utils/encryption";
import { CreditService } from "./services/CreditService";
import { DataCleanupService } from "./services/DataCleanupService";
import { SecurityMonitor } from "./utils/securityLogger";
import logger from "./utils/simpleLogger";

// Import middleware
import {
  generalLimiter,
  securityHeaders,
  corsOptions,
  requestLogger,
} from "./middleware/security";

// Import routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import workoutRoutes from "./routes/workouts";
import creditRoutes from "./routes/credits";
import integrationRoutes from "./routes/integrations";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
async function initializeServices() {
  try {
    // Initialize encryption
    EncryptionService.initialize();

    // Connect to databases
    const db = Database.getInstance();
    await db.connectMongo();
    await db.connectRedis();

    logger.info("All services initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize services:", error);
    process.exit(1);
  }
}

// Middleware setup
app.use(securityHeaders);
app.use(corsOptions);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestLogger);
app.use(generalLimiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    },
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/credits", creditRoutes);
app.use("/api/integrations", integrationRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

// Global error handler
app.use(
  (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error:", error);

    res.status(500).json({
      success: false,
      error:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : error.message,
    });
  }
);

// Background tasks
function startBackgroundTasks() {
  const creditService = new CreditService();
  const dataCleanupService = new DataCleanupService();

  // Expire credits every hour
  setInterval(async () => {
    try {
      await creditService.expireCredits();
    } catch (error) {
      logger.error("Error in credit expiration task:", error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Data cleanup every 24 hours
  setInterval(async () => {
    try {
      await dataCleanupService.cleanupExpiredData();

      // Log data statistics
      const stats = await dataCleanupService.getDataStats();
      if (stats) {
        logger.info("Data retention stats:", stats);
      }
    } catch (error) {
      logger.error("Error in data cleanup task:", error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  // Security monitoring - log system health
  setInterval(() => {
    SecurityMonitor.logEvent({
      event: "system_health_check",
      success: true,
      riskLevel: "low",
      details: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date(),
      },
    });
  }, 60 * 60 * 1000); // 1 hour

  logger.info("Background tasks started");
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");

  try {
    const db = Database.getInstance();
    await db.disconnect();
    logger.info("Database connections closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");

  try {
    const db = Database.getInstance();
    await db.disconnect();
    logger.info("Database connections closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
});

// Start server
async function startServer() {
  try {
    await initializeServices();

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    });

    startBackgroundTasks();
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
