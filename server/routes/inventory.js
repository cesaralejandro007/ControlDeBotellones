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


router.get('/tanks/active', async (req, res) => {
  const tank = await Tank.findOne({ active: true }).populate('product');

  if (!tank) return res.json(null);

  res.json({
    id: tank.product._id,
    name: tank.product.name,
    quantity: tank.product.quantity,
    capacity: tank.product.capacity,
    litersPerBottle: tank.litersPerBottle,
    pricePerFill: tank.pricePerFill
  });
});



// activar tanque
// 🔁 Activar tanque (desactiva los demás)
router.put('/tanks/activate/:id', auth, isAdmin, async (req, res) => {
  // Desactivar SOLO los demás
  await Tank.updateMany(
    { product: { $ne: req.params.id } },
    { active: false }
  )

  const tank = await Tank.findOneAndUpdate(
    { product: req.params.id },
    { active: true },
    { new: true }
  ).populate('product')

  if (!tank) {
    return res.status(404).json({ error: 'Tanque no encontrado' })
  }

  res.json({
    id: tank.product._id,
    name: tank.product.name,
    quantity: tank.product.quantity,
    capacity: tank.product.capacity,
    litersPerBottle: tank.litersPerBottle,
    pricePerFill: tank.pricePerFill,
    isActive: tank.active
  })
})




// crear producto (admin)
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    let {
      name,
      type = 'producto',
      category,
      unit = 'unidad',
      quantity = 0,
      minStock = 0,
      price = 0,
      capacity = 0
    } = req.body;

    const ALLOWED_CATEGORIES = [
      'Llenado Tanque',
      'Botellones',
      'Dispensadores',
      'Artículos de limpieza',
      'Repuestos',
      'Otros'
    ];

    if (!ALLOWED_CATEGORIES.includes(category)) {
      category = 'Otros';
    }

    // si es tanque
    if (category === 'Llenado Tanque') {
      unit = 'litro';
      type = 'tanque';

      if (!capacity || capacity <= 0) {
        return res.status(400).json({ error: 'Capacidad obligatoria para el tanque' });
      }
    }

    const p = await Product.create({
      name,
      type,
      category,
      unit,
      quantity,
      minStock, // ✅ AHORA SE GUARDA
      price,
      capacity,
      isActive: category === 'Llenado Tanque' ? false : undefined
    });

    // crear registro de tanque
    if (category === 'Llenado Tanque') {
      await Tank.create({
        product: p._id,
        pricePerFill: price || 0,
        litersPerBottle: 20
      });
    }

    // movimiento inicial
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
    const newQty =
      typeof req.body.quantity === 'number'
        ? req.body.quantity
        : prevQty;

    const delta = newQty - prevQty;

    // actualizar campos
    p.name = req.body.name ?? p.name;
    p.type = req.body.type ?? p.type;
    p.category = req.body.category ?? p.category;
    p.unit = req.body.unit ?? p.unit;
    p.price = req.body.price ?? p.price;
    p.capacity = req.body.capacity ?? p.capacity;
    p.minStock = req.body.minStock ?? p.minStock; 
    p.quantity = newQty;

    // validación tanque
    if (p.category === 'Llenado Tanque') {
      p.unit = 'litro';
      if (!p.capacity || p.capacity <= 0) {
        return res.status(400).json({ error: 'Capacidad obligatoria para el tanque' });
      }
    }

    await p.save();

    // registrar movimiento
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
