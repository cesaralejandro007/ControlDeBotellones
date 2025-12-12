module.exports = function (req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Requiere rol admin' });
  next();
}
