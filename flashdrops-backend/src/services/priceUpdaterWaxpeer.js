'use strict';

const db = require('../db');
const wax = require('./waxpeerService');
const n2 = (v) => Math.round((Number(v)||0)*100)/100;

// Нормализуем (FC == RUB 1:1), при необходимости сконверти
function toFC(priceUsd) {
  // если у вас цены уже в FC и waxpeer отдаёт USD — здесь поставь конвертацию
  return n2(priceUsd); 
}

async function syncOnce({ query } = {}) {
  const batch = await wax.search({ query, limit: 200 });
  const items = Array.isArray(batch?.data) ? batch.data : [];

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    for (const it of items) {
      const name = it.name;
      const image = null; // Waxpeer не всегда отдаёт картинку — можешь тянуть из CDN Steam или своей таблицы
      const priceFC = toFC(it.price);

      // upsert в item_master
      const { rows: m } = await client.query(
        `INSERT INTO item_master (name, image, price_current, created_at, updated_at)
         VALUES ($1,$2,$3,NOW(),NOW())
         ON CONFLICT (name) DO UPDATE
           SET price_current=EXCLUDED.price_current, updated_at=NOW()
         RETURNING id`,
        [name, image, priceFC]
      );
      const masterId = m[0].id;

      // маппинг провайдера
      await client.query(
        `INSERT INTO item_provider_map (item_master_id, provider, provider_item_id, provider_price, updated_at)
         VALUES ($1,'waxpeer',$2,$3,NOW())
         ON CONFLICT (item_master_id, provider) DO UPDATE
           SET provider_item_id=EXCLUDED.provider_item_id,
               provider_price=EXCLUDED.provider_price,
               updated_at=NOW()`,
        [masterId, String(it.id), it.price]
      );
    }

    await client.query('COMMIT');
    return { ok: true, count: items.length };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { syncOnce };
