const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String }, // ej. botellon, tanque
  category: { type: String },
  unit: { type: String },
  capacity: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  price: { type: Number, default: 0 },

  // 👇 ESTE ES EL CAMPO QUE FALTABA
  isActive: { type: Boolean, default: false }

}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
