import { Router, Response } from "express";
import { FitnessIntegration } from "../models/FitnessIntegration";
import { EncryptionService } from "../utils/encryption";
import { authenticateToken } from "../middleware/auth";
import { authLimiter } from "../middleware/security";
import { AuthRequest } from "../types";
import logger from "../utils/simpleLogger";

const router = Router();

// Get user's integrations
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const integrations = await FitnessIntegration.find({ userId });

    res.json({
      success: true,
      data: integrations, // Tokens are automatically excluded in toJSON
    });
  } catch (error) {
    logger.error("Error fetching integrations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch integrations",
    });
  }
});

// Connect new integration
router.post(
  "/connect",
  authenticateToken,
  authLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { provider, accessToken, refreshToken, tokenExpiry } = req.body;

      if (!provider || !accessToken) {
        return res.status(400).json({
          success: false,
          error: "Provider and access token are required",
        });
      }

      if (!["whoop", "strava", "fitbit"].includes(provider)) {
        return res.status(400).json({
          success: false,
          error: "Invalid provider",
        });
      }

      // Check if integration already exists
      const existing = await FitnessIntegration.findOne({ userId, provider });

      if (existing) {
        // Update existing integration
        existing.accessToken = EncryptionService.encrypt(accessToken);
        if (refreshToken) {
          existing.refreshToken = EncryptionService.encrypt(refreshToken);
        }
        if (tokenExpiry) {
          existing.tokenExpiry = new Date(tokenExpiry);
        }
        existing.isActive = true;
        existing.lastSync = new Date();

        await existing.save();

        res.json({
          success: true,
          data: existing.toJSON(),
          message: `Updated ${provider} integration`,
        });
      } else {
        // Create new integration
        const integration = new FitnessIntegration({
          userId,
          provider,
          accessToken: EncryptionService.encrypt(accessToken),
          refreshToken: refreshToken
            ? EncryptionService.encrypt(refreshToken)
            : undefined,
          tokenExpiry: tokenExpiry ? new Date(tokenExpiry) : undefined,
          isActive: true,
        });

        await integration.save();

        res.status(201).json({
          success: true,
          data: integration.toJSON(),
          message: `Connected ${provider} integration`,
        });
      }
    } catch (error) {
      logger.error("Error connecting integration:", error);
      res.status(500).json({
        success: false,
        error: "Failed to connect integration",
      });
    }
  }
);

// Disconnect integration
router.delete(
  "/:provider",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { provider } = req.params;

      const integration = await FitnessIntegration.findOne({
        userId,
        provider,
      });

      if (!integration) {
        return res.status(404).json({
          success: false,
          error: "Integration not found",
        });
      }

      await FitnessIntegration.findByIdAndDelete(integration.id);

      res.json({
        success: true,
        message: `Disconnected ${provider} integration`,
      });
    } catch (error) {
      logger.error("Error disconnecting integration:", error);
      res.status(500).json({
        success: false,
        error: "Failed to disconnect integration",
      });
    }
  }
);

// Test integration connection
router.post(
  "/:provider/test",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { provider } = req.params;

      const integration = await FitnessIntegration.findOne({
        userId,
        provider,
        isActive: true,
      });

      if (!integration) {
        return res.status(404).json({
          success: false,
          error: "Integration not found or inactive",
        });
      }

      // Test the connection by making a simple API call
      const accessToken = EncryptionService.decrypt(integration.accessToken);
      let testResult = false;
      let errorMessage = "";

      try {
        switch (provider) {
          case "whoop":
            const whoopResponse = await fetch(
              "https://api.prod.whoop.com/developer/v1/user/profile/basic",
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            testResult = whoopResponse.ok;
            break;

          case "strava":
            const stravaResponse = await fetch(
              "https://www.strava.com/api/v3/athlete",
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            testResult = stravaResponse.ok;
            break;

          case "fitbit":
            const fitbitResponse = await fetch(
              "https://api.fitbit.com/1/user/-/profile.json",
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            testResult = fitbitResponse.ok;
            break;
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Unknown error";
      }

      if (!testResult) {
        // Deactivate integration if test fails
        integration.isActive = false;
        await integration.save();
      }

      res.json({
        success: testResult,
        data: {
          provider,
          connected: testResult,
          lastSync: integration.lastSync,
        },
        error: testResult
          ? undefined
          : errorMessage || "Connection test failed",
      });
    } catch (error) {
      logger.error("Error testing integration:", error);
      res.status(500).json({
        success: false,
        error: "Failed to test integration",
      });
    }
  }
);

export default router;
