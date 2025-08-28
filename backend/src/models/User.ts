import mongoose, { Schema, Document } from "mongoose";
import { User as IUser, UserSettings } from "../types";

interface UserDocument extends IUser, Document {}

const userSettingsSchema = new Schema<UserSettings>(
  {
    workoutCreditRatio: { type: Number, default: 12.0 }, // Evidence-based default
    maxDailyCredits: { type: Number, default: 480 }, // 8 hours
    emergencyCredits: { type: Number, default: 30 },
    creditExpiration: { type: Number, default: 48 }, // hours
    enabledIntegrations: [{ type: String }],
    lockoutEnabled: { type: Boolean, default: true },
    workoutTypes: [
      {
        name: { type: String, required: true },
        minDuration: { type: Number, required: true },
        codingHoursEarned: { type: Number, required: true },
      },
    ],
  },
  { _id: false }
);

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    passwordSalt: {
      type: String,
      required: true,
    },
    deviceIds: {
      type: [String],
      default: [],
      validate: {
        validator: function (deviceIds: string[]) {
          return deviceIds.length <= 5; // Max 5 devices per user
        },
        message: "Maximum 5 devices allowed per user",
      },
    },
    // Legacy field for backward compatibility (will be removed)
    deviceId: {
      type: String,
      required: false,
    },
    mfaSecret: {
      type: String,
      select: false, // Never include in queries by default
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    backupCodes: {
      type: [String],
      default: [],
      select: false, // Never include in queries by default
    },
    settings: {
      type: userSettingsSchema,
      default: () => ({}),
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    lastPasswordChange: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        // Return only the fields that iOS expects
        return {
          id: ret._id.toString(),
          email: ret.email,
          settings: ret.settings,
          createdAt: ret.createdAt,
          lastActive: ret.lastActive,
        };
      },
    },
  }
);

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true });
// Remove unique constraint on deviceId for backward compatibility
userSchema.index({ deviceId: 1 });
userSchema.index({ deviceIds: 1 });
userSchema.index({ lastActive: 1 });

export const User = mongoose.model<UserDocument>("User", userSchema);
