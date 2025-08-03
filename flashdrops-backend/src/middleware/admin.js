// flashdrops-backend/src/middleware/admin.js

module.exports = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};
