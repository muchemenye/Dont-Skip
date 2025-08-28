import mongoose from "mongoose";
import { createClient } from "redis";
import logger from "../utils/simpleLogger";

export class Database {
  private static instance: Database;
  private mongoConnection?: typeof mongoose;
  private redisClient?: ReturnType<typeof createClient>;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connectMongo(): Promise<void> {
    try {
      const mongoUri =
        process.env.MONGODB_URI || "mongodb://localhost:27017/workout-lockout";

      this.mongoConnection = await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      logger.info("Connected to MongoDB");
    } catch (error) {
      logger.error("MongoDB connection error:", error);
      throw error;
    }
  }

  async connectRedis(): Promise<void> {
    // Skip Redis if disabled
    if (process.env.REDIS_ENABLED === "false") {
      logger.info("Redis disabled - skipping connection");
      return;
    }

    try {
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

      this.redisClient = createClient({ url: redisUrl });

      this.redisClient.on("error", (err) => {
        logger.error("Redis Client Error:", err);
      });

      await this.redisClient.connect();
      logger.info("Connected to Redis");
    } catch (error) {
      logger.warn("Redis connection failed - continuing without Redis:", error);
      // Don't throw error - allow app to continue without Redis
    }
  }

  getRedisClient() {
    if (!this.redisClient) {
      logger.warn("Redis client not available - using memory fallback");
      return null;
    }
    return this.redisClient;
  }

  isRedisAvailable(): boolean {
    return this.redisClient !== undefined && this.redisClient.isOpen;
  }

  async disconnect(): Promise<void> {
    if (this.mongoConnection) {
      await mongoose.disconnect();
      logger.info("Disconnected from MongoDB");
    }

    if (this.redisClient) {
      await this.redisClient.quit();
      logger.info("Disconnected from Redis");
    }
  }
}
