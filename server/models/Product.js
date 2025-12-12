const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String }, // ej. botellon, limpiador, accesorio
  category: { type: String }, // categoria legible: 'Botellones', 'Limpieza', 'Otros'
  unit: { type: String }, // unidad: 'unidad','kg','litros'
  capacity: { type: Number, default: 0 }, // capacidad del tanque en litros (si aplica)
  quantity: { type: Number, default: 0 },
  price: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
