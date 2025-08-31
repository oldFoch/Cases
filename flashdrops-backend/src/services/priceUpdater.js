// flashdrops-backend/src/services/priceUpdater.js
'use strict';

const axios = require('axios');
const db = require('../db');

/**
 * ENV:
 *   WAXPEER_API_KEY
 *   WAXPEER_APPID=730
 *   WAXPEER_MIN_PRICE
 *   WAXPEER_MAX_ITEMS
 *   PRICE_DEFAULT_MARKUP
 *   PRICE_CURRENCY=RUB|USD
 *   FX_USD_RUB
 *   WAXPEER_PRICE_SCALE   // фикс ×10: 0.1
 */

const API_KEY = process.env.WAXPEER_API_KEY || '';
const APPID = Number(process.env.WAXPEER_APPID || 730);
const MIN_PRICE = Number(process.env.WAXPEER_MIN_PRICE || 0);
const MAX_ITEMS = Number(process.env.WAXPEER_MAX_ITEMS || 5000);

const DEFAULT_MARKUP = Number(process.env.PRICE_DEFAULT_MARKUP || 12);
const PRICE_CURRENCY = (process.env.PRICE_CURRENCY || 'RUB').toUpperCase();
const FX_USD_RUB = Number(process.env.FX_USD_RUB || 90);
const SCALE = Number(process.env.WAXPEER_PRICE_SCALE || 1);

const WAXPEER_URLS = [
  'https://api.waxpeer.com/v1/prices',
  'https://api.waxpeer.com/v1/steam_items/prices',
];

/* ---------- name parsing ---------- */

const QUALITY_MAP = {
  'factory new': 'FN',
  'minimal wear': 'MW',
  'field-tested': 'FT',
  'well-worn': 'WW',
  'battle-scarred': 'BS',
};

function extractBaseAndQuality(marketName) {
  const s = String(marketName);
  const m = s.match(/\(([^)]+)\)\s*$/);
  if (!m) return { base_name: s.trim(), quality: null };
  const qStr = m[1].trim().toLowerCase();
  const quality = QUALITY_MAP[qStr] || null;
  const base_name = s.replace(/\s*\([^)]+\)\s*$/, '').trim();
  return { base_name, quality };
}

/* ---------- fetch & normalize ---------- */

async function fetchWaxpeerPrices() {
  if (!API_KEY) throw new Error('WAXPEER_API_KEY is not set');

  for (const base of WAXPEER_URLS) {
    try {
      const url = `${base}?api=${encodeURIComponent(API_KEY)}&appid=${APPID}`;
      const { data } = await axios.get(url, { timeout: 30000 });

      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.items)) return data.items;
      if (data && Array.isArray(data.data)) return data.data;

      if (data && typeof data === 'object') {
        return Object.entries(data).map(([name, price]) => ({ name, price }));
      }
    } catch (e) {
      console.warn('[waxpeer] fetch error:', e.message);
    }
  }
  throw new Error('Failed to fetch from Waxpeer');
}

function pickBasePriceNumber(it) {
  const cand = [
    it.avg, it.avg_price, it.average,
    it.median, it.mediana,
    it.min, it.min_price, it.lowest_price,
    it.last_price, it.lastSale, it.last_sale,
    it.price,
  ];
  for (const v of cand) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function toRub(n) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const rub = PRICE_CURRENCY === 'USD' ? n * FX_USD_RUB : n;
  const scaled = rub * (SCALE > 0 ? SCALE : 1);
  return Math.round(scaled * 100) / 100;
}

