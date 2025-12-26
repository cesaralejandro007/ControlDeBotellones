const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

// listar usuarios (admin) con paginación: ?page=1&limit=20
router.get("/", auth, isAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const search = (req.query.search || "").trim();

  const filter = {};
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, ""), "i");
    filter.$or = [{ name: re }, { email: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ users, page, limit, total });
});

// cambiar rol (admin)
router.put("/:id/role", auth, isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
    u.role = role;
    await u.save();
    res.json({
      ok: true,
      user: { id: u._id, name: u.name, email: u.email, role: u.role },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// eliminar usuario (admin)
router.delete("/:id", auth, isAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
