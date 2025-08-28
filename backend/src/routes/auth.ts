import { Router, Request, Response } from "express";
import { User } from "../models/User";
import { generateToken, authenticateToken } from "../middleware/auth";
import {
  validateDeviceId,
  validateEmail,
  validateRequest,
} from "../middleware/security";
import { AuthService } from "../utils/auth";
import logger from "../utils/simpleLogger";
import { body } from "express-validator";
import { AuthRequest } from "../types";

const router = Router();

// Validation middleware
const validatePassword = [
  body("password")
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must be 8+ chars with uppercase, lowercase, number, and special character"
    ),
  validateRequest,
];

const validateMFA = [
  body("mfaToken")
    .optional()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage("MFA token must be 6 digits"),
  body("backupCode")
    .optional()
    .isLength({ min: 8, max: 8 })
    .matches(/^[A-F0-9]{8}$/)
    .withMessage("Backup code must be 8 hex characters"),
  validateRequest,
];

// Register new user
router.post(
  "/register",
  validateEmail,
  validatePassword,
  validateDeviceId,
  async (req: Request, res: Response) => {
    try {
      const { email, password, deviceId } = req.body;

      // Check rate limiting
      const rateLimit = AuthService.checkAuthRateLimit(email);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          error: "Too many registration attempts. Try again in 15 minutes.",
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: "User already exists",
        });
      }

      // Hash password
      const { hash, salt } = await AuthService.hashPassword(password);

      // Create user
      const user = new User({
        email,
        passwordHash: hash,
        passwordSalt: salt,
        deviceIds: [deviceId], // Initialize with first device
        deviceId, // Keep for backward compatibility
        settings: {
          workoutCreditRatio: 12.0, // Evidence-based default (moderate activity)
          maxDailyCredits: 480,
          emergencyCredits: 30,
          creditExpiration: 48,
          enabledIntegrations: [],
          lockoutEnabled: true,
        },
      });

      await user.save();

      // Generate token
      const token = generateToken(user.id, deviceId);

      // Reset rate limit on success
      AuthService.resetAuthRateLimit(email);

      logger.info(`New user registered: ${email}`, {
        userId: user.id,
        deviceId,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        data: {
          token,
          user: user.toJSON(),
          mfaRequired: false,
        },
      });
    } catch (error) {
      logger.error("Registration error:", error);
      res.status(500).json({
        success: false,
        error: "Registration failed",
      });
    }
  }
);

// Login user
router.post(
  "/login",
  validateEmail,
  validatePassword,
  validateMFA,
  validateDeviceId,
  async (req: Request, res: Response) => {
    try {
      const { email, password, deviceId, mfaToken, backupCode } = req.body;

      // Check rate limiting
      const rateLimit = AuthService.checkAuthRateLimit(email);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          error: "Too many login attempts. Try again in 15 minutes.",
        });
      }

      // Find user with sensitive fields
      const user = await User.findOne({ email }).select(
        "+passwordHash +passwordSalt +mfaSecret +backupCodes"
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return res.status(423).json({
          success: false,
          error: "Account temporarily locked due to failed attempts",
        });
      }

      // Verify password
      const passwordValid = await AuthService.verifyPassword(
        password,
        user.passwordHash,
        user.passwordSalt
      );

      if (!passwordValid) {
        // Increment failed attempts
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

        // Lock account after 5 failed attempts
        if (user.failedLoginAttempts >= 5) {
          user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        }

        await user.save();

        logger.warn("Failed login attempt", {
          email,
          deviceId,
          ip: req.ip,
          attempts: user.failedLoginAttempts,
        });

        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      // Check MFA if enabled
      if (user.mfaEnabled) {
        let mfaValid = false;

        if (mfaToken && user.mfaSecret) {
          mfaValid = AuthService.verifyMFAToken(mfaToken, user.mfaSecret);
        } else if (backupCode) {
          const result = AuthService.verifyBackupCode(
            backupCode,
            user.backupCodes
          );
          if (result.valid) {
            mfaValid = true;
            user.backupCodes = result.remainingCodes;
            await user.save();
          }
        }

        if (!mfaValid) {
          return res.status(401).json({
            success: false,
            error: "Invalid MFA token",
            mfaRequired: true,
          });
        }
      }

      // Add device ID to user's device list if not already present
      const userDeviceIds = user.deviceIds || [];

      // Migrate legacy deviceId if needed
      if (user.deviceId && !userDeviceIds.includes(user.deviceId)) {
        userDeviceIds.push(user.deviceId);
      }

      // Add new device if not already in list
      if (!userDeviceIds.includes(deviceId)) {
        userDeviceIds.push(deviceId);

        // Limit to 5 devices max
        if (userDeviceIds.length > 5) {
          userDeviceIds.shift(); // Remove oldest device
        }
      }

      // Update user with new device list
      user.deviceIds = userDeviceIds;
      user.deviceId = deviceId; // Keep for backward compatibility

      // Reset failed attempts and update last active
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
      user.lastActive = new Date();
      await user.save();

      // Generate token
      const token = generateToken(user.id, deviceId);

      // Reset rate limit on success
      AuthService.resetAuthRateLimit(email);

      logger.info(`User logged in: ${email}`, {
        userId: user.id,
        deviceId,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: {
          token,
          user: user.toJSON(),
          mfaRequired: false,
        },
      });
    } catch (error) {
      logger.error("Login error:", error);
      res.status(500).json({
        success: false,
        error: "Login failed",
      });
    }
  }
);

