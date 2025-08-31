'use strict';

require('dotenv').config();

const axios = require('axios');
const { Pool } = require('pg');

// --- DB init ---
const env = process.env;
const pool = new Pool({
  host: env.DB_HOST || env.PGHOST || '127.0.0.1',
  port: Number(env.DB_PORT || env.PGPORT || 5432),
  database: env.DB_NAME || env.PGDATABASE || 'flashdrops',
  user: env.DB_USER || env.PGUSER || 'postgres',
  password: env.DB_PASS != null ? String(env.DB_PASS) : (env.PGPASSWORD || ''),
  ssl: String(env.DB_SSL || env.PGSSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
});

// --- Waxpeer HTTP ---
const API_BASE = process.env.WAXPEER_API_BASE || 'https://api.waxpeer.com';
const API_KEY  = process.env.WAXPEER_KEY || '';
const http = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}
});

// === helpers ===
const stripQuality = (s) => s.replace(/\s+\([^)]+\)\s*$/,'');
const normSpaces   = (s) => s.replace(/\s+/g, ' ').trim();
const stripPrefixes = (s) => {
  let x = s;
  x = x.replace(/^\s*★\s*/i, '');
  x = x.replace(/^\s*StatTrak[™\s]*\s*/i, '');
  x = x.replace(/^\s*Souvenir\s+/i, '');
  return normSpaces(x);
};
const toBaseName = (mhn) => stripPrefixes(stripQuality(mhn || ''));

// качество для ранжирования (меньше — лучше)
const wearRank = (mhn) => {
  const m = String(mhn || '').toLowerCase().match(/\(([^)]+)\)/);
  const w = m ? m[1].trim() : '';
  if (w === 'factory new')    return 1;
  if (w === 'minimal wear')   return 2;
  if (w === 'field-tested')   return 3;
  if (w === 'well-worn')      return 4;
  if (w === 'battle-scarred') return 5;
  return 9;
};

// выбираем наиболее осмысленную цену
const extractPrice = (it) => {
  const candidates = [
    it.price_custom, it.custom_price, it.customPrice,
    it.price, it.min_price, it.minPrice,
    it.avg_price, it.average_price, it.median_price
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

// изображение
const extractImage = (it) => it.image || it.icon_url || it.icon || null;

// источник товаров с ценами
const PRICES_URL = '/v1/prices?app=730';

// === main sync ===
async function syncItemsMaster() {
  console.log('[sync] fetching Waxpeer prices…', API_BASE);
  const { data } = await http.get(PRICES_URL);

  // Пытаемся поддержать разные форматы
  let list = [];
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data.items)) list = data.items;
  else if (data.data && Array.isArray(data.data)) list = data.data;
  else throw new Error('unexpected Waxpeer response format');

  let inserted = 0, updated = 0, skippedZero = 0;

  for (const it of list) {
    const mhn   = it.market_hash_name || it.name;
    if (!mhn) continue;

    const price = extractPrice(it); // в условных рублях/FC
    const img   = extractImage(it);
    const base  = toBaseName(mhn);

    // не затираем нормальные цены нулём — пропускаем такие элементы
    if (!price || price <= 0) { skippedZero++; continue; }

    const q = `
      INSERT INTO items_master (name, market_hash_name, image, price_rub, base_name, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (market_hash_name) DO UPDATE
      SET
        -- цена обновляется ТОЛЬКО если новая > 0
        price_rub = CASE WHEN EXCLUDED.price_rub > 0 THEN EXCLUDED.price_rub ELSE items_master.price_rub END,
        image     = COALESCE(EXCLUDED.image, items_master.image),
        base_name = COALESCE(EXCLUDED.base_name, items_master.base_name),
        name      = COALESCE(EXCLUDED.name, items_master.name),
        updated_at= now()
      RETURNING (xmax = 0) as inserted
    `;
    const r = await pool.query(q, [mhn, mhn, img, price, base]);
    if (r.rows[0]?.inserted) inserted++; else updated++;
  }

  console.log(`[sync] items_master: inserted=${inserted}, updated=${updated}, skipped_zero=${skippedZero}`);
}

// из master в unique: 1 шт на base_name, лучшая вариация (FN→…→BS, потом дороже)
async function syncItemsUniqueFromMaster() {
  // берём лучшую вариацию для каждого base_name
  const bestRows = await pool.query(`
    WITH mm AS (
      SELECT
        market_hash_name,
        base_name,
        image,
        price_rub,
        ROW_NUMBER() OVER (
          PARTITION BY lower(base_name)
          ORDER BY
            CASE
              WHEN lower(market_hash_name) ~ '\\(factory new\\)'    THEN 1
              WHEN lower(market_hash_name) ~ '\\(minimal wear\\)'   THEN 2
              WHEN lower(market_hash_name) ~ '\\(field-tested\\)'   THEN 3
              WHEN lower(market_hash_name) ~ '\\(well-worn\\)'      THEN 4
              WHEN lower(market_hash_name) ~ '\\(battle-scarred\\)' THEN 5
              ELSE 9
            END,
            price_rub DESC NULLS LAST
        ) AS rn
      FROM items_master
      WHERE price_rub IS NOT NULL AND price_rub > 0
    )
    SELECT base_name, market_hash_name, image, price_rub
    FROM mm
    WHERE rn = 1
  `);

  let upserted = 0;
  for (const row of bestRows.rows) {
    const base = stripPrefixes(stripQuality(row.base_name || ''));
    const img  = row.image || null;
    const pm   = Math.round(Number(row.price_rub) * 100);
    if (!base || !pm || pm <= 0) continue;

    // кладём единственную запись на base_name (market_hash_name = base_name) — без качества
    await pool.query(`
      INSERT INTO items_unique (base_name, market_hash_name, image, price_minor, price_minor_backup, updated_at)
      VALUES ($1, $1, $2, $3, $3, now())
      ON CONFLICT (market_hash_name) DO UPDATE
      SET
        image              = COALESCE(EXCLUDED.image, items_unique.image),
        price_minor        = CASE WHEN EXCLUDED.price_minor > 0 THEN EXCLUDED.price_minor ELSE items_unique.price_minor END,
        price_minor_backup = COALESCE(items_unique.price_minor_backup, EXCLUDED.price_minor),
        updated_at         = now()
    `, [base, img, pm]);
    upserted++;
  }

  console.log(`[sync] items_unique: upserted best-per-base_name from items_master (${upserted})`);
}

async function runSync() {
  try {
    await syncItemsMaster();
    await syncItemsUniqueFromMaster();
    console.log('[sync] done ✔');
  } catch (e) {
    console.error('[sync] ERROR:', e.message);
  } finally {
    await pool.end();
  }
}

module.exports = { runSync };

if (require.main === module) {
  runSync();
}