function normalizeWaxpeerItems(raw) {
  const out = [];
  for (const it of raw) {
    const name = it.market_hash_name || it.marketName || it.name || it.title;
    if (!name) continue;

    const { base_name, quality } = extractBaseAndQuality(name);
    const image = it.image || it.img || it.icon_url || null;

    const base = pickBasePriceNumber(it);
    if (!base) continue;

    const priceRub = toRub(base);
    if (!(priceRub > 0) || priceRub < MIN_PRICE) continue;

    out.push({
      market_hash_name: String(name).trim(),
      base_name,
      quality,
      base_price_rub: priceRub,
      img_url: image ? String(image) : null,
    });

    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/* ---------- schema ensure ---------- */

async function ensureSchema() {
  await db.query(`
    BEGIN;

    -- items_master
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='items_master'
      ) THEN
        CREATE TABLE items_master (
          id               SERIAL PRIMARY KEY,
          name             TEXT NOT NULL,
          market_hash_name TEXT UNIQUE NOT NULL,
          base_name        TEXT NOT NULL,
          quality          TEXT,
          image            TEXT,
          base_price_rub   NUMERIC(12,2) NOT NULL,
          markup_percent   NUMERIC(5,2)  DEFAULT ${DEFAULT_MARKUP},
          price_rub        NUMERIC(12,2) NOT NULL,
          updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX idx_items_master_base_name ON items_master(base_name);
        CREATE INDEX idx_items_master_updated  ON items_master(updated_at DESC);
      ELSE
        PERFORM 1;
      END IF;
    END$$;

    -- ensure columns (idempotent)
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items_master' AND column_name='name') THEN
        ALTER TABLE items_master ADD COLUMN name TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items_master' AND column_name='market_hash_name') THEN
        ALTER TABLE items_master ADD COLUMN market_hash_name TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items_master' AND column_name='base_name') THEN
        ALTER TABLE items_master ADD COLUMN base_name TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items_master' AND column_name='quality') THEN
        ALTER TABLE items_master ADD COLUMN quality TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items_master' AND column_name='image') THEN
        ALTER TABLE items_master ADD COLUMN image TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items_master' AND column_name='base_price_rub') THEN
        ALTER TABLE items_master ADD COLUMN base_price_rub NUMERIC(12,2);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items_master' AND column_name='markup_percent') THEN
        ALTER TABLE items_master ADD COLUMN markup_percent NUMERIC(5,2) DEFAULT ${DEFAULT_MARKUP};
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items_master' AND column_name='price_rub') THEN
        ALTER TABLE items_master ADD COLUMN price_rub NUMERIC(12,2);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items_master' AND column_name='updated_at') THEN
        ALTER TABLE items_master ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_items_master_mhn'
      ) THEN
        CREATE UNIQUE INDEX ux_items_master_mhn ON items_master (market_hash_name);
      END IF;
    END $$;

    -- items_master_dedup
    CREATE TABLE IF NOT EXISTS items_master_dedup (
      id              SERIAL PRIMARY KEY
    );

    ALTER TABLE items_master_dedup
      ADD COLUMN IF NOT EXISTS name            TEXT,
      ADD COLUMN IF NOT EXISTS base_name       TEXT,
      ADD COLUMN IF NOT EXISTS image           TEXT,
      ADD COLUMN IF NOT EXISTS base_price_rub  NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS markup_percent  NUMERIC(5,2) DEFAULT ${DEFAULT_MARKUP},
      ADD COLUMN IF NOT EXISTS price_rub       NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_items_master_dedup_base'
      ) THEN
        CREATE UNIQUE INDEX ux_items_master_dedup_base ON items_master_dedup (base_name);
      END IF;
    END $$;

    COMMIT;
  `);
}

/* ---------- data backfill (защита от NULL) ---------- */

async function backfillMasterNulls() {
  await db.query(`
    UPDATE items_master
    SET name = COALESCE(name, market_hash_name, base_name)
    WHERE name IS NULL OR name = '';

    UPDATE items_master
    SET base_name = COALESCE(
      NULLIF(base_name,''),
      NULLIF(regexp_replace(COALESCE(name, market_hash_name, ''), '\\s*\\([^)]+\\)\\s*$', ''), ''),
      COALESCE(name, market_hash_name)
    )
    WHERE base_name IS NULL OR base_name = '';
  `);
}

/* ---------- upserts ---------- */

async function upsertItemsMaster(items) {
  if (!items.length) return 0;

  const sql = `
    INSERT INTO items_master
      (name, market_hash_name, base_name, quality, image, base_price_rub, markup_percent, price_rub, updated_at)
    VALUES
      ($1,   $2,               $3,        $4,      $5,    $6,             $7,             ROUND($6 * (1 + $7 / 100.0), 2), NOW())
    ON CONFLICT (market_hash_name) DO UPDATE SET
      name           = EXCLUDED.name,
      base_name      = EXCLUDED.base_name,
      quality        = EXCLUDED.quality,
      image          = COALESCE(EXCLUDED.image, items_master.image),
      base_price_rub = EXCLUDED.base_price_rub,
      price_rub      = ROUND(EXCLUDED.base_price_rub * (1 + items_master.markup_percent / 100.0), 2),
      updated_at     = NOW()
  `;

  let ok = 0;
  for (const it of items) {
    const params = [
      it.market_hash_name,   // name
      it.market_hash_name,   // market_hash_name
      it.base_name,
      it.quality,
      it.img_url,
      it.base_price_rub,
      DEFAULT_MARKUP,
    ];
    try {
      await db.query(sql, params);
      ok++;
    } catch (e) {
      console.warn('[items_master:upsert] skip', it.market_hash_name, e.message);
    }
  }
  return ok;
}

/* ---------- dedup (без NULL) ---------- */

async function rebuildDedupFromMaster() {
  const sql = `
    WITH ranked AS (
      SELECT
        COALESCE(name, market_hash_name, base_name) AS name_safe,
        COALESCE(base_name, name, market_hash_name) AS base_safe,
        image,
        base_price_rub,
        markup_percent,
        price_rub,
        updated_at,
        CASE quality
          WHEN 'FN' THEN 1
          WHEN 'MW' THEN 2
          WHEN 'FT' THEN 3
          WHEN 'WW' THEN 4
          WHEN 'BS' THEN 5
          ELSE 6
        END AS qrank
      FROM items_master
    ),
    best AS (
      SELECT DISTINCT ON (base_safe)
        name_safe,
        base_safe,
        image,
        base_price_rub,
        markup_percent,
        ROUND(base_price_rub * (1 + markup_percent / 100.0), 2) AS price_rub,
        NOW() AS updated_at
      FROM ranked
      WHERE base_safe IS NOT NULL AND base_safe <> ''
      ORDER BY base_safe, qrank ASC, updated_at DESC
    )
    INSERT INTO items_master_dedup (name, base_name, image, base_price_rub, markup_percent, price_rub, updated_at)
    SELECT name_safe, base_safe, image, base_price_rub, markup_percent, price_rub, updated_at
    FROM best
    ON CONFLICT (base_name) DO UPDATE SET
      name            = COALESCE(EXCLUDED.name, items_master_dedup.name),
      image           = COALESCE(EXCLUDED.image, items_master_dedup.image),
      base_price_rub  = EXCLUDED.base_price_rub,
      price_rub       = ROUND(EXCLUDED.base_price_rub * (1 + items_master_dedup.markup_percent / 100.0), 2),
      updated_at      = NOW()
  `;
  await db.query(sql);
}

/* ---------- public API ---------- */

async function updateAllPrices() {
  await ensureSchema();
  const raw = await fetchWaxpeerPrices();
  const norm = normalizeWaxpeerItems(raw);
  const up = await upsertItemsMaster(norm);
  await backfillMasterNulls();         // ← важный шаг перед пересборкой
  await rebuildDedupFromMaster();
  return { fetched: raw.length || 0, normalized: norm.length, upserted_master: up };
}

module.exports = {
  fetchWaxpeerPrices,
  normalizeWaxpeerItems,
  upsertItemsMaster,
  rebuildDedupFromMaster,
  updateAllPrices,
};
