import { CreditTransaction } from "../models/CreditTransaction";
import { Workout } from "../models/Workout";
import { User } from "../models/User";
import { Database } from "../config/database";
import logger from "../utils/simpleLogger";

export class CreditService {
  private redis = Database.getInstance().getRedisClient();

  private calculateEvidenceBasedRatio(workoutType: string): number {
    // Evidence-based conversion ratios (WHO research-backed, same as iOS/Extension)
    const workoutTypeLower = workoutType.toLowerCase();

    if (workoutTypeLower.includes("walk") || workoutTypeLower.includes("hik")) {
      return 8; // 8 minutes coding per 1 minute walk (light movement)
    } else if (
      workoutTypeLower.includes("run") ||
      workoutTypeLower.includes("cycl") ||
      workoutTypeLower.includes("swim")
    ) {
      return 12; // 12 minutes coding per 1 minute cardio (moderate-vigorous)
    } else if (
      workoutTypeLower.includes("strength") ||
      workoutTypeLower.includes("weight") ||
      workoutTypeLower.includes("functional")
    ) {
      return 15; // 15 minutes coding per 1 minute strength (high effort)
    } else if (
      workoutTypeLower.includes("hiit") ||
      workoutTypeLower.includes("interval") ||
      workoutTypeLower.includes("cross")
    ) {
      return 18; // 18 minutes coding per 1 minute HIIT (maximum effort)
    } else if (
      workoutTypeLower.includes("yoga") ||
      workoutTypeLower.includes("pilates")
    ) {
      return 10; // 10 minutes coding per 1 minute mindful movement
    } else {
      return 12; // 12 minutes default (moderate activity)
    }
  }

  async calculateCreditsForWorkout(
    userId: string,
    workoutId: string,
    customCreditRatio?: number
  ): Promise<number> {
    const user = await User.findById(userId);
    const workout = await Workout.findById(workoutId);

    if (!user || !workout) {
      throw new Error("User or workout not found");
    }

    // Use evidence-based calculation if workout type is available, otherwise use custom ratio or user setting
    let creditRatio: number;
    if (workout.type && !customCreditRatio) {
      creditRatio = this.calculateEvidenceBasedRatio(workout.type);
    } else {
      creditRatio = customCreditRatio ?? user.settings.workoutCreditRatio;
    }

    // Base credits = workout duration * credit ratio
    const baseCredits = Math.floor(workout.duration * creditRatio);

    // Apply daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCredits = await this.getTotalCreditsEarned(userId, today);
    const remainingDaily = Math.max(
      0,
      user.settings.maxDailyCredits - todayCredits
    );

    return Math.min(baseCredits, remainingDaily);
  }

  async awardCredits(
    userId: string,
    workoutId: string,
    customCreditRatio?: number
  ): Promise<number> {
    const credits = await this.calculateCreditsForWorkout(
      userId,
      workoutId,
      customCreditRatio
    );

    if (credits <= 0) {
      return 0;
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Create credit transaction
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + user.settings.creditExpiration);

    const transaction = new CreditTransaction({
      userId,
      type: "earned",
      amount: credits,
      workoutId,
      reason: `Workout completed: ${credits} minutes earned`,
      expiresAt,
    });

    await transaction.save();

    // Mark workout as processed
    await Workout.findByIdAndUpdate(workoutId, { processed: true });

    // Update Redis cache
    await this.updateCreditCache(userId);

    logger.info(
      `Awarded ${credits} credits to user ${userId} for workout ${workoutId}`
    );
    return credits;
  }

  async spendCredits(
    userId: string,
    minutes: number,
    reason: string = "Coding session"
  ): Promise<boolean> {
    const availableCredits = await this.getAvailableCredits(userId);

    if (availableCredits < minutes) {
      return false;
    }

    // Create spending transaction
    const transaction = new CreditTransaction({
      userId,
      type: "spent",
      amount: -minutes,
      reason,
    });

    await transaction.save();

    // Update Redis cache
    await this.updateCreditCache(userId);

    logger.info(`User ${userId} spent ${minutes} credits: ${reason}`);
    return true;
  }

