const express = require('express');
const router = express.Router();
const House = require('../models/House');
const Payment = require('../models/Payment');
const Delivery = require('../models/Delivery');
const auth = require('../middleware/auth');
const mongoose = require('mongoose')
const applyPaymentToTarget = require('../utils/applyPaymentToTarget')
const { supportsTransactions } = require('../utils/mongoSupport')

const Product = require('../models/Product')

// listar
router.get('/', auth, async (req, res) => {
  const houses = await House.find().sort({ code: 1 });
  res.json(houses);
});

// crear
router.post('/', auth, async (req, res) => {
  try {
    const h = await House.create(req.body);
    res.json(h);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// obtener
router.get('/:id', auth, async (req, res) => {
  const h = await House.findById(req.params.id);
  if (!h) return res.status(404).json({ error: 'No encontrado' });
  res.json(h);
});

// detalle: incluir pagos, entregas y balance de anticipos
router.get('/:id/detail', auth, async (req, res) => {
  try {
    const h = await House.findById(req.params.id);
    if (!h) return res.status(404).json({ error: 'No encontrado' });
    const payments = await Payment.find({ house: h._id }).sort({ date: -1 });
    const deliveries = await Delivery.find({ house: h._id }).sort({ date: -1 });
    // Only confirmed payments contribute to available prepaid bottles
    const prepaid = payments.filter(p => p.confirmed).reduce((s, p) => s + (p.prepaidBotellones || 0), 0);
    const used = deliveries.filter(d => d.usedPrepaid).reduce((s, d) => s + (d.count || 0), 0);
    res.json({ house: h, payments, deliveries, balance: { prepaid, used, balance: prepaid - used } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// deuda: calcular deuda estimada en moneda y desglose de anticipos (botellones)
router.get('/:id/debt', auth, async (req, res) => {
  try{
    const h = await House.findById(req.params.id)
    if (!h) return res.status(404).json({ error: 'No encontrado' })
    const payments = await Payment.find({ house: h._id })
    const deliveries = await Delivery.find({ house: h._id })

     const totalDelivered = deliveries.reduce((s, d) => s + (d.count || 0), 0)
     // Only confirmed payments count as prepaid
     const prepaid = payments.filter(p => p.confirmed).reduce((s, p) => s + (p.prepaidBotellones || 0), 0)
     const usedPrepaid = deliveries.filter(d => d.usedPrepaid).reduce((s, d) => s + (d.count || 0), 0)
       // pagos confirmados suman para lo pagado
       const paymentsTotal = payments.filter(p => p.confirmed).reduce((s, p) => s + (p.amount || 0), 0)
       // pending payment amounts (unconfirmed payments) representan deuda pendiente real
      const pendingPayments = payments.filter(p => !p.confirmed && !p.settled)
       const pendingAmount = pendingPayments.reduce((s, p) => s + (p.amount || 0), 0)

    // intentar obtener precio por botellon desde inventario
    const botellon = await Product.findOne({ $or: [{ category: 'Botellones' }, { type: 'botellon' }] })
    const pricePerBotellon = botellon ? botellon.price : 0
    const Tank = require('../models/Tank')
    const tankDoc = await Tank.findOne().populate('product')
    const pricePerFill = tankDoc ? tankDoc.pricePerFill : 0
    // Return computed values and pending amount (based on unconfirmed payments)
      res.json({ totalDelivered, prepaid, usedPrepaid, paymentsTotal, pricePerBotellon, pricePerFill, pendingAmount, pendingPayments })
  }catch(err){ res.status(500).json({ error: err.message }) }
})

// pagar deuda: crear un payment y devolver nuevo estado
router.post('/:id/pay', auth, async (req, res) => {
  try{
    const { amount, description, prepaidBotellones, targets } = req.body
    const h = await House.findById(req.params.id)
    if (!h) return res.status(404).json({ error: 'No encontrado' })
      // create payment and optionally apply to targets atomically
      // support idempotency key to avoid duplicates from double submissions
      const { idempotencyKey } = req.body
      const crypto = require('crypto')
      let p
      if (idempotencyKey) {
        // atomic upsert by idempotencyKey
        try {
          p = await Payment.findOneAndUpdate({ idempotencyKey, house: h._id }, { $setOnInsert: { house: h._id, amount: amount || 0, description, prepaidBotellones: prepaidBotellones || 0, confirmed: true, idempotencyKey } }, { new: true, upsert: true })
        } catch (err) {
          if (err.code === 11000) {
            p = await Payment.findOne({ idempotencyKey, house: h._id })
          } else throw err
        }
      } else {
        // compute a deterministic idempotency key based on payload to avoid duplicates
        // normalize targets to avoid reordering affecting idempotency
        const normalizedTargets = Array.isArray(targets) ? [...targets].sort((a,b) => (String((a && a.id) || a) > String((b && b.id) || b) ? 1 : -1)) : []
        const key = crypto.createHash('sha256').update(JSON.stringify({ house: String(h._id), amount: amount || 0, description: description || '', targets: normalizedTargets })).digest('hex')
        try {
          p = await Payment.findOneAndUpdate({ idempotencyKey: key, house: h._id }, { $setOnInsert: { house: h._id, amount: amount || 0, description, prepaidBotellones: prepaidBotellones || 0, confirmed: true, idempotencyKey: key } }, { new: true, upsert: true })
        } catch (err) {
          if (err.code === 11000) {
            p = await Payment.findOne({ idempotencyKey: key, house: h._id })
          } else throw err
        }
      }
      // If targets provided and user is admin, apply now
      if (Array.isArray(targets) && targets.length > 0) {
        // only admin can apply
        const isAdminRole = req.user && req.user.role === 'admin'
        if (!isAdminRole) return res.status(403).json({ error: 'No autorizado para aplicar pagos' })
        const initialAmount = p.amount || 0
        // compute an apply idempotency key to avoid duplicate application of the same targets
        const crypto = require('crypto')
        const normalizedTargets = [...targets].sort((a,b) => (String((a && a.id) || a) > String((b && b.id) || b) ? 1 : -1))
        const applyKey = crypto.createHash('sha256').update(JSON.stringify({ applyToOldest: false, targets: normalizedTargets })).digest('hex')
        // Reserve this apply operation atomically on the payment document to avoid duplicates
        const reserved = await Payment.findOneAndUpdate({ _id: p._id, appliedKeys: { $ne: applyKey } }, { $push: { appliedKeys: applyKey } }, { new: true })
        if (!reserved) {
          // Another request already applied these targets; reload payment and skip application
          p = await Payment.findById(p._id)
        } else {
        let remaining = initialAmount
        const hasTransactions = await supportsTransactions()
        if (hasTransactions) {
          const session = await mongoose.startSession()
          try {
            await session.withTransaction(async () => {
              // ensure we reload the payment inside the session
              const payment = await Payment.findOne({ _id: p._id }).session(session)
              for (const t of targets) {
                if (remaining <= 0) break
                const applied = await applyPaymentToTarget(payment, t, remaining, session)
                if (applied > 0) remaining -= applied
              }
              // Ensure any targets with amount <= 0 are marked settled inside transaction
              const targetIds = targets.map(t => typeof t === 'string' ? t : (t && t.id)).filter(Boolean)
              if (targetIds.length) {
                await Payment.updateMany({ _id: { $in: targetIds }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } }).session(session)
              }
              // update appliedAmount within same transaction
              const applied = initialAmount - remaining
              if (applied > 0) {
                await Payment.findOneAndUpdate({ _id: p._id }, { $inc: { appliedAmount: applied } }, { new: true }).session(session)
              }
              // Extra guard: set settled for any house payments that became amount <= 0 (exclude current payment p)
              await Payment.updateMany({ house: h._id, _id: { $ne: p._id }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } }).session(session)
            })
          } finally {
            session.endSession()
          }
        } else {
          // fallback: apply sequentially without transactions (still uses atomic findOneAndUpdate per target)
          for (const t of targets) {
            if (remaining <= 0) break
            const applied = await applyPaymentToTarget(p, t, remaining, null)
            if (applied > 0) remaining -= applied
          }
          const reservedFallback = reserved // the findOneAndUpdate result above
          // Non-transactional fallback: mark any target with amount <=0 as settled
          const targetIds = targets.map(t => typeof t === 'string' ? t : (t && t.id)).filter(Boolean)
          if (targetIds.length) {
            await Payment.updateMany({ _id: { $in: targetIds }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } })
          }
          const applied = initialAmount - remaining
          if (applied > 0) {
            await Payment.findOneAndUpdate({ _id: p._id }, { $inc: { appliedAmount: applied } }, { new: true })
          }
        }
        // Extra guard: mark any payments in house with amount <= 0 as settled (exclude current payment p)
        await Payment.updateMany({ house: h._id, _id: { $ne: p._id }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } })
        }
        // reload latest payment after session
        p = await Payment.findById(p._id)
      }

    // recalcular deuda rápido y devolver
    const payments = await Payment.find({ house: h._id })
    const deliveries = await Delivery.find({ house: h._id })
    const totalDelivered = deliveries.reduce((s, d) => s + (d.count || 0), 0)
    const paymentsTotal = payments.reduce((s, p) => s + (p.amount || 0), 0)
    const botellon = await Product.findOne({ $or: [{ category: 'Botellones' }, { type: 'botellon' }] })
    const pricePerBotellon = botellon ? botellon.price : 0
    const totalDeliveredCost = totalDelivered * pricePerBotellon
    const pendingAmount = Math.max(0, totalDeliveredCost - paymentsTotal)

    res.json({ payment: p, pendingAmount })
  }catch(err){ res.status(400).json({ error: err.message }) }
})

// actualizar
router.put('/:id', async (req, res) => {
  const h = await House.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(h);
});

// borrar
router.delete('/:id', async (req, res) => {
  await House.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
