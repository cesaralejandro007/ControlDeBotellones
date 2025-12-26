const express = require("express");
const router = express.Router();
const Delivery = require("../models/Delivery");
const Product = require("../models/Product");
const Payment = require("../models/Payment");
const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

// listar entregas (protegido)
router.get("/", auth, async (req, res) => {
  const items = await Delivery.find().populate("house").sort({ date: -1 });
  res.json(items);
});

// entregas por casa
router.get("/house/:houseId", auth, async (req, res) => {
  const items = await Delivery.find({ house: req.params.houseId }).sort({
    date: -1,
  });
  res.json(items);
});

// registrar entrega
// body: { house, count, usedPrepaid, notes }
// Solo administradores pueden registrar entregas (control de stock y deudas)
router.post("/", auth, isAdmin, async (req, res) => {
  try {
    const { house, count = 1, usedPrepaid = false, notes } = req.body;

    // si se quiere usar anticipo, validar balance
    if (usedPrepaid) {
      // Only confirmed payments count as available prepaids
      const payments = await Payment.find({ house });
      const prepaid = payments
        .filter((p) => p.confirmed)
        .reduce((s, p) => s + (p.prepaidBotellones || 0), 0);
      const usedDeliveries = await Delivery.find({ house, usedPrepaid: true });
      const used = usedDeliveries.reduce((s, d) => s + (d.count || 0), 0);
      const available = prepaid - used;
      if (available < count)
        return res
          .status(400)
          .json({
            error: "No hay suficientes botellones prepagados para esta entrega",
          });
    }

    // Buscar producto botellón para precio y tanque (producto en litros) para descontar agua
    const botellonProduct = await Product.findOne({ type: "botellon" });

    // 👇 ahora se obtiene el tanque ACTIVO realmente
    const tankProduct = await Product.findOne({
      unit: "litro",
      isActive: true,
    });

    const Tank = require("../models/Tank");
    const tankModel = tankProduct
      ? await Tank.findOne({ product: tankProduct._id })
      : null;

    // Si no existe tanque, no se puede realizar la entrega (a menos que se use anticipo y admin decida otra cosa)
    if (!tankProduct)
      return res
        .status(400)
        .json({ error: "Tanque de agua no está registrado en inventario" });

    // comprobar litros disponibles
    const litersPerBottle = tankModel?.litersPerBottle || 20;
    const litersNeeded = (count || 0) * litersPerBottle;
    if ((tankProduct.quantity || 0) < litersNeeded)
      return res
        .status(400)
        .json({
          error: "No hay suficiente agua en el tanque para esta entrega",
        });

    // If we have a tankEntry, prefer to let the tankOperations helper create the delivery and manage movement/payment
    if (tankModel) {
      try {
        const { consumeFromTanksFIFO } = require("../utils/tankOperations");
        const result = await consumeFromTanksFIFO({
          productId: tankProduct._id,
          count,
          house,
          usedPrepaid,
          notes: `Entrega a casa ${house} (${count} botellones)`,
          userId: req.user.id,
          createDelivery: true,
        });
        return res.json({
          delivery: result.delivery || null,
          product: botellonProduct,
          litersUsed: result.litersNeeded,
          pricePerFillUsed: tankModel?.pricePerFill || botellonProduct?.price,
          litersPerBottle: tankModel?.litersPerBottle || 20,
        });
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }
    // otherwise treat as earlier (no tank): create deletion record but no liters movement
    const d = await Delivery.create({ house, count, usedPrepaid, notes });

    // Si la entrega no se pagó con anticipo, crear automáticamente un pago pendiente (confirmed=false)
    if (!usedPrepaid) {
      try {
        // prefer pricePerFill from Tank if available, else fallback to botellon product price
        const unitPrice =
          tankModel?.pricePerFill || botellonProduct?.price || 0;
        const amount = unitPrice * count;
        const crypto = require("crypto");
        const key = crypto
          .createHash("sha256")
          .update(
            JSON.stringify({
              house: String(house),
              amount,
              description: `Deuda por entrega (${count} botellones)`,
              deliveryId: String(d._id),
            })
          )
          .digest("hex");
        try {
          await Payment.findOneAndUpdate(
            { idempotencyKey: key, house },
            {
              $setOnInsert: {
                house,
                amount,
                description: `Deuda por entrega (${count} botellones)`,
                prepaidBotellones: 0,
                confirmed: false,
                idempotencyKey: key,
              },
            },
            { new: true, upsert: true }
          );
        } catch (err) {
          if (err.code === 11000) {
            // already created concurrently, ignore
          } else throw err;
        }
      } catch (e) {
        /* no crítico */
      }
    }

    res.json({
      delivery: d,
      product: botellonProduct,
      litersUsed: litersNeeded,
      pricePerFillUsed: tankModel?.pricePerFill || botellonProduct?.price,
      litersPerBottle,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
