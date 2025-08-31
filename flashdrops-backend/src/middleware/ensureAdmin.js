module.exports = function ensureAdmin(req, res, next) {
  try {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  } catch {
    return res.status(403).json({ error: 'forbidden' });
  }
};
