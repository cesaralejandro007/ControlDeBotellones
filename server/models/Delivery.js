const mongoose = require("mongoose");

const DeliverySchema = new mongoose.Schema(
  {
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "House",
      required: true,
    },
    count: { type: Number, default: 1 },
    date: { type: Date, default: Date.now },
    usedPrepaid: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Delivery", DeliverySchema);
