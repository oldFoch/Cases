// flashdrops-backend/src/middleware/admin.js

module.exports = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
