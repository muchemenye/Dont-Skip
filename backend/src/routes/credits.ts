import { Router, Response } from "express";
import { CreditTransaction } from "../models/CreditTransaction";
import { CreditService } from "../services/CreditService";
import { authenticateToken } from "../middleware/auth";
import { AuthRequest } from "../types";
import logger from "../utils/simpleLogger";

const router = Router();
const creditService = new CreditService();

// Get current credit balance
router.get(
  "/balance",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const availableCredits = await creditService.getAvailableCredits(userId);
      const totalEarned = await creditService.getTotalEarned(userId);
      const totalSpent = await creditService.getTotalSpent(userId);

      res.json({
        success: true,
        data: {
          availableCredits,
          emergencyCredits: req.user!.settings.emergencyCredits,
          totalEarned,
          totalSpent,
          lastUpdated: new Date(),
        },
      });
    } catch (error) {
      logger.error("Error fetching credit balance:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch credit balance",
      });
    }
  }
);

// Get credit transaction history
router.get(
  "/transactions",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { limit = 50, offset = 0 } = req.query;

      const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
      const offsetNum = parseInt(offset as string, 10) || 0;

      const transactions = await CreditTransaction.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limitNum)
        .skip(offsetNum)
        .populate("workoutId", "type startTime duration source");

      const total = await CreditTransaction.countDocuments({ userId });

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            total,
            limit: limitNum,
            offset: offsetNum,
            hasMore: offsetNum + limitNum < total,
          },
        },
      });
    } catch (error) {
      logger.error("Error fetching credit transactions:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch credit transactions",
      });
    }
  }
);

// Spend credits (for coding session)
router.post(
  "/spend",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { minutes, reason = "Coding session" } = req.body;

      if (!minutes || minutes <= 0 || minutes > 480) {
        return res.status(400).json({
          success: false,
          error: "Minutes must be between 1 and 480",
        });
      }

      const success = await creditService.spendCredits(userId, minutes, reason);

      if (!success) {
        return res.status(402).json({
          success: false,
          error: "Insufficient credits",
        });
      }

      const remainingCredits = await creditService.getAvailableCredits(userId);

      res.json({
        success: true,
        data: {
          spent: minutes,
          remaining: remainingCredits,
          message: `Spent ${minutes} credits for ${reason}`,
        },
      });
    } catch (error) {
      logger.error("Error spending credits:", error);
      res.status(500).json({
        success: false,
        error: "Failed to spend credits",
      });
    }
  }
);

// Use emergency credits
router.post(
  "/emergency",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { minutes } = req.body;

      if (!minutes || minutes <= 0 || minutes > 60) {
        return res.status(400).json({
          success: false,
          error: "Emergency minutes must be between 1 and 60",
        });
      }

      const success = await creditService.useEmergencyCredits(userId, minutes);

      if (!success) {
        return res.status(402).json({
          success: false,
          error: "Insufficient emergency credits",
        });
      }

      res.json({
        success: true,
        data: {
          emergencyUsed: minutes,
          message: `Used ${minutes} emergency credits`,
        },
      });
    } catch (error) {
      logger.error("Error using emergency credits:", error);
      res.status(500).json({
        success: false,
        error: "Failed to use emergency credits",
      });
    }
  }
);

// Get credit statistics
router.get(
  "/stats",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { days = 7 } = req.query;

      const daysNum = Math.min(parseInt(days as string, 10) || 7, 30);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      // Get daily credit statistics
      const dailyStats = await CreditTransaction.aggregate([
        {
          $match: {
            userId,
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
              },
              type: "$type",
            },
            total: { $sum: "$amount" },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            earned: {
              $sum: {
                $cond: [{ $eq: ["$_id.type", "earned"] }, "$total", 0],
              },
            },
            spent: {
              $sum: {
                $cond: [{ $eq: ["$_id.type", "spent"] }, { $abs: "$total" }, 0],
              },
            },
            emergency: {
              $sum: {
                $cond: [
                  { $eq: ["$_id.type", "emergency"] },
                  { $abs: "$total" },
                  0,
                ],
              },
            },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      res.json({
        success: true,
        data: {
          dailyStats,
          period: `${daysNum} days`,
        },
      });
    } catch (error) {
      logger.error("Error fetching credit stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch credit statistics",
      });
    }
  }
);

export default router;
