module.exports = (req, res, next) => {
  if (req.isAuthenticated()) {
    req.user.id = req.user._id; // нужно для удобства, чтобы id был доступен как req.user.id
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
};

