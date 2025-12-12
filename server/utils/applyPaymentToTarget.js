const Payment = require('../models/Payment')

/**
 * Apply amount from a confirmed payment to a target pending payment atomically.
 * @param {Document} payment - source payment doc (confirmed)
 * @param {Object|string} target - target with { id, amount } or id string
 * @param {Number} remaining - remaining amount available to apply
 * @param {ClientSession} session - optional mongoose session
 * @returns {Number} - amount successfully applied
 */
module.exports = async function applyPaymentToTarget(payment, target, remaining, session = null) {
  try {
    if (!payment) return 0
  const tId = typeof target === 'string' ? target : (target && target.id) || null
  const tAmountHint = target && target.amount
  if (!tId) return 0
  let pend
  if (session) pend = await Payment.findById(tId).session(session)
  else pend = await Payment.findById(tId)
  if (!pend) return 0
  if (String(pend.house) !== String(payment.house)) return 0
  if (pend.confirmed || pend.settled) return 0
  const pendAmount = pend.amount || 0
  const toApply = Math.min(remaining, tAmountHint || pendAmount || 0)
  if (toApply <= 0) return 0
  if (toApply >= pendAmount) {
    const updated = await (session
      ? Payment.findOneAndUpdate({ _id: pend._id, confirmed: false, settled: false }, { $set: { settled: true, settledBy: payment._id, settledAt: new Date(), amount: 0 } }, { new: true }).session(session)
      : Payment.findOneAndUpdate({ _id: pend._id, confirmed: false, settled: false }, { $set: { settled: true, settledBy: payment._id, settledAt: new Date(), amount: 0 } }, { new: true }))
    if (updated) return pendAmount
    return 0
  } else {
    const updated = await (session
      ? Payment.findOneAndUpdate({ _id: pend._id, confirmed: false, settled: false, amount: { $gte: toApply } }, { $inc: { amount: -toApply } }, { new: true }).session(session)
      : Payment.findOneAndUpdate({ _id: pend._id, confirmed: false, settled: false, amount: { $gte: toApply } }, { $inc: { amount: -toApply } }, { new: true }))
    if (updated) return toApply
    return 0
  }
  } catch (err) { console.error('[ERROR] in applyPaymentToTarget', err && err.stack); throw err }
}
