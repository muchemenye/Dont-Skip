import mongoose, { Schema, Document } from "mongoose";
import { FitnessIntegration } from "../types";

interface FitnessIntegrationDocument extends FitnessIntegration, Document {}

const fitnessIntegrationSchema = new Schema<FitnessIntegrationDocument>(
  {
    userId: {
      type: String,
      required: true,
      ref: "User",
    },
    provider: {
      type: String,
      required: true,
      enum: ["whoop", "strava", "fitbit"],
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
    },
    tokenExpiry: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSync: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        // Never expose tokens in JSON
        delete ret.accessToken;
        delete ret.refreshToken;
        return ret;
      },
    },
  }
);

// Indexes for performance and uniqueness
fitnessIntegrationSchema.index({ userId: 1, provider: 1 }, { unique: true });
fitnessIntegrationSchema.index({ isActive: 1 });
fitnessIntegrationSchema.index({ tokenExpiry: 1 });

export const FitnessIntegration = mongoose.model<FitnessIntegrationDocument>(
  "FitnessIntegration",
  fitnessIntegrationSchema
);
