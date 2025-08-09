// flashdrops-backend/scripts/updateBotInventoryPrices.js
// Запуск: npm run prices:bot:update

require('dotenv').config();
const db = require('../src/db');
const { getPriceWithCache } = require('../src/services/priceService');

const REQ_DELAY_MS = Number(process.env.PRICE_REQUEST_DELAY_MS || 800);
const TTL_HOURS    = Number(process.env.PRICE_CACHE_TTL_HOURS || 12);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  try {
    console.log('[botPriceUpdate] start');

    // Возьмём ВСЕ записи, где цены нет или устарела
    const { rows } = await db.query(
      `SELECT id, market_hash_name, base_name, price_current, price_updated_at
         FROM bot_inventory
        WHERE market_hash_name IS NOT NULL
          AND market_hash_name <> ''
          AND (
                price_current IS NULL
             OR price_updated_at IS NULL
             OR price_updated_at < NOW() - INTERVAL '${TTL_HOURS} hours'
          )
        ORDER BY id`
    );

    if (!rows.length) {
      console.log('[botPriceUpdate] nothing to update');
      process.exit(0);
    }

    for (const r of rows) {
      const mhn = r.market_hash_name;
      try {
        const price = await getPriceWithCache(mhn);
        await db.query(
          `UPDATE bot_inventory
              SET price_current = $1,
                  price_updated_at = NOW()
            WHERE id = $2`,
          [price, r.id]
        );
        console.log(`[OK] ${mhn} -> ${price}`);
      } catch (e) {
        console.warn(`[FAIL] "${mhn}" (base="${r.base_name}") :: ${e.message}`);
      }
      await sleep(REQ_DELAY_MS);
    }

    console.log('[botPriceUpdate] done');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
