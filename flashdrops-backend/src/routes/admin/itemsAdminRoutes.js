'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../db');

const DEFAULT_MARKUP = Number(process.env.DEFAULT_MARKUP || 12);
const WAXPEER_API_KEY = process.env.WAXPEER_API_KEY || '';

/* ---------- ensure schema ---------- */
async function ensureItemsMaster() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS items_master (
      id               SERIAL PRIMARY KEY,
      market_hash_name TEXT UNIQUE NOT NULL,
      name             TEXT NOT NULL,
      image            TEXT,
      base_price_rub   NUMERIC(12,2) NOT NULL,
      markup_percent   NUMERIC(5,2) DEFAULT 12,
      price_rub        NUMERIC(12,2) NOT NULL,
      updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_items_master_mhn ON items_master(market_hash_name);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_items_master_updated ON items_master(updated_at);`);
}

/* ---------- upsert batch ---------- */
async function upsertItems(jsonArr, defaultMarkup) {
  if (!Array.isArray(jsonArr) || jsonArr.length === 0) return 0;
  const payload = JSON.stringify(jsonArr);
  const sql = `
    WITH src AS (
      SELECT *
      FROM jsonb_to_recordset($1::jsonb)
        AS t(
          market_hash_name TEXT,
          name             TEXT,
          image            TEXT,
          base_price_rub   NUMERIC
        )
    )
    INSERT INTO items_master (
      market_hash_name, name, image, base_price_rub, markup_percent, price_rub, updated_at
    )
    SELECT
      s.market_hash_name,
      COALESCE(NULLIF(s.name, ''), s.market_hash_name) AS name,
      NULLIF(s.image, '') AS image,
      ROUND(s.base_price_rub::NUMERIC, 2) AS base_price_rub,
      $2::NUMERIC(5,2) AS markup_percent,
      ROUND( (s.base_price_rub::NUMERIC) * (1 + $2::NUMERIC / 100.0), 2 ) AS price_rub,
      NOW()
    FROM src s
    ON CONFLICT (market_hash_name) DO UPDATE
    SET
      name           = EXCLUDED.name,
      image          = EXCLUDED.image,
      base_price_rub = EXCLUDED.base_price_rub,
      price_rub      = ROUND(EXCLUDED.base_price_rub * (1 + COALESCE(items_master.markup_percent, $2) / 100.0), 2),
      updated_at     = NOW()
  `;
  await db.query(sql, [payload, defaultMarkup]);
  return jsonArr.length;
}

/* ---------- normalizers for different Waxpeer shapes ---------- */
function normalizeArray(arr) {
  const out = [];
  for (const it of arr) {
    // возможные ключи
    const mhn = it.market_hash_name || it.name || it.hash_name || it.title;
    if (!mhn) continue;

    const name = it.name || it.title || it.market_hash_name || mhn;
    const image = it.img || it.image || it.icon_url || null;

    let price = it.price_rub ?? it.price ?? it.min_price ?? it.min ?? it.value ?? null;
    if (price == null) continue;
    price = Number(price);
    if (!Number.isFinite(price) || price <= 0) continue;

    out.push({
      market_hash_name: String(mhn),
      name: String(name),
      image: image ? String(image) : null,
      base_price_rub: price
    });
  }
  return out;
}

function normalizeObjectMap(obj) {
  // некоторые эндпоинты возвращают: { items: { "AK-47 | ...": 12345, ... } } или { "AK-47 | ...": {...} }
  const out = [];
  for (const [key, val] of Object.entries(obj || {})) {
    const mhn = key;
    if (!mhn) continue;

    if (val == null) continue;
    let price = null;
    let name = mhn;
    let image = null;

    if (typeof val === 'number') {
      price = val;
    } else if (typeof val === 'object') {
      price = val.price_rub ?? val.price ?? val.min ?? val.min_price ?? null;
      name  = val.name || val.title || mhn;
      image = val.img || val.image || val.icon_url || null;
    }

    price = Number(price);
    if (!Number.isFinite(price) || price <= 0) continue;

    out.push({
      market_hash_name: mhn,
      name,
      image: image ? String(image) : null,
      base_price_rub: price
    });
  }
  return out;
}

function normalizeWaxpeerData(raw) {
  // пробуем разные формы
  // 1) { data: [...] } или { items: [...] }
  if (Array.isArray(raw?.data)) return normalizeArray(raw.data);
  if (Array.isArray(raw?.items)) return normalizeArray(raw.items);

  // 2) { items: { mhn: price|obj } }
  if (raw && raw.items && typeof raw.items === 'object' && !Array.isArray(raw.items)) {
    return normalizeObjectMap(raw.items);
  }

  // 3) сам объект-словарь: { mhn: price|obj }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeObjectMap(raw);
  }

  // 4) массив верхнего уровня
  if (Array.isArray(raw)) return normalizeArray(raw);

  return [];
}

/* ---------- fetch helpers ---------- */
async function fetchJson(url, headers = {}) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { method: 'GET', headers, signal: ctrl.signal });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = null; }
    return { ok: r.ok, status: r.status, body: json ?? text };
  } finally {
    clearTimeout(to);
  }
}

/**
 * Пытаемся по очереди разные Waxpeer эндпоинты.
 * Как только получаем непустую нормализованную выборку — возвращаем её.
 */
async function tryWaxpeerEndpoints(apiKey) {
  const candidates = [
    // старый prices csgo
    `https://api.waxpeer.com/v1/prices?game=csgo&api=${encodeURIComponent(apiKey)}`,
    // cs2
    `https://api.waxpeer.com/v1/prices?game=cs2&api=${encodeURIComponent(apiKey)}`,
    // lowest_prices
    `https://api.waxpeer.com/v1/lowest_prices?game=cs2&api=${encodeURIComponent(apiKey)}`,
    `https://api.waxpeer.com/v1/lowest_prices?game=csgo&api=${encodeURIComponent(apiKey)}`,
    // иногда используют app=730
    `https://api.waxpeer.com/v1/items/prices?app=730&api=${encodeURIComponent(apiKey)}`,
    // альтернативный список
    `https://api.waxpeer.com/v1/get-items-list?game=cs2&api=${encodeURIComponent(apiKey)}`
  ];

  for (const url of candidates) {
    const { ok, status, body } = await fetchJson(url, { 'Accept': 'application/json' });
    if (!ok) continue;
    const items = normalizeWaxpeerData(body);
    if (items.length) {
      return { items, used: url };
    }
  }
  return { items: [], used: null };
}

