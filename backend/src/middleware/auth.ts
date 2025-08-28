import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { AuthRequest, JWTPayload } from "../types";
import logger from "../utils/simpleLogger";

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Access token required",
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error("JWT_SECRET not configured");
      res.status(500).json({
        success: false,
        error: "Server configuration error",
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        error: "Invalid token - user not found",
      });
      return;
    }

    // Verify device ID matches (prevents token reuse across devices)
    // Support both new deviceIds array and legacy deviceId field
    const userDeviceIds = user.deviceIds || [];
    if (user.deviceId && !userDeviceIds.includes(user.deviceId)) {
      // Migrate legacy deviceId to deviceIds array
      userDeviceIds.push(user.deviceId);
    }

    const isValidDevice = userDeviceIds.includes(decoded.deviceId);

    if (!isValidDevice) {
      logger.warn("Token device ID mismatch", {
        userId: decoded.userId,
        tokenDeviceId: decoded.deviceId,
        userDeviceIds: userDeviceIds,
        ip: req.ip,
      });

      res.status(401).json({
        success: false,
        error: "Invalid token - device not authorized",
      });
      return;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      res.status(423).json({
        success: false,
        error: "Account temporarily locked",
      });
      return;
    }

    // Update last active timestamp
    user.lastActive = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: "Token expired",
      });
    } else {
      logger.error("Authentication error:", error);
      res.status(500).json({
        success: false,
        error: "Authentication failed",
      });
    }
  }
};

export const generateToken = (userId: string, deviceId: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET not configured");
  }

  return jwt.sign({ userId, deviceId }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    issuer: "workout-lockout-backend",
    audience: "workout-lockout-client",
  });
};
