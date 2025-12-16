const express = require("express");
const router = express.Router();
const Payment = require("../models/Payment");
const Delivery = require("../models/Delivery");
const Product = require("../models/Product");
const auth = require("../middleware/auth");
const House = require("../models/House");

// resumen general (pagos por mes, entregas por mes, inventario por categoría)
router.get("/summary", auth, async (req, res) => {
  try {
    // months back configurable: ?months=6 (default 6)
    const months = parseInt(req.query.months) || 6;
    const from = new Date();
    from.setMonth(from.getMonth() - (months - 1));
    const sixMonthsAgo = new Date(from.getFullYear(), from.getMonth(), 1);
    const paymentsAgg = await Payment.aggregate([
      { $match: { date: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // entregas por mes
    const deliveriesAgg = await Delivery.aggregate([
      { $match: { date: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          total: { $sum: "$count" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // inventario por category
    const invAgg = await Product.aggregate([
      { $group: { _id: "$category", totalQty: { $sum: "$quantity" } } },
    ]);

    res.json({
      paymentsByMonth: paymentsAgg,
      deliveriesByMonth: deliveriesAgg,
      inventoryByCategory: invAgg,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// casas al día vs morosas
router.get("/houses-status", auth, async (req, res) => {
  const houses = await House.find();

  const alDia = [];
  const morosas = [];

  for (const h of houses) {
    const payments = await Payment.find({ house: h._id });
    const pendingAmount = payments
      .filter((p) => !p.confirmed && !p.settled)
      .reduce((s, p) => s + (p.amount || 0), 0);

    if (pendingAmount > 0) {
      morosas.push({
        _id: h._id,
        code: h.code,
        owner: h.owner,
        pendingAmount,
      });
    } else {
      alDia.push({
        _id: h._id,
        code: h.code,
        owner: h.owner,
      });
    }
  }

  res.json({ alDia, morosas });
});

module.exports = router;
