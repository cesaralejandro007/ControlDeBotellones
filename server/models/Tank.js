const mongoose = require('mongoose')

const TankSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
  litersPerBottle: { type: Number, default: 20 },
  pricePerFill: { type: Number, default: 0 },
  notes: { type: String }
}, { timestamps: true })

module.exports = mongoose.model('Tank', TankSchema)
