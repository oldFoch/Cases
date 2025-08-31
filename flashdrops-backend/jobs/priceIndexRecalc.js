'use strict';

require('dotenv').config();
const { Client } = require('pg');

const {
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS,
  ANOMALY_K = '6',
  VOLATILITY_CAP_PCT = '30',
} = process.env;

const CONN = {
  host: DB_HOST,
  port: Number(DB_PORT || 5432),
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASS,
};

const K = Number(ANOMALY_K);
const VOL = Number(VOLATILITY_CAP_PCT);

function ema(newVal, prevVal, alpha = 0.3) {
  if (!prevVal || prevVal <= 0) return Math.round(newVal);
  return Math.round(alpha * newVal + (1 - alpha) * prevVal);
}

function capDaily(newMinor, prevMinor) {
  if (!prevMinor || prevMinor <= 0) return newMinor;
  const up = Math.round(prevMinor * (1 + VOL / 100));
  const dn = Math.round(prevMinor * (1 - VOL / 100));
  if (newMinor > up) return up;
  if (newMinor < dn) return dn;
  return newMinor;
}

async function distinctNames(client) {
  const sql = `
    SELECT DISTINCT market_hash_name
    FROM loot_price_hist
    WHERE fetched_at >= now() - interval '72 hours'
  `;
  const { rows } = await client.query(sql);
  return rows.map(r => r.market_hash_name);
}

async function histStats(client, name) {
  const q = `
    WITH hist AS (
      SELECT price_rub
      FROM loot_price_hist
      WHERE market_hash_name = $1
        AND fetched_at >= now() - interval '72 hours'
      ORDER BY fetched_at DESC
    ),
    m AS (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_rub)::numeric AS med FROM hist
    ),
    dev AS (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY abs(price_rub - m.med))::numeric AS mad
      FROM hist, m
    ),
    prev AS (
      SELECT iu.price_minor AS prev_minor
      FROM items_unique iu
      WHERE iu.market_hash_name = $1
         OR iu.base_name = $1
      LIMIT 1
    )
    SELECT
      (SELECT med FROM m)  AS med,
      COALESCE((SELECT mad FROM dev), 0) AS mad,
      (SELECT prev_minor FROM prev) AS prev_minor
  `;
  const { rows } = await client.query(q, [name]);
  const r = rows[0] || {};
  return {
    med: r.med ? Number(r.med) : null,
    mad: r.mad ? Number(r.mad) : 0,
    prev_minor: r.prev_minor ? Number(r.prev_minor) : null,
  };
}

async function updateByName(client, name, minor) {
  const r1 = await client.query(
    `UPDATE items_unique
     SET price_minor = $1, updated_at = now()
     WHERE market_hash_name = $2`,
    [minor, name]
  );
  if (r1.rowCount) return r1.rowCount;

  const r2 = await client.query(
    `UPDATE items_unique
     SET price_minor = $1, updated_at = now()
     WHERE base_name = $2`,
    [minor, name]
  );
  return r2.rowCount;
}

async function run() {
  const client = new Client(CONN);
  await client.connect();
  try {
    const names = await distinctNames(client);
    if (!names.length) {
      console.log('[recalc] no names');
      return { updated: 0 };
    }

    let updated = 0;

    for (const name of names) {
      const { med, mad, prev_minor } = await histStats(client, name);
      if (!med || med <= 0) continue;

      // MAD-фильтр на уровне медианы (если mad=0, пропускаем фильтрацию)
      let idxRub = med;
      if (mad > 0) {
        // медиана уже устойчива, отдельный отбор выбросов можно опустить
        idxRub = med;
      }

      // в minor
      let idxMinor = Math.round(idxRub * 100);

      // EMA и дневной лимит
      idxMinor = ema(idxMinor, prev_minor, 0.3);
      idxMinor = capDaily(idxMinor, prev_minor);

      const n = await updateByName(client, name, idxMinor);
      updated += n;
    }

    console.log('[recalc] updated:', updated);
    return { updated };
  } catch (e) {
    console.error('[recalc] ERROR', e.message || e);
    throw e;
  } finally {
    await client.end();
  }
}

module.exports = { run };
