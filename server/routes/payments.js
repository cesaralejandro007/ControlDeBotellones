const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const mongoose = require('mongoose');
const applyPaymentToTarget = require('../utils/applyPaymentToTarget')
const Delivery = require('../models/Delivery');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// listar pagos
router.get('/', auth, async (req, res) => {
  const items = await Payment.find({
    amount: { $gt: 0 }
  })
    .populate('house')
    .sort({ date: -1 });

  res.json(items);
});

// pagos de una casa
router.get('/house/:houseId', auth, async (req, res) => {
  const items = await Payment.find({ house: req.params.houseId }).sort({ date: -1 });
  res.json(items);
});

// crear pago (solo admin)
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const crypto = require('crypto')
    const { idempotencyKey } = req.body
    let p
    if (idempotencyKey) {
      try {
        p = await Payment.findOneAndUpdate({ idempotencyKey, house: req.body.house }, { $setOnInsert: { ...req.body, idempotencyKey } }, { new: true, upsert: true })
      } catch (err) {
        if (err.code === 11000) p = await Payment.findOne({ idempotencyKey, house: req.body.house })
        else throw err
      }
    } else {
      // normalize targets if passed in body (for consistent idempotency across re-orderings)
      const normalizedTargets = Array.isArray(req.body.targets) ? [...req.body.targets].sort((a,b) => (String((a && a.id) || a) > String((b && b.id) || b) ? 1 : -1)) : []
      const key = crypto.createHash('sha256').update(JSON.stringify({ house: req.body.house, amount: req.body.amount, description: req.body.description, prepaidBotellones: req.body.prepaidBotellones, targets: normalizedTargets })).digest('hex')
      try {
        p = await Payment.findOneAndUpdate({ idempotencyKey: key, house: req.body.house }, { $setOnInsert: { ...req.body, idempotencyKey: key } }, { new: true, upsert: true })
      } catch (err) {
        if (err.code === 11000) p = await Payment.findOne({ idempotencyKey: key, house: req.body.house })
        else throw err
      }
    }
    // If targets provided and payment is confirmed, apply now (similar to house pay behavior)
    if (Array.isArray(req.body.targets) && req.body.targets.length > 0 && p.confirmed) {
      const { supportsTransactions } = require('../utils/mongoSupport')
      const hasTransactions = await supportsTransactions()
      const targets = req.body.targets
      const initialAmount = p.amount || 0
      const normalizedTargets = [...targets].sort((a,b) => (String((a && a.id) || a) > String((b && b.id) || b) ? 1 : -1))
      const applyKey = crypto.createHash('sha256').update(JSON.stringify({ applyToOldest: false, targets: normalizedTargets })).digest('hex')
      // Reserve apply operation on the created payment
      const reserved = await Payment.findOneAndUpdate({ _id: p._id, appliedKeys: { $ne: applyKey } }, { $push: { appliedKeys: applyKey } }, { new: true })
      if (reserved) {
        if (hasTransactions) {
          const session = await mongoose.startSession()
          try {
            await session.withTransaction(async () => {
              const payment = await Payment.findOne({ _id: p._id }).session(session)
              let rem = payment.amount || 0
              for (const t of targets) {
                if (rem <= 0) break
                const applied = await applyPaymentToTarget(payment, t, rem, session)
                if (applied > 0) rem -= applied
              }
              const targetIds = targets.map(t => typeof t === 'string' ? t : (t && t.id)).filter(Boolean)
              if (targetIds.length) await Payment.updateMany({ _id: { $in: targetIds }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } }).session(session)
              const applied = initialAmount - rem
              if (applied > 0) await Payment.findOneAndUpdate({ _id: p._id }, { $inc: { appliedAmount: applied } }, { new: true }).session(session)
              await Payment.updateMany({ house: p.house, _id: { $ne: p._id }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } }).session(session)
            })
          } finally {
            session.endSession()
          }
        } else {
          let rem = initialAmount
          for (const t of targets) {
            if (rem <= 0) break
            const applied = await applyPaymentToTarget(p, t, rem)
            if (applied > 0) rem -= applied
          }
          const targetIds = targets.map(t => typeof t === 'string' ? t : (t && t.id)).filter(Boolean)
          if (targetIds.length) await Payment.updateMany({ _id: { $in: targetIds }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } })
          const applied = initialAmount - rem
          if (applied > 0) await Payment.findOneAndUpdate({ _id: p._id }, { $inc: { appliedAmount: applied } }, { new: true })
          await Payment.updateMany({ house: p.house, _id: { $ne: p._id }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } })
        }
        p = await Payment.findById(p._id)
      }
    }
    res.json(p);
  } catch (err) { console.error('[ERROR] apply payment', err && err.message); console.error(err.stack); res.status(400).json({ error: err.message }); }
});