  async useEmergencyCredits(userId: string, minutes: number): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const usedEmergency = await this.getUsedEmergencyCredits(userId);
    const availableEmergency = user.settings.emergencyCredits - usedEmergency;

    if (availableEmergency < minutes) {
      return false;
    }

    // Create emergency transaction
    const transaction = new CreditTransaction({
      userId,
      type: "emergency",
      amount: -minutes,
      reason: "Emergency unlock",
    });

    await transaction.save();

    // Update Redis cache
    await this.updateCreditCache(userId);

    logger.info(`User ${userId} used ${minutes} emergency credits`);
    return true;
  }

  async getAvailableCredits(userId: string): Promise<number> {
    // Try Redis cache first (if available)
    if (this.redis) {
      try {
        const cached = await this.redis.get(`credits:${userId}`);
        if (cached) {
          return parseInt(cached, 10);
        }
      } catch (error) {
        logger.warn("Redis cache read failed, falling back to database");
      }
    }

    // Calculate from database
    const credits = await this.calculateAvailableCredits(userId);

    // Cache for 5 minutes (if Redis is available)
    if (this.redis) {
      try {
        await this.redis.setEx(`credits:${userId}`, 300, credits.toString());
      } catch (error) {
        logger.warn("Redis cache write failed");
      }
    }

    return credits;
  }

  private async calculateAvailableCredits(userId: string): Promise<number> {
    const now = new Date();

    // Get all non-expired earned credits
    const earnedCredits = await CreditTransaction.aggregate([
      {
        $match: {
          userId,
          type: "earned",
          $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }],
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Get all spent credits
    const spentCredits = await CreditTransaction.aggregate([
      {
        $match: {
          userId,
          type: "spent",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const earned = earnedCredits[0]?.total || 0;
    const spent = Math.abs(spentCredits[0]?.total || 0);

    return Math.max(0, earned - spent);
  }

  private async getTotalCreditsEarned(
    userId: string,
    since: Date
  ): Promise<number> {
    const result = await CreditTransaction.aggregate([
      {
        $match: {
          userId,
          type: "earned",
          timestamp: { $gte: since },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    return result[0]?.total || 0;
  }

  private async getUsedEmergencyCredits(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await CreditTransaction.aggregate([
      {
        $match: {
          userId,
          type: "emergency",
          timestamp: { $gte: today },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    return Math.abs(result[0]?.total || 0);
  }

  async getTotalEarned(userId: string): Promise<number> {
    const result = await CreditTransaction.aggregate([
      {
        $match: {
          userId,
          type: "earned",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    return result[0]?.total || 0;
  }

  async getTotalSpent(userId: string): Promise<number> {
    const result = await CreditTransaction.aggregate([
      {
        $match: {
          userId,
          type: "spent",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    return Math.abs(result[0]?.total || 0);
  }

  private async updateCreditCache(userId: string): Promise<void> {
    if (this.redis) {
      try {
        const credits = await this.calculateAvailableCredits(userId);
        await this.redis.setEx(`credits:${userId}`, 300, credits.toString());
      } catch (error) {
        logger.warn("Failed to update credit cache");
      }
    }
  }

  async expireCredits(): Promise<void> {
    const now = new Date();

    // Find expired credits that haven't been marked as expired
    const expiredCredits = await CreditTransaction.find({
      type: "earned",
      expiresAt: { $lt: now },
      // Only credits that haven't been processed for expiration
      $or: [{ processed: { $exists: false } }, { processed: false }],
    });

    for (const credit of expiredCredits) {
      // Create expiration transaction
      const expiration = new CreditTransaction({
        userId: credit.userId,
        type: "expired",
        amount: -credit.amount,
        reason: `Credits expired from workout on ${credit.timestamp.toDateString()}`,
      });

      await expiration.save();

      // Mark original credit as processed
      credit.processed = true;
      await credit.save();

      // Update cache
      await this.updateCreditCache(credit.userId);
    }

    if (expiredCredits.length > 0) {
      logger.info(`Expired ${expiredCredits.length} credit transactions`);
    }
  }
}