/* ---------- routes ---------- */

// Тянем из Waxpeer, сохраняем в items_master
router.get('/sync-waxpeer', async (req, res) => {
  if (!WAXPEER_API_KEY) {
    return res.status(400).json({ ok: false, error: 'WAXPEER_API_KEY не задан в .env' });
  }
  try {
    await ensureItemsMaster();
    const { items, used } = await tryWaxpeerEndpoints(WAXPEER_API_KEY);
    if (!items.length) {
      return res.json({ ok: true, used, synced: 0, note: 'Пустые данные от Waxpeer (все варианты вернули 0)' });
    }
    const n = await upsertItems(items, DEFAULT_MARKUP);
    return res.json({ ok: true, used, synced: n });
  } catch (e) {
    console.error('[itemsAdminRoutes] sync-waxpeer error:', e);
    return res.status(500).json({ ok: false, error: e.message || 'sync error' });
  }
});

// Ручной апсерт JSON: [{ market_hash_name, name?, image?, base_price_rub }]
router.post('/upsert-json', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    await ensureItemsMaster();
    const arr = Array.isArray(req.body) ? req.body : [];
    const norm = normalizeWaxpeerData(arr); // на случай, если пришла карта/иной вид
    const n = await upsertItems(norm, DEFAULT_MARKUP);
    res.json({ ok: true, inserted_or_updated: n });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'upsert error' });
  }
});

module.exports = router;