// Confirmar pago con datos bancarios (solo admin)
router.put('/:id/confirm', auth, isAdmin, async (req, res) => {
  try {
    const { reference, bank, identification, phone } = req.body

    if (!reference || !bank || !identification || !phone) {
      return res.status(400).json({
        error: 'Datos bancarios incompletos'
      })
    }

    const p = await Payment.findById(req.params.id)
    if (!p) {
      return res.status(404).json({ error: 'Pago no encontrado' })
    }

    if (p.confirmed) {
      return res.status(400).json({ error: 'El pago ya está confirmado' })
    }

    p.confirmed = true
    p.confirmedAt = new Date()
    p.confirmedBy = req.user?._id || null

    p.reference = reference
    p.bank = bank
    p.identification = identification
    p.phone = phone

    await p.save()

    res.json(p)
  } catch (err) {
    console.error('[ERROR] Confirm payment failed', err)
    res.status(500).json({ error: err.message })
  }
})

// Apply a confirmed payment to pending debts - admin only
router.post('/:id/apply', auth, isAdmin, async (req, res) => {
  try {
    let p = await Payment.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    console.log('[DEBUG] Applying payment', p._id, 'amount', p.amount, 'confirmed', p.confirmed)
    if (!p.confirmed) { console.log('[DEBUG] Payment not confirmed', p._id); return res.status(400).json({ error: 'Payment must be confirmed to apply' }) }
    let remaining = p.amount || 0;
    console.log('[DEBUG] Remaining for apply', remaining)
    if (remaining <= 0) { console.log('[DEBUG] No remaining for payment', p._id, remaining); return res.status(400).json({ error: 'No available amount to apply' }) }
    const { targets, applyToOldest } = req.body;
    const crypto = require('crypto')
    if (Array.isArray(targets) && targets.length > 0) {
      const { supportsTransactions } = require('../utils/mongoSupport')
      const hasTransactions = await supportsTransactions()
      const initialAmount = p.amount || 0
      const normalizedTargets = [...targets].sort((a,b) => (String((a && a.id) || a) > String((b && b.id) || b) ? 1 : -1))
      const applyKey = crypto.createHash('sha256').update(JSON.stringify({ applyToOldest: false, targets: normalizedTargets })).digest('hex')
      // Reserve this apply operation on the payment to prevent concurrent duplicate applies
      const reserved = await Payment.findOneAndUpdate({ _id: p._id, appliedKeys: { $ne: applyKey } }, { $push: { appliedKeys: applyKey } }, { new: true })
      if (!reserved) {
        // Already applied by another request; reload and skip applying
        p = await Payment.findById(p._id)
      } else {
        if (hasTransactions) {
          console.log('[DEBUG] Applying with transaction')
          const session = await mongoose.startSession()
          try {
            await session.withTransaction(async () => {
              const payment = await Payment.findOne({ _id: p._id }).session(session)
              let rem = payment.amount || 0
              for (const t of targets) {
                if (rem <= 0) break
                const applied = await applyPaymentToTarget(payment, t, rem, session)
                if (applied > 0) rem -= applied
              }
              // mark any target payments with amount <=0 as settled inside transaction
              const targetIds = targets.map(t => typeof t === 'string' ? t : (t && t.id)).filter(Boolean)
              if (targetIds.length) {
                await Payment.updateMany({ _id: { $in: targetIds }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } }).session(session)
              }
              const applied = initialAmount - rem
              if (applied > 0) await Payment.findOneAndUpdate({ _id: p._id }, { $inc: { appliedAmount: applied } }, { new: true }).session(session)
              // Extra guard: set as settled any house payments that became amount <= 0 (exclude the source payment p)
              await Payment.updateMany({ house: p.house, _id: { $ne: p._id }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } }).session(session)
            })
          } finally {
            session.endSession()
          }
        } else {
          console.log('[DEBUG] Applying without transaction (fallback)')
          // fallback: apply sequentially without transactions
          let rem = initialAmount
          for (const t of targets) {
            if (rem <= 0) break
            const applied = await applyPaymentToTarget(p, t, rem)
            if (applied > 0) rem -= applied
          }
          // Non-transactional fallback: mark target payments with amount <=0 as settled
          const targetIds = targets.map(t => typeof t === 'string' ? t : (t && t.id)).filter(Boolean)
          if (targetIds.length) await Payment.updateMany({ _id: { $in: targetIds }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } })
          const applied = initialAmount - rem
          if (applied > 0) await Payment.findOneAndUpdate({ _id: p._id }, { $inc: { appliedAmount: applied } }, { new: true })
          // Extra guard: mark any payments in house with amount <= 0 as settled (exclude the current payment p)
          await Payment.updateMany({ house: p.house, _id: { $ne: p._id }, amount: { $lte: 0 }, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } })
        }
      }
      p = await Payment.findById(p._id)
      remaining = p.amount || 0
    }
    if (applyToOldest && remaining > 0) {
      // Reserve apply-to-oldest operation to avoid concurrent duplication
      const applyKeyOldest = crypto.createHash('sha256').update(JSON.stringify({ applyToOldest: true, paymentId: String(p._id) })).digest('hex')
      const reservedOldest = await Payment.findOneAndUpdate({ _id: p._id, appliedKeys: { $ne: applyKeyOldest } }, { $push: { appliedKeys: applyKeyOldest } }, { new: true })
      if (!reservedOldest) {
        p = await Payment.findById(p._id)
      } else {
        console.log('[DEBUG] applyToOldest path executed for payment', p._id, 'remaining', remaining)
        const pendings = await Payment.find({ house: p.house, confirmed: false, settled: false, prepaidBotellones: 0 }).sort({ date: 1 });
        for (const pend of pendings) {
          console.log('[DEBUG] Considering pending', pend._id, 'amount', pend.amount, 'remaining', remaining)
          if (remaining <= 0) break;
          const pendAmount = pend.amount || 0;
          if (remaining >= pendAmount) {
            const updated = await Payment.findOneAndUpdate({ _id: pend._id, confirmed: false, settled: false }, { $set: { settled: true, settledBy: p._id, settledAt: new Date(), amount: 0 } }, { new: true });
            if (updated) remaining -= pendAmount;
          } else {
            const updated = await Payment.findOneAndUpdate({ _id: pend._id, confirmed: false, settled: false, amount: { $gte: remaining } }, { $inc: { amount: -remaining } }, { new: true });
            if (updated) remaining = 0;
          }
          console.log('[DEBUG] After attempt: pending', pend._id, 'remaining', remaining)
        }
      }
    }
    // Track applied amount on the original payment (do not change original amount)
    const appliedTotal = (p.amount || 0) - remaining;
    console.log('[DEBUG] Applied total to track on payment', String(p._id), 'appliedTotal', appliedTotal)
    if (appliedTotal > 0) {
      console.log('[DEBUG] Increment appliedAmount on payment', String(p._id))
      await Payment.findOneAndUpdate({ _id: p._id }, { $inc: { appliedAmount: appliedTotal } }, { new: true });
      console.log('[DEBUG] Reloading payment', String(p._id))
      try {
        p = await Payment.findById(p._id);
        console.log('[DEBUG] Reloaded payment appliedAmount', p && p.appliedAmount)
      } catch (err) {
        console.error('[ERROR] Failed reloading payment after apply', err && err.stack)
        throw err
      }
    }
    console.log('[DEBUG] Apply finished, returning success', p._id)
    res.json({ payment: p });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// balance de anticipos para una casa: sum(prepaidBotellones) - sum(deliveries.usedPrepaid)
router.get('/balance/house/:houseId', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ house: req.params.houseId });
    // Only confirmed payments count as prepaid
    const prepaid = payments.filter(p => p.confirmed).reduce((s, p) => s + (p.prepaidBotellones || 0), 0);
    const deliveries = await Delivery.find({ house: req.params.houseId, usedPrepaid: true });
    const used = deliveries.reduce((s, d) => s + (d.count || 0), 0);
    res.json({ prepaid, used, balance: prepaid - used });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
