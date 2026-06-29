const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    ip: {
      type: String,
      required: true,
      index: true,
    },
    failedAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockLevel: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    lastFailedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LoginAttempt", loginAttemptSchema);
