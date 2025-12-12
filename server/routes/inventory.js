const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// listar (protegido)
router.get('/', auth, async (req, res) => {
  const items = await Product.find().sort({ name: 1 });
  res.json(items);
});

// crear producto (admin)
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    let { name, type, category, unit, quantity = 0, price = 0, capacity = 0 } = req.body;

    // normalize category names
    const allowedCategories = ['Llenado Tanque', 'Botellones', 'Artículos de limpieza']
    if (!allowedCategories.includes(category)) category = 'Otros'

    // set default unit based on category
    if (category === 'Llenado Tanque') unit = 'litro'
    if (category === 'Botellones') unit = 'unidad'

    // for tank product ensure capacity sensible (must be > 0)
    if (category === 'Llenado Tanque') {
      if (!capacity || capacity <= 0) return res.status(400).json({ error: 'Capacidad (litros) obligatoria y mayor que 0 para Llenado Tanque' })
    }

    const p = await Product.create({ name, type, category, unit, quantity, price, capacity });
      // If the product is a tank, create a Tank entry linked to this product
      if (category === 'Llenado Tanque'){
        const Tank = require('../models/Tank')
        try{ await Tank.create({ product: p._id, pricePerFill: price || 0 }) }catch(e){}
      }
    if (quantity > 0) {
      await InventoryMovement.create({ product: p._id, type: 'in', quantity, notes: 'Creación inicial', user: req.user.id });
    }
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// actualizar (admin)
router.put('/:id', auth, isAdmin, async (req, res) => {
  try{
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    // si cambió quantity, registrar movimiento
    const prevQty = p.quantity || 0;
    const newQty = typeof req.body.quantity === 'number' ? req.body.quantity : prevQty;
    const delta = newQty - prevQty;
    p.name = req.body.name ?? p.name;
    p.type = req.body.type ?? p.type;
    p.category = req.body.category ?? p.category;
    p.unit = req.body.unit ?? p.unit;
    p.price = req.body.price ?? p.price;
    // normalize category and unit on update
    if (req.body.category) {
      const allowedCategories = ['Llenado Tanque', 'Botellones', 'Artículos de limpieza']
      p.category = allowedCategories.includes(req.body.category) ? req.body.category : req.body.category
      if (p.category === 'Llenado Tanque') p.unit = 'litro'
      if (p.category === 'Botellones') p.unit = 'unidad'
    }
    if (req.body.category === 'Llenado Tanque' && (typeof req.body.capacity !== 'number' || req.body.capacity <= 0)) {
      return res.status(400).json({ error: 'Capacidad (litros) obligatoria y mayor que 0 para Llenado Tanque' })
    }
    p.capacity = typeof req.body.capacity === 'number' ? req.body.capacity : p.capacity;
    p.quantity = newQty;
    await p.save();
    if (delta !== 0) {
      await InventoryMovement.create({ product: p._id, type: delta > 0 ? 'in' : 'out', quantity: Math.abs(delta), notes: 'Ajuste manual', user: req.user.id });
    }
    res.json(p);
  }catch(err){ res.status(400).json({ error: err.message }) }
});

// borrar (admin)
router.delete('/:id', auth, isAdmin, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
