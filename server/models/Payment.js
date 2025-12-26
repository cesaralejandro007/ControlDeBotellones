const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "House",
      required: true,
    },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    description: { type: String },
    prepaidBotellones: { type: Number, default: 0 }, // si pago por adelantado cuántos botellones cubre
    confirmed: { type: Boolean, default: true },
    // When a pending payment is cleared (covered) by another confirmed payment, mark as 'settled'
    settled: { type: Boolean, default: false },
    settledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    settledAt: { type: Date, default: null },
    // how much of this payment has been applied to other pending payments
    appliedAmount: { type: Number, default: 0 },
    // record of applied operation idempotency keys to avoid double applying the same targets
    appliedKeys: { type: [String], default: [] },
    idempotencyKey: { type: String, default: null },
    reference: { type: String },
    bank: { type: String },
    identification: { type: String },
    phone: { type: String },
  },
  { timestamps: true }
);

PaymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Payment", PaymentSchema);
