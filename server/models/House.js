const mongoose = require('mongoose');

const HouseSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // ej. P-19
  number: { type: String },
  ownerName: { type: String },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('House', HouseSchema);
