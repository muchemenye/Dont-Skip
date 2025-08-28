import mongoose, { Schema, Document } from "mongoose";
import { CreditTransaction } from "../types";

interface CreditTransactionDocument extends CreditTransaction, Document {}

const creditTransactionSchema = new Schema<CreditTransactionDocument>(
  {
    userId: {
      type: String,
      required: true,
      ref: "User",
    },
    type: {
      type: String,
      required: true,
      enum: ["earned", "spent", "expired", "emergency"],
    },
    amount: {
      type: Number,
      required: true,
    },
    workoutId: {
      type: String,
      ref: "Workout",
    },
    reason: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: false,
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

// Indexes for performance
creditTransactionSchema.index({ userId: 1, timestamp: -1 });
creditTransactionSchema.index({ userId: 1, type: 1 });
creditTransactionSchema.index({ expiresAt: 1 });
creditTransactionSchema.index({ workoutId: 1 });

export const CreditTransaction = mongoose.model<CreditTransactionDocument>(
  "CreditTransaction",
  creditTransactionSchema
);
