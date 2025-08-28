export interface User {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  deviceId: string;
  mfaSecret?: string;
  mfaEnabled: boolean;
  backupCodes: string[];
  createdAt: Date;
  lastActive: Date;
  settings: UserSettings;
  // Security fields
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastPasswordChange: Date;
}

export interface UserSettings {
  workoutCreditRatio: number; // minutes of coding per minute of workout
  maxDailyCredits: number;
  emergencyCredits: number;
  creditExpiration: number; // hours
  enabledIntegrations: string[];
  lockoutEnabled: boolean;
  workoutTypes?: WorkoutType[]; // Custom workout types from VS Code extension
}

export interface WorkoutType {
  name: string;
  minDuration: number; // minutes
  codingHoursEarned: number;
}

export interface WorkoutData {
  id: string;
  userId: string;
  source:
    | "whoop"
    | "strava"
    | "fitbit"
    | "apple-health"
    | "google-fit"
    | "manual";
  type: string;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  calories?: number;
  heartRate?: {
    average?: number;
    max?: number;
  };
  distance?: number; // meters
  verified: boolean;
  processed: boolean; // whether credits have been awarded
  createdAt: Date;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  type: "earned" | "spent" | "expired" | "emergency";
  amount: number; // minutes
  workoutId?: string;
  reason: string;
  timestamp: Date;
  expiresAt?: Date;
}

export interface FitnessIntegration {
  id: string;
  userId: string;
  provider: "whoop" | "strava" | "fitbit";
  accessToken: string; // encrypted
  refreshToken?: string; // encrypted
  tokenExpiry?: Date;
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface JWTPayload {
  userId: string;
  deviceId: string;
  iat: number;
  exp: number;
}
