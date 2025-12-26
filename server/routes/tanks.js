const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const InventoryMovement = require("../models/InventoryMovement");
const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const Tank = require("../models/Tank");
const Payment = require("../models/Payment");

// GET /api/inventory/tanks/summary?days=30
// Devuelve lista de tanques con estado actual y pequeño historial diario (últimos N días)
// list all tanks with current data and simple daily history
router.get("/summary", auth, async (req, res) => {
  try {
    const days = Math.max(7, parseInt(req.query.days) || 30);
    // join Tank documents to get pricePerFill, litersPerBottle
    const tanks = await Tank.find({ deleted: false }).populate("product");
    const since = new Date();
    since.setDate(since.getDate() - days);

    const results = await Promise.all(
      tanks.map(async (t) => {
        const product = t.product;
        // movimientos del tanque en periodo
        // 🔵 SOLO movimientos de RECARGA del tanque
        const rechargeMoves = await InventoryMovement.find({
          product: product._id,
          type: "in",
        }).sort({ createdAt: 1 });

        let runningQty = 0;
        const history = [];

        for (const m of rechargeMoves) {
          runningQty += m.quantity;

          history.push({
            date: m.createdAt.toISOString().slice(0, 10),
            qty: runningQty, // litros acumulados
            litersAdded: m.quantity, // litros de esa recarga
          });
        }

        const pct = product.capacity
          ? Math.min(
              100,
              Math.round((product.quantity / product.capacity) * 100)
            )
          : 0;
        const status = pct >= 70 ? "ok" : pct >= 30 ? "medium" : "low";
        const fillable = Math.floor(
          product.quantity / (t.litersPerBottle || 20)
        );
        return {
          id: t._id,
          name: product.name,
          productId: product._id,
          quantity: product.quantity,
          capacity: product.capacity,
          status,
          history, // 👈 ESTE history es el nuevo
          pricePerFill: t.pricePerFill,
          litersPerBottle: t.litersPerBottle,
          isActive: t.active,
        };
      })
    );

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new Tank (and underlying product) - admin only
router.post("/", auth, isAdmin, async (req, res) => {
  try {
    const { name, capacity, pricePerFill, litersPerBottle = 20 } = req.body;
    // create product with unit 'litro' and category 'Llenado Tanque'
    const product = await Product.create({
      name,
      category: "Llenado Tanque",
      unit: "litro",
      quantity: 0,
      capacity,
      price: pricePerFill || 0,
    });
    const tank = await Tank.create({
      product: product._id,
      litersPerBottle,
      pricePerFill: pricePerFill || 0,
    });
    res.json({ tank, product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update tank (price / litersPerBottle) - admin
router.put("/:tankId", auth, isAdmin, async (req, res) => {
  try {
    const t = await Tank.findById(req.params.tankId).populate("product");
    if (!t) return res.status(404).json({ error: "Tanque no encontrado" });
    const { pricePerFill, litersPerBottle, name, capacity } = req.body;
    if (typeof pricePerFill === "number") t.pricePerFill = pricePerFill;
    if (typeof litersPerBottle === "number")
      t.litersPerBottle = litersPerBottle;
    if (typeof name === "string") t.product.name = name;
    if (typeof capacity === "number") t.product.capacity = capacity;
    if (name || capacity) await t.product.save();
    await t.save();
    res.json({ tank: t, product: t.product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Recharge tank (create inventory movement, add liters) - admin
router.post("/:tankId/recharge", auth, isAdmin, async (req, res) => {
  try {
    const t = await Tank.findById(req.params.tankId).populate("product");
    if (!t) return res.status(404).json({ error: "Tanque no encontrado" });
    const { liters } = req.body;
    const prod = t.product;
    prod.quantity = (prod.quantity || 0) + (liters || 0);
    await prod.save();
    // notify if tank low
    try {
      const { notifyTankLevel } = require("../utils/notify");
      notifyTankLevel(prod);
    } catch (e) {}
    const m = await InventoryMovement.create({
      product: prod._id,
      type: "in",
      quantity: liters || 0,
      notes: "Recarga tanque",
      user: req.user?.id,
    });
    res.json({ tank: t, product: prod, movement: m });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fill bottles from tank: consumes liters and optionally creates a Sale/Payment
router.post("/:tankId/fill", auth, isAdmin, async (req, res) => {
  try {
    const { count = 1, house, usedPrepaid = false, notes } = req.body;

    const { consumeFromTanksFIFO } = require("../utils/tankOperations");

    const result = await consumeFromTanksFIFO({
      count,
      house,
      usedPrepaid,
      notes,
      userId: req.user.id,
      createDelivery: true,
    });

    res.json({
      message: "Llenado registrado correctamente",
      litersUsed: result.litersUsed,
      movements: result.movements,
      payment: result.payment,
      delivery: result.delivery,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DESACTIVAR TANQUE (admin)
router.put("/:tankId/deactivate", auth, isAdmin, async (req, res) => {
  const tank = await Tank.findById(req.params.tankId);
  if (!tank) return res.status(404).json({ error: "Tanque no encontrado" });

  const movements = await InventoryMovement.exists({ product: tank.product });
  if (movements) {
    tank.active = false;
    await tank.save();
    return res.json({ message: "Tanque desactivado (tiene historial)" });
  }

  tank.active = false;
  await tank.save();
  res.json({ message: "Tanque desactivado correctamente" });
});

// ELIMINACIÓN LÓGICA (admin)
router.delete("/:tankId", auth, isAdmin, async (req, res) => {
  try {
    const tank = await Tank.findById(req.params.tankId);

    if (!tank) {
      return res.status(404).json({ error: "Tanque no encontrado" });
    }

    if (tank.active) {
      return res.status(400).json({
        error: "No puedes eliminar un tanque activo. Activa otro primero.",
      });
    }

    tank.deleted = true;
    tank.active = false; // seguridad extra
    await tank.save();

    res.json({ ok: true, deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
