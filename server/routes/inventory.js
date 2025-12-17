const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Tank = require('../models/Tank');
const InventoryMovement = require('../models/InventoryMovement');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');


// listar (protegido)
router.get('/', auth, async (req, res) => {
  const items = await Product.find().sort({ name: 1 });
  res.json(items);
});


router.get('/tanks/active', auth, async (req, res) => {
  const activeProduct = await Product.findOne({ type: 'tanque', isActive: true });
  if (!activeProduct) return res.json(null);

  const tank = await Tank.findOne({ product: activeProduct._id });

  res.json({
    id: activeProduct._id,
    name: activeProduct.name,
    type: activeProduct.type,
    quantity: activeProduct.quantity,
    capacity: activeProduct.capacity,
    pricePerFill: tank?.pricePerFill || 0,
    litersPerBottle: tank?.litersPerBottle || 20
  });
});

// activar tanque
router.put('/tanks/activate/:id', auth, isAdmin, async (req, res) => {
  const id = req.params.id;

  // desactivar todos
  await Product.updateMany({ type: 'tanque' }, { isActive: false });

  // activar seleccionado
  await Product.findByIdAndUpdate(id, { isActive: true });

  res.json({ ok: true });
});


// crear producto (admin)
router.post('/', auth, isAdmin, async (req, res) => {
  try {

    let { name, type, category, unit, quantity = 0, price = 0, capacity = 0 } = req.body;

    const allowedCategories = ['Llenado Tanque', 'Botellones', 'Artículos de limpieza'];
    if (!allowedCategories.includes(category)) category = 'Otros';

    if (category === 'Llenado Tanque') {
      unit = 'litro';
      if (!capacity || capacity <= 0) {
        return res.status(400).json({ error: 'Capacidad obligatoria' });
      }
    }

    const p = await Product.create({
      name,
      type,
      category,
      unit,
      quantity,
      price,
      capacity,
      isActive: category === 'Llenado Tanque' ? false : undefined
    });

    // tanque → crear registro Tank
    if (category === 'Llenado Tanque') {
      await Tank.create({
        product: p._id,
        pricePerFill: price || 0,
        litersPerBottle: 20 // agregar esta línea
      });
    }

    if (quantity > 0) {
      await InventoryMovement.create({
        product: p._id,
        type: 'in',
        quantity,
        notes: 'Creación inicial',
        user: req.user.id
      });
    }

    res.json(p);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// actualizar (admin)
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });

    const prevQty = p.quantity || 0;
    const newQty = typeof req.body.quantity === 'number' ? req.body.quantity : prevQty;
    const delta = newQty - prevQty;

    p.name = req.body.name ?? p.name;
    p.type = req.body.type ?? p.type;
    p.category = req.body.category ?? p.category;
    p.unit = req.body.unit ?? p.unit;
    p.price = req.body.price ?? p.price;

    if (req.body.category === 'Llenado Tanque') {
      p.unit = 'litro';
      if (req.body.capacity <= 0) {
        return res.status(400).json({ error: 'Capacidad obligatoria' });
      }
    }

    p.capacity = req.body.capacity ?? p.capacity;
    p.quantity = newQty;

    await p.save();

    if (delta !== 0) {
      await InventoryMovement.create({
        product: p._id,
        type: delta > 0 ? 'in' : 'out',
        quantity: Math.abs(delta),
        notes: 'Ajuste manual',
        user: req.user.id
      });
    }

    res.json(p);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


router.delete('/:id', auth, isAdmin, async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  if (product.type === 'tanque' && product.isActive) {
    return res.status(400).json({ error: 'No puedes eliminar el tanque activo' });
  }

  if (product.type === 'tanque') {
    product.isActive = false;
    await product.save();
    return res.json({ ok: true, disabled: true });
  }

  await Product.findByIdAndDelete(req.params.id);

  res.json({ ok: true });
});


module.exports = router;
