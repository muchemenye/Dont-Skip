import mongoose, { Schema, Document } from "mongoose";
import { WorkoutData } from "../types";

interface WorkoutDocument extends WorkoutData, Document {}

const heartRateSchema = new Schema(
  {
    average: { type: Number },
    max: { type: Number },
  },
  { _id: false }
);

const workoutSchema = new Schema<WorkoutDocument>(
  {
    userId: {
      type: String,
      required: true,
      ref: "User",
    },
    source: {
      type: String,
      required: true,
      enum: [
        "whoop",
        "strava",
        "fitbit",
        "apple-health",
        "google-fit",
        "manual",
      ],
    },
    type: {
      type: String,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    calories: {
      type: Number,
      min: 0,
    },
    heartRate: heartRateSchema,
    distance: {
      type: Number,
      min: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    processed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for performance and uniqueness
workoutSchema.index({ userId: 1, startTime: -1 });
workoutSchema.index({ userId: 1, source: 1, startTime: 1 });
workoutSchema.index({ processed: 1 });
workoutSchema.index({ startTime: 1, endTime: 1 });

// Compound unique index to prevent duplicate workouts
workoutSchema.index(
  {
    userId: 1,
    source: 1,
    startTime: 1,
    duration: 1,
  },
  { unique: true }
);

export const Workout = mongoose.model<WorkoutDocument>(
  "Workout",
  workoutSchema
);
