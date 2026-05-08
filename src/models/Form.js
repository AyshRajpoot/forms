const mongoose = require("mongoose");

const formSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

  },

  { timestamps: true }
);

module.exports = mongoose.model("Form", formSchema);
