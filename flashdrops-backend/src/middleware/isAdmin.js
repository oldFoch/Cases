module.exports = function (req, res, next) {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ error: "Access denied: Admins only" });
};