// Setup MFA
router.post(
  "/mfa/setup",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;

      if (user.mfaEnabled) {
        return res.status(400).json({
          success: false,
          error: "MFA already enabled",
        });
      }

      const mfaData = AuthService.generateMFASecret(user.email);

      // Store secret temporarily (user must verify before enabling)
      await User.findByIdAndUpdate(user.id, {
        mfaSecret: mfaData.secret,
        backupCodes: mfaData.backupCodes,
      });

      res.json({
        success: true,
        data: {
          qrCode: mfaData.qrCode,
          backupCodes: mfaData.backupCodes,
          message:
            "Scan QR code with authenticator app, then verify to enable MFA",
        },
      });
    } catch (error) {
      logger.error("MFA setup error:", error);
      res.status(500).json({
        success: false,
        error: "MFA setup failed",
      });
    }
  }
);

// Verify and enable MFA
router.post(
  "/mfa/verify",
  authenticateToken,
  validateMFA,
  async (req: AuthRequest, res: Response) => {
    try {
      const { mfaToken } = req.body;
      const user = await User.findById(req.user!.id).select("+mfaSecret");

      if (!user || !user.mfaSecret) {
        return res.status(400).json({
          success: false,
          error: "MFA setup not initiated",
        });
      }

      const isValid = AuthService.verifyMFAToken(mfaToken, user.mfaSecret);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid MFA token",
        });
      }

      // Enable MFA
      user.mfaEnabled = true;
      await user.save();

      logger.info(`MFA enabled for user: ${user.email}`, { userId: user.id });

      res.json({
        success: true,
        message: "MFA enabled successfully",
      });
    } catch (error) {
      logger.error("MFA verification error:", error);
      res.status(500).json({
        success: false,
        error: "MFA verification failed",
      });
    }
  }
);

// Disable MFA
router.post(
  "/mfa/disable",
  authenticateToken,
  validateMFA,
  async (req: AuthRequest, res: Response) => {
    try {
      const { mfaToken, backupCode } = req.body;
      const user = await User.findById(req.user!.id).select(
        "+mfaSecret +backupCodes"
      );

      if (!user || !user.mfaEnabled) {
        return res.status(400).json({
          success: false,
          error: "MFA not enabled",
        });
      }

      let isValid = false;

      if (mfaToken && user.mfaSecret) {
        isValid = AuthService.verifyMFAToken(mfaToken, user.mfaSecret);
      } else if (backupCode) {
        const result = AuthService.verifyBackupCode(
          backupCode,
          user.backupCodes
        );
        isValid = result.valid;
      }

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid MFA token or backup code",
        });
      }

      // Disable MFA
      user.mfaEnabled = false;
      user.mfaSecret = undefined;
      user.backupCodes = [];
      await user.save();

      logger.warn(`MFA disabled for user: ${user.email}`, { userId: user.id });

      res.json({
        success: true,
        message: "MFA disabled successfully",
      });
    } catch (error) {
      logger.error("MFA disable error:", error);
      res.status(500).json({
        success: false,
        error: "MFA disable failed",
      });
    }
  }
);

