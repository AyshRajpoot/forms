const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    value: { type: String, required: true, trim: true, maxlength: 120 },
  },
  { _id: false }
);

const formFieldSchema = new mongoose.Schema(
  {
    formId: { type: mongoose.Schema.Types.ObjectId, ref: "Form", required: true, index: true },
    fieldKey: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      required: true,
      enum: ["text", "textarea", "email", "number", "password", "dropdown", "alphanumeric", "image", "file"],
    },
    enabled: { type: Boolean, default: true, index: true },
    priority: { type: Number, required: true, min: 1 },
    required: { type: Boolean, default: false },
    minLength: { type: Number, min: 0 },
    maxLength: { type: Number, min: 0 },
    passwordMinUppercase: { type: Number, min: 0, max: 64 },
    passwordMinLowercase: { type: Number, min: 0, max: 64 },
    passwordMinDigits: { type: Number, min: 0, max: 64 },
    passwordMinSpecial: { type: Number, min: 0, max: 64 },
    options: { type: [optionSchema], default: [] },
  },
  { timestamps: true }
);

formFieldSchema.index({ formId: 1, fieldKey: 1 }, { unique: true });
formFieldSchema.index({ formId: 1, priority: 1 }, { unique: true });

module.exports = mongoose.model("FormField", formFieldSchema);
