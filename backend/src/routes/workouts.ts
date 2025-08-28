import { Router, Response } from "express";
import { Workout } from "../models/Workout";
import { CreditService } from "../services/CreditService";
import { FitnessApiService } from "../services/FitnessApiService";
import { authenticateToken } from "../middleware/auth";
import { syncLimiter, validateWorkout } from "../middleware/security";
import { AuthRequest } from "../types";
import logger from "../utils/simpleLogger";
import { Database } from "../config/database";

const router = Router();
const creditService = new CreditService();
const fitnessApiService = new FitnessApiService();

// Get recent workouts
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    logger.info(`GET /workouts called by user ${req.user!.id}`, {
      query: req.query,
      method: req.method,
      headers: req.headers,
    });

    const { hours = 24 } = req.query;
    const userId = req.user!.id;

    const hoursNum = parseInt(hours as string, 10);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) {
      return res.status(400).json({
        success: false,
        error: "Hours must be between 1 and 168",
      });
    }

    const cutoff = new Date(Date.now() - hoursNum * 60 * 60 * 1000);

    const workouts = await Workout.find({
      userId,
      startTime: { $gte: cutoff },
    }).sort({ startTime: -1 });

    res.json({
      success: true,
      data: workouts,
    });
  } catch (error) {
    logger.error("Error fetching workouts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch workouts",
    });
  }
});

// Sync workouts from fitness APIs
router.post(
  "/sync",
  authenticateToken,
  syncLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { hours = 24 } = req.body;
      const userId = req.user!.id;

      const hoursNum = parseInt(hours as string, 10);
      if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) {
        return res.status(400).json({
          success: false,
          error: "Hours must be between 1 and 168",
        });
      }

      const workouts = await fitnessApiService.syncUserWorkouts(
        userId,
        hoursNum
      );

      // Process new workouts for credits
      let totalCreditsAwarded = 0;
      for (const workout of workouts) {
        if (!workout.processed) {
          const credits = await creditService.awardCredits(userId, workout.id);
          totalCreditsAwarded += credits;
        }
      }

      res.json({
        success: true,
        data: {
          workouts,
          creditsAwarded: totalCreditsAwarded,
          message: `Synced ${workouts.length} workouts, awarded ${totalCreditsAwarded} credits`,
        },
      });
    } catch (error) {
      logger.error("Error syncing workouts:", error);
      res.status(500).json({
        success: false,
        error: "Failed to sync workouts",
      });
    }
  }
);

// Add manual workout
router.post(
  "/",
  authenticateToken,
  validateWorkout,
  async (req: AuthRequest, res: Response) => {
    try {
      logger.info(`POST /workouts called by user ${req.user!.id}`, {
        body: req.body,
        method: req.method,
        headers: req.headers,
      });

      const userId = req.user!.id;
      const workoutData = {
        ...req.body,
        userId,
        source: "manual" as const,
        verified: false,
        processed: false,
      };

      // Validate workout duration
      const startTime = new Date(workoutData.startTime);
      const endTime = new Date(workoutData.endTime);
      const calculatedDuration = Math.round(
        (endTime.getTime() - startTime.getTime()) / (1000 * 60)
      );

      if (Math.abs(calculatedDuration - workoutData.duration) > 5) {
        return res.status(400).json({
          success: false,
          error: "Duration does not match start and end times",
        });
      }

      // Check for duplicates
      const existing = await Workout.findOne({
        userId,
        startTime: { $gte: new Date(startTime.getTime() - 5 * 60 * 1000) },
        endTime: { $lte: new Date(endTime.getTime() + 5 * 60 * 1000) },
        duration: {
          $gte: workoutData.duration - 5,
          $lte: workoutData.duration + 5,
        },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: "Similar workout already exists",
        });
      }

      const workout = new Workout(workoutData);
      await workout.save();

      // Award credits for manual workout (with verification pending)
      const credits = await creditService.awardCredits(userId, workout.id);

      const workoutResponse = {
        ...workout.toJSON(),
        creditsAwarded: credits,
      };

      res.status(201).json({
        success: true,
        data: workoutResponse,
      });
    } catch (error) {
      logger.error("Error adding manual workout:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add workout",
      });
    }
  }
);

// Delete workout
router.delete(
  "/:workoutId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { workoutId } = req.params;
      const userId = req.user!.id;

      const workout = await Workout.findOne({ _id: workoutId, userId });

      if (!workout) {
        return res.status(404).json({
          success: false,
          error: "Workout not found",
        });
      }

      // Only allow deletion of manual workouts
      if (workout.source !== "manual") {
        return res.status(403).json({
          success: false,
          error: "Can only delete manual workouts",
        });
      }

      await Workout.findByIdAndDelete(workoutId);

      res.json({
        success: true,
        message: "Workout deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting workout:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete workout",
      });
    }
  }
);

// Reset user data (for testing only)
router.delete(
  "/reset/all",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      // Only allow in development/testing environment
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({
          success: false,
          error: "Reset not allowed in production",
        });
      }

      // Delete all user workouts
      await Workout.deleteMany({ userId });

      // Delete all user credit transactions
      const { CreditTransaction } = require("../models/CreditTransaction");
      await CreditTransaction.deleteMany({ userId });

      // Clear Redis cache
      const redis = Database.getInstance().getRedisClient();
      if (redis) {
        try {
          await redis.del(`credits:${userId}`);
        } catch (error) {
          logger.warn("Failed to clear Redis cache during reset");
        }
      }

      logger.info(`Reset all data for user ${userId}`);

      res.json({
        success: true,
        message: "All user data reset successfully",
      });
    } catch (error) {
      logger.error("Error resetting user data:", error);
      res.status(500).json({
        success: false,
        error: "Failed to reset user data",
      });
    }
  }
);

export default router;
