const InventoryMovement = require("../models/InventoryMovement");
const Tank = require("../models/Tank");
const Product = require("../models/Product");
const Payment = require("../models/Payment");
const Delivery = require("../models/Delivery");

async function consumeFromTanksFIFO({
  count = 1,
  house = null,
  usedPrepaid = false,
  notes = "",
  userId = null,
  createDelivery = false,
}) {
  // 1️⃣ Obtener tanques activos ordenados FIFO
  const tanks = await Tank.find({ active: true })
    .populate("product")
    .sort({ createdAt: 1 });

  if (!tanks.length) throw new Error("No hay tanques registrados");

  const litersPerBottle = tanks[0].litersPerBottle || 20;
  let litersNeeded = count * litersPerBottle;

  // 2️⃣ Validar anticipos (NO CAMBIA)
  if (usedPrepaid) {
    if (!house) throw new Error("House ID required to use prepayment");

    const payments = await Payment.find({ house });
    const prepaid = payments
      .filter((p) => p.confirmed)
      .reduce((s, p) => s + (p.prepaidBotellones || 0), 0);

    const usedDeliveries = await Delivery.find({ house, usedPrepaid: true });
    const used = usedDeliveries.reduce((s, d) => s + (d.count || 0), 0);

    const available = prepaid - used;
    if (available < count) {
      throw new Error(
        "No hay suficientes botellones prepagados para esta entrega"
      );
    }
  }

  // 3️⃣ Consumir litros FIFO
  let movements = [];

  for (const tank of tanks) {
    if (litersNeeded <= 0) break;

    const product = tank.product;
    if (!product || product.quantity <= 0) continue;

    const consume = Math.min(product.quantity, litersNeeded);

    product.quantity -= consume;
    litersNeeded -= consume;
    await product.save();

    // notificar nivel bajo
    try {
      const { notifyTankLevel } = require("./notify");
      notifyTankLevel(product);
    } catch (e) {}

    const movementDoc = await InventoryMovement.create({
      product: product._id,
      type: "out",
      quantity: consume,
      notes: notes || `Llenado FIFO (${count} botellones)`,
      user: userId,
    });

    movements.push({
      movement: movementDoc,
      pricePerFill: tank.pricePerFill || 0,
    });
  }

  if (litersNeeded > 0) {
    throw new Error("No hay litros suficientes en los tanques");
  }

  // 4️⃣ Registrar pago (precio por tanque consumido)
  let payment = null;
  if (house && !usedPrepaid) {
    // calcular el monto total según movimientos
    const totalAmount = movements.reduce((sum, m) => {
      const lpb = m.movement.product.litersPerBottle || 20; // si quieres usar litros por botella real del tanque
      return sum + (m.movement.quantity / lpb) * m.pricePerFill;
    }, 0);

    const crypto = require("crypto");
    const key = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          house: String(house),
          amount: totalAmount,
          description: `Deuda por llenado (${count})`,
          movements: movements.map((m) => String(m.movement._id)),
        })
      )
      .digest("hex");

    try {
      payment = await Payment.findOneAndUpdate(
        { idempotencyKey: key, house },
        {
          $setOnInsert: {
            house,
            amount: totalAmount,
            description: `Deuda por llenado (${count})`,
            prepaidBotellones: 0,
            confirmed: false,
            idempotencyKey: key,
          },
        },
        { new: true, upsert: true }
      );
    } catch (err) {
      if (err.code === 11000) {
        payment = await Payment.findOne({ idempotencyKey: key, house });
      } else {
        throw err;
      }
    }
  }

  // 5️⃣ Registrar entrega
  let delivery = null;
  if (createDelivery && house) {
    delivery = await Delivery.create({
      house,
      count,
      usedPrepaid,
      notes,
    });
  }

  return {
    tanksUsed: movements.length,
    movements,
    payment,
    delivery,
    litersUsed: count * litersPerBottle,
  };
}

module.exports = { consumeFromTanksFIFO };
