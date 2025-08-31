const db = require('../db');

async function syncUniqueOnce() {
  try {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM items_unique');

      const insertQuery = `
        INSERT INTO items_unique (market_hash_name, base_name, image, price_minor, price_rub, updated_at)
        WITH ranked_items AS (
          SELECT 
            m.market_hash_name,
            m.name,
            m.image,
            m.price_rub * 100 as price_minor,
            m.price_rub as price_rub,
            CASE 
              WHEN m.market_hash_name LIKE '%StatTrak™%' THEN 2
              WHEN m.market_hash_name LIKE '%Souvenir%' THEN 3
              ELSE 1
            END as version_priority,
            CASE 
              WHEN m.market_hash_name ILIKE '%(Factory New)%' THEN 1
              WHEN m.market_hash_name ILIKE '%(Minimal Wear)%' THEN 2
              WHEN m.market_hash_name ILIKE '%(Field-Tested)%' THEN 3
              WHEN m.market_hash_name ILIKE '%(Well-Worn)%' THEN 4
              WHEN m.market_hash_name ILIKE '%(Battle-Scarred)%' THEN 5
              ELSE 6
            END as quality_rank,
            ROW_NUMBER() OVER (
              PARTITION BY SPLIT_PART(
                REPLACE(REPLACE(m.market_hash_name, 'StatTrak™ ', ''), 'Souvenir ', ''), 
                ' (', 
                1
              )
              ORDER BY 
                CASE 
                  WHEN m.market_hash_name LIKE '%StatTrak™%' THEN 2
                  WHEN m.market_hash_name LIKE '%Souvenir%' THEN 3
                  ELSE 1
                END,
                CASE 
                  WHEN m.market_hash_name ILIKE '%(Factory New)%' THEN 1
                  WHEN m.market_hash_name ILIKE '%(Minimal Wear)%' THEN 2
                  WHEN m.market_hash_name ILIKE '%(Field-Tested)%' THEN 3
                  WHEN m.market_hash_name ILIKE '%(Well-Worn)%' THEN 4
                  WHEN m.market_hash_name ILIKE '%(Battle-Scarred)%' THEN 5
                  ELSE 6
                END,
                m.price_rub DESC
            ) as rn
          FROM items_master m
          WHERE m.price_rub > 0
        )
        SELECT 
          market_hash_name,
          SPLIT_PART(
            REPLACE(REPLACE(market_hash_name, 'StatTrak™ ', ''), 'Souvenir ', ''), 
            ' (', 
            1
          ) as base_name,
          image, 
          price_minor, 
          price_rub,
          NOW()
        FROM ranked_items
        WHERE rn = 1
        AND version_priority = 1
      `;
      
      await client.query(insertQuery);

      await client.query('COMMIT');

      const countQuery = await client.query('SELECT COUNT(*) as count FROM items_unique');
      const count = Number(countQuery.rows[0]?.count || 0);
      console.log(`[items_unique] добавлено ${count} обычных предметов (без StatTrak/Souvenir)`);
      
      return { ok: true, count };
      
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.warn('[items_unique] sync error:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { syncUniqueOnce };