import { Workout } from "../models/Workout";
import { CreditTransaction } from "../models/CreditTransaction";
import { User } from "../models/User";
import { FitnessIntegration } from "../models/FitnessIntegration";
import logger from "../utils/simpleLogger";

export class DataCleanupService {
  // Minimal data retention - only keep what's necessary for the app to function

  async cleanupExpiredData(): Promise<void> {
    const now = new Date();

    try {
      // 1. Clean up old workouts (keep only last 30 days)
      const workoutCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const deletedWorkouts = await Workout.deleteMany({
        createdAt: { $lt: workoutCutoff },
      });

      if (deletedWorkouts.deletedCount > 0) {
        logger.info(`Cleaned up ${deletedWorkouts.deletedCount} old workouts`);
      }

      // 2. Clean up old credit transactions (keep only last 30 days)
      const creditCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const deletedCredits = await CreditTransaction.deleteMany({
        timestamp: { $lt: creditCutoff },
      });

      if (deletedCredits.deletedCount > 0) {
        logger.info(
          `Cleaned up ${deletedCredits.deletedCount} old credit transactions`
        );
      }

      // 3. Clean up inactive users (no activity for 90 days)
      const userCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const inactiveUsers = await User.find({
        lastActive: { $lt: userCutoff },
      });

      for (const user of inactiveUsers) {
        // Delete all user data
        await Promise.all([
          Workout.deleteMany({ userId: user.id }),
          CreditTransaction.deleteMany({ userId: user.id }),
          FitnessIntegration.deleteMany({ userId: user.id }),
          User.findByIdAndDelete(user.id),
        ]);

        logger.info(`Cleaned up inactive user: ${user.email}`, {
          userId: user.id,
        });
      }

      // 4. Clean up orphaned fitness integrations
      const orphanedIntegrations = await FitnessIntegration.deleteMany({
        userId: { $nin: await User.distinct("_id") },
      });

      if (orphanedIntegrations.deletedCount > 0) {
        logger.info(
          `Cleaned up ${orphanedIntegrations.deletedCount} orphaned integrations`
        );
      }
    } catch (error) {
      logger.error("Data cleanup error:", error);
    }
  }

  async anonymizeUserData(userId: string): Promise<void> {
    try {
      // For GDPR compliance - anonymize instead of delete if needed
      const anonymousEmail = `deleted-${Date.now()}@anonymous.local`;

      await User.findByIdAndUpdate(userId, {
        email: anonymousEmail,
        passwordHash: "deleted",
        passwordSalt: "deleted",
        mfaSecret: undefined,
        backupCodes: [],
        deviceId: `deleted-${Date.now()}`,
      });

      logger.info(`Anonymized user data for userId: ${userId}`);
    } catch (error) {
      logger.error("User anonymization error:", error);
      throw error;
    }
  }

  async deleteUserData(userId: string): Promise<void> {
    try {
      // Complete user data deletion
      await Promise.all([
        Workout.deleteMany({ userId }),
        CreditTransaction.deleteMany({ userId }),
        FitnessIntegration.deleteMany({ userId }),
        User.findByIdAndDelete(userId),
      ]);

      logger.info(`Completely deleted user data for userId: ${userId}`);
    } catch (error) {
      logger.error("User deletion error:", error);
      throw error;
    }
  }

  // Get data retention statistics
  async getDataStats(): Promise<any> {
    try {
      const [userCount, workoutCount, creditCount, integrationCount] =
        await Promise.all([
          User.countDocuments(),
          Workout.countDocuments(),
          CreditTransaction.countDocuments(),
          FitnessIntegration.countDocuments(),
        ]);

      const oldestWorkout = await Workout.findOne().sort({ createdAt: 1 });
      const newestWorkout = await Workout.findOne().sort({ createdAt: -1 });

      return {
        users: userCount,
        workouts: workoutCount,
        creditTransactions: creditCount,
        integrations: integrationCount,
        dataRange: {
          oldest: oldestWorkout?.createdAt,
          newest: newestWorkout?.createdAt,
        },
      };
    } catch (error) {
      logger.error("Data stats error:", error);
      return null;
    }
  }
}
