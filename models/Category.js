const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a category name"],
      trim: true,
    },
    color: {
      type: String,
      match: [/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Please use a valid hex color"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
