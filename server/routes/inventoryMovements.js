const express = require('express');
const router = express.Router();
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// listar movimientos (protegido)
router.get('/', auth, async (req, res) => {
  const items = await InventoryMovement.find().populate('product').populate('user').sort({ createdAt: -1 });
  res.json(items);
});

// crear movimiento (admin)
router.post('/', auth, isAdmin, async (req, res) => {
  try{
    const { product: productId, type, quantity = 0, notes } = req.body;
    const prod = await Product.findById(productId);
    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
    // ajustar stock
    if (type === 'out' && prod.quantity < quantity) return res.status(400).json({ error: 'Stock insuficiente' });
    prod.quantity = type === 'in' ? prod.quantity + quantity : prod.quantity - quantity;
    await prod.save();
      // if this product is a tank (litro), notify if low
      try{ const { notifyTankLevel } = require('../utils/notify'); notifyTankLevel(prod) }catch(e){}
    const m = await InventoryMovement.create({ product: productId, type, quantity, notes, user: req.user.id });
    res.json({ movement: m, product: prod });
  }catch(err){ res.status(400).json({ error: err.message }) }
});

module.exports = router;
