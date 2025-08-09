// flashdrops-backend/src/app.js
require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const cors     = require('cors');
const helmet   = require('helmet');
const passport = require('./passport');

const db            = require('./db');
const authRoutes    = require('./routes/authRoutes');
const userRoutes    = require('./routes/userRoutes');
const caseRoutes    = require('./routes/caseRoutes');
const adminRoutes   = require('./routes/adminRoutes');
const dropsRoutes   = require('./routes/dropsRoutes');
const depositRoutes = require('./routes/depositRoutes');

const app = express();

// ---- Basics / Security
const isProd = process.env.NODE_ENV === 'production';
const ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  name: 'flashdrops.sid',
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure:   false, // 👉 в dev оставляем false; с HTTPS/прокси поднимем на проде
    maxAge:   1000 * 60 * 60 * 24 * 7,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// ---- Routes
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/cases',    caseRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/drops',    dropsRoutes);
app.use('/api/deposits', depositRoutes);

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---- DB ping
db.query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch((err) => console.error('❌ PostgreSQL connection error:', err));

// ---- Price updater (optional)
let cron = null;
try { cron = require('node-cron'); } catch {}
if (cron) {
  try {
    const { updateAllPrices } = require('./services/priceUpdater');
    updateAllPrices().catch(e => console.warn('Price update on boot failed:', e.message));
    const CRON = process.env.PRICE_UPDATE_CRON || '0 3 * * *';
    cron.schedule(CRON, () => {
      console.log('[CRON] Updating Steam prices...');
      updateAllPrices().catch((e) => console.error('Price updater error:', e));
    });
  } catch (e) {
    console.warn('[CRON] price updater not loaded:', e.message);
  }
} else {
  console.warn('[CRON] node-cron not installed — price updates disabled');
}

module.exports = app;
