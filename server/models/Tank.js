const mongoose = require('mongoose')

const TankSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  litersPerBottle: { type: Number, default: 20 },
  pricePerFill: { type: Number, default: 0 },
  active: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false } // 👈 NUEVO
}, { timestamps: true })


module.exports = mongoose.model('Tank', TankSchema)
