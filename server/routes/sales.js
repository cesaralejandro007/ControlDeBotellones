const express = require('express')
const router = express.Router()
const Product = require('../models/Product')
const Sale = require('../models/Sale')
const InventoryMovement = require('../models/InventoryMovement')
const auth = require('../middleware/auth')
const isAdmin = require('../middleware/isAdmin')

// registrar venta (descontar inventario)
router.post('/', auth, isAdmin, async (req, res) => {
  try{
    const { productId, quantity = 1, amount, notes } = req.body
    const p = await Product.findById(productId)
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' })
    if ((p.quantity || 0) < quantity) return res.status(400).json({ error: 'Stock insuficiente' })

    p.quantity = (p.quantity || 0) - quantity
    await p.save()

    const sale = await Sale.create({ product: p._id, quantity, amount: amount || (p.price * quantity), notes, user: req.user.id })

    // movimiento de inventario
    try{ await InventoryMovement.create({ product: p._id, type: 'out', quantity, notes: `Venta: ${notes || ''}`, user: req.user.id }) }catch(e){ }

    res.json({ sale, product: p })
  }catch(err){ res.status(400).json({ error: err.message }) }
})

module.exports = router
