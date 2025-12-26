const mongoose = require("mongoose");

const InventoryMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    type: { type: String, enum: ["in", "out"], required: true },
    quantity: { type: Number, default: 0 },
    notes: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryMovement", InventoryMovementSchema);
