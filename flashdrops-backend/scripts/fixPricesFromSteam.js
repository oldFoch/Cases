#!/usr/bin/env node
'use strict';

/**
 * Полная пересборка цен в items_master на основе Steam (в РУБЛЯХ).
 * Запуск: node scripts/fixPricesFromSteam.js
 */

require('dotenv').config();
const db = require('../src/db');
const { fetchSteamPrice } = require('../src/services/priceService');

const BATCH_DELAY_MS = Number(process.env.PRICE_FETCH_COOLDOWN_MS || 200);
const RATE_LIMIT_COOLDOWN_MS = Number(process.env.PRICE_RATE_LIMIT_COOLDOWN_MS || 600000); // 10m
const CONCURRENCY = 1;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getTargets() {
  // DISTINCT ON гарантирует по одной записи на item_id и позволяет ORDER BY по дате
  const { rows } = await db.query(
    `SELECT DISTINCT ON (im.id)
            im.id,
            im.market_hash_name,
            im.price_updated_at
       FROM items_master im
       JOIN case_items_map cim ON cim.item_id = im.id
      WHERE im.market_hash_name IS NOT NULL
      ORDER BY im.id,
               COALESCE(im.price_updated_at, '1970-01-01'::timestamp) ASC`
  );
  return rows;
}

async function processOne(row) {
  const { id, market_hash_name } = row;
  try {
    const rub = await fetchSteamPrice(market_hash_name); // уже рубли с маржой
    await db.query(
      `UPDATE items_master
          SET price=$1, price_updated_at=NOW()
        WHERE id=$2`,
      [rub, id]
    );
    console.log('[ok]', id, market_hash_name, rub);
    return { ok: 1, fail: 0 };
  } catch (e) {
    const msg = String(e.message || e);
    if (/429|rate|Too Many/i.test(msg)) {
      console.warn('[rate-limit] pause', RATE_LIMIT_COOLDOWN_MS / 60000, 'min on', market_hash_name);
      await sleep(RATE_LIMIT_COOLDOWN_MS);
      return { ok: 0, fail: 0 };
    }
    console.warn('[fail]', id, market_hash_name, msg);
    return { ok: 0, fail: 1 };
  }
}

async function run() {
  await db.query('SELECT 1');
  const list = await getTargets();
  console.log('[fix] total targets:', list.length);

  let ok = 0, fail = 0;
  for (const row of list) {
    await sleep(BATCH_DELAY_MS);
    const r = await processOne(row);
    ok += r.ok; fail += r.fail;
  }

  console.log('[fix] done. ok=', ok, 'fail=', fail);
  process.exit(0);
}

run().catch(e => {
  console.error('[fix] fatal:', e);
  process.exit(1);
});
