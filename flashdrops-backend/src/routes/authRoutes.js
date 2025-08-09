const express  = require('express');
const passport = require('passport');       // именно passport-steam!
require('../passport');                    // инициализируем стратегию
const router   = express.Router();

router.get(
  '/steam',
  passport.authenticate('steam', { failureRedirect: process.env.FRONTEND_URL })
);

router.get(
  '/steam/return',
  passport.authenticate('steam', { failureRedirect: process.env.FRONTEND_URL }),
  (req, res) => {
    res.redirect(process.env.FRONTEND_URL);
  }
);

router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json(req.user);
  }
  res.status(401).json({ error: 'Not authenticated' });
});

router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.json({ message: 'Logged out' });
  });
});

module.exports = router;