// Change password
router.post(
  "/change-password",
  authenticateToken,
  validatePassword,
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user!.id).select(
        "+passwordHash +passwordSalt"
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Verify current password
      const isValid = await AuthService.verifyPassword(
        currentPassword,
        user.passwordHash,
        user.passwordSalt
      );

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: "Current password is incorrect",
        });
      }

      // Hash new password
      const { hash, salt } = await AuthService.hashPassword(newPassword);

      // Update password
      user.passwordHash = hash;
      user.passwordSalt = salt;
      user.lastPasswordChange = new Date();
      await user.save();

      logger.info(`Password changed for user: ${user.email}`, {
        userId: user.id,
      });

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      logger.error("Password change error:", error);
      res.status(500).json({
        success: false,
        error: "Password change failed",
      });
    }
  }
);

// Logout user
router.post(
  "/logout",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;

      // Update last active timestamp
      user.lastActive = new Date();
      await user.save();

      logger.info(`User logged out: ${user.email}`, {
        userId: user.id,
        deviceId: req.user!.deviceId,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Logout error:", error);
      res.status(500).json({
        success: false,
        error: "Logout failed",
      });
    }
  }
);

// Verify token and get auth status
router.get(
  "/verify",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;

      res.json({
        success: true,
        data: {
          user: user.toJSON(),
          deviceIds: user.deviceIds || [],
          currentDevice: user.deviceId,
          isAuthenticated: true,
        },
      });
    } catch (error) {
      logger.error("Token verification error:", error);
      res.status(500).json({
        success: false,
        error: "Token verification failed",
      });
    }
  }
);

// Change password
router.put(
  "/change-password",
  authenticateToken,
  [
    body("currentPassword")
      .isLength({ min: 1 })
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8, max: 128 })
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .withMessage(
        "New password must be 8+ chars with uppercase, lowercase, number, and special character"
      ),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      // Get the current user with password fields
      const user = await User.findById(userId).select(
        "+passwordHash +passwordSalt"
      );
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Verify current password
      const currentPasswordValid = await AuthService.verifyPassword(
        currentPassword,
        user.passwordHash,
        user.passwordSalt
      );

      if (!currentPasswordValid) {
        logger.warn("Password change failed - invalid current password", {
          userId,
          ip: req.ip,
        });

        return res.status(400).json({
          success: false,
          error: "Current password is incorrect",
        });
      }

      // Generate new password hash with new salt
      const { hash: newPasswordHash, salt: newSalt } =
        await AuthService.hashPassword(newPassword);

      // Update password
      user.passwordHash = newPasswordHash;
      user.passwordSalt = newSalt;
      user.lastPasswordChange = new Date();
      await user.save();

      logger.info("Password changed successfully", {
        userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      logger.error("Password change error:", error);
      res.status(500).json({
        success: false,
        error: "Password change failed",
      });
    }
  }
);

// Update profile
router.put(
  "/profile",
  authenticateToken,
  [
    body("email")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Invalid email format"),
    validateRequest,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { email } = req.body;
      const userId = req.user!.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Check if email is already taken by another user
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            error: "Email is already in use",
          });
        }
        user.email = email;
      }

      user.lastActive = new Date();
      await user.save();

      logger.info("Profile updated successfully", {
        userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: user.toJSON(),
        message: "Profile updated successfully",
      });
    } catch (error) {
      logger.error("Profile update error:", error);
      res.status(500).json({
        success: false,
        error: "Profile update failed",
      });
    }
  }
);

// Delete account
router.delete(
  "/delete-account",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      // Find and delete the user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Log the account deletion
      logger.warn("Account deletion requested", {
        userId,
        email: user.email,
        ip: req.ip,
      });

      // Delete the user account
      await User.findByIdAndDelete(userId);

      // TODO: Also delete related data (workouts, credits, etc.)
      // This should be implemented based on your data cleanup requirements

      logger.info("Account deleted successfully", {
        userId,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      logger.error("Account deletion error:", error);
      res.status(500).json({
        success: false,
        error: "Account deletion failed",
      });
    }
  }
);

export default router;
