const InventoryMovement = require('../models/InventoryMovement')
const Tank = require('../models/Tank')
const Product = require('../models/Product')
const Payment = require('../models/Payment')
const Delivery = require('../models/Delivery')

async function consumeFromTank({ productId, tankId, count = 1, house = null, usedPrepaid = false, notes = '', userId = null, createDelivery = false }){
  // discover tank if not provided
  let tankEntry = null
  if (tankId) tankEntry = await Tank.findById(tankId).populate('product')
  else if (productId) tankEntry = await Tank.findOne({ product: productId }).populate('product')
  if (!tankEntry) throw new Error('Tank not found')
  const litersPerBottle = tankEntry.litersPerBottle || 20
  const litersNeeded = (count || 0) * litersPerBottle
  const product = tankEntry.product
  if ((product.quantity || 0) < litersNeeded) throw new Error('Not enough liters in tank')
  // If using prepayment, validate house has sufficient confirmed prepaids
  if (usedPrepaid) {
    if (!house) throw new Error('House ID required to use prepayment')
    // Only confirmed prepaid payments count
    const payments = await Payment.find({ house })
    const prepaid = payments.filter(p => p.confirmed).reduce((s, p) => s + (p.prepaidBotellones || 0), 0)
    const usedDeliveries = await Delivery.find({ house, usedPrepaid: true })
    const used = usedDeliveries.reduce((s, d) => s + (d.count || 0), 0)
    const available = prepaid - used
    if (available < count) throw new Error('No hay suficientes botellones prepagados para esta entrega')
  }
  // subtract
  product.quantity = Math.max(0, product.quantity - litersNeeded)
  await product.save()
  // notify if low
  try{ const { notifyTankLevel } = require('./notify'); notifyTankLevel(product) }catch(e){}
  const movement = await InventoryMovement.create({ product: product._id, type: 'out', quantity: litersNeeded, notes: notes || `Llenado: ${count} botellones`, user: userId })
  let payment = null
  if (house && !usedPrepaid) {
    const amount = (tankEntry.pricePerFill || 0) * count
    const crypto = require('crypto')
    const key = crypto.createHash('sha256').update(JSON.stringify({ house: String(house), amount, description: `Deuda por llenado (${count})`, movementId: String(movement._id) })).digest('hex')
    try {
      payment = await Payment.findOneAndUpdate({ idempotencyKey: key, house }, { $setOnInsert: { house, amount, description: `Deuda por llenado (${count})`, prepaidBotellones: 0, confirmed: false, idempotencyKey: key } }, { new: true, upsert: true })
    } catch (err) {
      if (err.code === 11000) {
        payment = await Payment.findOne({ idempotencyKey: key, house })
      } else throw err
    }
  }
  let delivery = null
  if (createDelivery && house) {
    delivery = await Delivery.create({ house, count, usedPrepaid, notes })
  }
  return { tankEntry, product, movement, payment, litersNeeded }
}

module.exports = { consumeFromTank }
