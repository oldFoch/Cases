const axios = require('axios');
const db = require('../db');

const API_KEY = process.env.WAXPEER_API_KEY || process.env.WAXPEER_KEY;

async function syncWaxpeer() {
  if (!API_KEY) {
    return { ok: false, error: 'WAXPEER_KEY не задан в .env' };
  }

  try {
    console.log('[waxpeer] загрузка цен...');
    const { data } = await axios.get(`https://api.waxpeer.com/v1/prices?api=${API_KEY}`);

    if (!data || !data.items) {
      console.warn('[waxpeer] API вернул пусто');
      return { ok: false, count: 0, note: 'API пустой или структура изменилась' };
    }

    let count = 0;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      for (const [key, obj] of Object.entries(data.items)) {
        const price = Number(obj?.min || obj?.avg || 0);
        const image = obj?.img || obj?.image || null;
        const name = obj?.name || String(key);
        
        const market_hash_name = name;

        if (!price || price <= 0) continue;

        // ДЕЛИМ ЦЕНУ НА 10
        const correctedPrice = price / 10;

        await client.query(`
          INSERT INTO items_master (market_hash_name, name, image, price_rub, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (market_hash_name)
          DO UPDATE SET 
            name = EXCLUDED.name,
            image = EXCLUDED.image,
            price_rub = EXCLUDED.price_rub,
            updated_at = NOW()
        `, [market_hash_name, name, image, correctedPrice]);

        count++;
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    console.log(`[waxpeer] загружено ${count} предметов (цены поделены на 10)`);
    return { ok: true, count };
  } catch (e) {
    console.error('[waxpeer] ошибка sync:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { syncWaxpeer };