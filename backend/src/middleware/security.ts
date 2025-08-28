import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { body, validationResult } from "express-validator";
import logger from "../utils/simpleLogger";

// Rate limiting configurations
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "development" ? 1000 : 5, // Higher limit for development
  message: {
    success: false,
    error: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: process.env.NODE_ENV === "development" ? () => false : undefined, // Don't skip in development, but use higher limit
});

export const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 sync requests per 5 minutes
  message: {
    success: false,
    error: "Too many sync requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// CORS configuration
export const corsOptions = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
      "vscode-webview://*",
      "http://localhost:3000",
      "https://workout-lockout.app",
    ];

    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed.includes("*")) {
        const pattern = allowed.replace("*", ".*");
        return new RegExp(pattern).test(origin);
      }
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Device-ID"],
});

// Input validation middleware
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

// Device ID validation
export const validateDeviceId = [
  body("deviceId")
    .isLength({ min: 10, max: 100 })
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage("Invalid device ID format"),
  validateRequest,
];

// Email validation
export const validateEmail = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email format"),
  validateRequest,
];

// Workout data validation
export const validateWorkout = [
  body("source")
    .isIn(["whoop", "strava", "fitbit", "healthkit", "manual"])
    .withMessage("Invalid workout source"),
  body("type")
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage("Invalid workout type"),
  body("startTime").isISO8601().withMessage("Invalid start time format"),
  body("endTime").isISO8601().withMessage("Invalid end time format"),
  body("duration")
    .isInt({ min: 1, max: 1440 })
    .withMessage("Duration must be between 1 and 1440 minutes"),
  validateRequest,
];

// Request logging middleware
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  // Log request details for debugging
  const userAgent = req.get("User-Agent") || "";
  if (
    userAgent.includes("Dont") ||
    userAgent.includes("Skip") ||
    userAgent.includes("CFNetwork")
  ) {
    logger.info("iOS App Request", {
      method: req.method,
      url: req.url,
      fullUrl: req.protocol + "://" + req.get("host") + req.originalUrl,
      userAgent: userAgent,
      headers: {
        authorization: req.get("Authorization") ? "Bearer [token]" : "none",
        contentType: req.get("Content-Type"),
        deviceId: req.get("X-Device-ID"),
      },
      body: req.method === "POST" ? req.body : undefined,
    });
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    };

    if (res.statusCode >= 400) {
      logger.warn("HTTP Request", logData);
    } else {
      logger.info("HTTP Request", logData);
    }
  });

  next();
};
