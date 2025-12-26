// Script para corregir el campo type de los productos de tanques
const mongoose = require('mongoose');
const Product = require('../models/Product');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/controlbotellones'); // Ajusta el string de conexión si es necesario
  const result = await Product.updateMany(
    { category: 'Llenado Tanque' },
    { $set: { type: 'tanque' } }
  );
  console.log('Productos actualizados:', result.modifiedCount);
  await mongoose.disconnect();
}

main().catch(console.error);
