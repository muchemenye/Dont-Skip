import { Router, Response } from "express";
import { User } from "../models/User";
import { authenticateToken } from "../middleware/auth";
import { apiClientLimiter } from "../middleware/security";
import { AuthRequest } from "../types";
import logger from "../utils/simpleLogger";

const router = Router();

// Get user profile
router.get(
  "/profile",
  apiClientLimiter,
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      res.json({
        success: true,
        data: req.user!.toJSON(),
      });
    } catch (error) {
      logger.error("Error fetching user profile:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch user profile",
      });
    }
  }
);

// Update user settings
router.put(
  "/settings",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { settings } = req.body;

      if (!settings || typeof settings !== "object") {
        return res.status(400).json({
          success: false,
          error: "Settings object is required",
        });
      }

      // Validate settings
      const validSettings = {
        workoutCreditRatio: settings.workoutCreditRatio,
        maxDailyCredits: settings.maxDailyCredits,
        emergencyCredits: settings.emergencyCredits,
        creditExpiration: settings.creditExpiration,
        enabledIntegrations: settings.enabledIntegrations,
        lockoutEnabled: settings.lockoutEnabled,
        workoutTypes: settings.workoutTypes, // Add custom workout types
      };

      console.log("Valid settings object:", validSettings);

      // Validate ranges
      if (validSettings.workoutCreditRatio !== undefined) {
        if (
          validSettings.workoutCreditRatio < 0.1 ||
          validSettings.workoutCreditRatio > 10
        ) {
          return res.status(400).json({
            success: false,
            error: "Workout credit ratio must be between 0.1 and 10",
          });
        }
      }

      if (validSettings.maxDailyCredits !== undefined) {
        if (
          validSettings.maxDailyCredits < 60 ||
          validSettings.maxDailyCredits > 1440
        ) {
          return res.status(400).json({
            success: false,
            error: "Max daily credits must be between 60 and 1440 minutes",
          });
        }
      }

      if (validSettings.emergencyCredits !== undefined) {
        if (
          validSettings.emergencyCredits < 0 ||
          validSettings.emergencyCredits > 120
        ) {
          return res.status(400).json({
            success: false,
            error: "Emergency credits must be between 0 and 120 minutes",
          });
        }
      }

      if (validSettings.creditExpiration !== undefined) {
        if (
          validSettings.creditExpiration < 1 ||
          validSettings.creditExpiration > 168
        ) {
          return res.status(400).json({
            success: false,
            error: "Credit expiration must be between 1 and 168 hours",
          });
        }
      }

      // Validate workout types if provided
      if (validSettings.workoutTypes !== undefined) {
        if (!Array.isArray(validSettings.workoutTypes)) {
          return res.status(400).json({
            success: false,
            error: "Workout types must be an array",
          });
        }

        if (validSettings.workoutTypes.length > 20) {
          return res.status(400).json({
            success: false,
            error: "Maximum 20 custom workout types allowed",
          });
        }

        for (const workoutType of validSettings.workoutTypes) {
          if (!workoutType.name || typeof workoutType.name !== "string") {
            return res.status(400).json({
              success: false,
              error: "Workout type name is required and must be a string",
            });
          }

          if (
            typeof workoutType.minDuration !== "number" ||
            workoutType.minDuration < 1 ||
            workoutType.minDuration > 480
          ) {
            return res.status(400).json({
              success: false,
              error: "Workout type duration must be between 1 and 480 minutes",
            });
          }

          if (
            typeof workoutType.codingHoursEarned !== "number" ||
            workoutType.codingHoursEarned < 0 ||
            workoutType.codingHoursEarned > 24
          ) {
            return res.status(400).json({
              success: false,
              error: "Coding hours earned must be between 0 and 24 hours",
            });
          }
        }
      }

      // Update user settings - fetch current user first to get latest settings
      const currentUser = await User.findById(userId);
      if (!currentUser) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Convert Mongoose settings document to plain object to avoid merging issues
      const currentSettings = currentUser.settings?.toObject() || {};
      const updatedSettings = { ...currentSettings, ...validSettings };

      const user = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            settings: updatedSettings,
            lastActive: new Date(),
          },
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: user.toJSON(),
        message: "Settings updated successfully",
      });
    } catch (error) {
      logger.error("Error updating user settings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update settings",
      });
    }
  }
);

// Delete user account
router.delete(
  "/account",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { confirmEmail } = req.body;

      if (confirmEmail !== req.user!.email) {
        return res.status(400).json({
          success: false,
          error: "Email confirmation does not match",
        });
      }

      // Delete user and all related data
      await Promise.all([
        User.findByIdAndDelete(userId),
        // Note: In production, you might want to soft delete or archive data
        // for compliance/audit purposes
      ]);

      res.json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting user account:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete account",
      });
    }
  }
);

export default router;
