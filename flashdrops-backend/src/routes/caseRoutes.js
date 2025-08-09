const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { fetchSteamPrice } = require('../services/priceUpdater');

const router = express.Router();

const ALWAYS_LIVE = String(process.env.ALWAYS_LIVE_PRICES || 'false') === 'true';
const REQ_DELAY_MS = Number(process.env.PRICE_REQUEST_DELAY_MS || 600);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ===== Helpers
async function repriceItemById(itemId, marketHashName) {
  const price = await fetchSteamPrice(marketHashName);
  await db.query(
    `UPDATE case_items
        SET price = $1, price_updated_at = NOW()
      WHERE id = $2`,
    [price, itemId]
  );
  await db.query(
    `UPDATE user_inventory
        SET price_current = $1
      WHERE item_id = $2
        AND is_sold = FALSE`,
    [price, itemId]
  );
  return price;
}

// ===== Routes

// Все кейсы (без предметов)
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, image, price FROM cases ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Кейc + предметы; ?live=1 — подтянуть цены со Steam прямо сейчас
router.get('/:id', async (req, res) => {
  try {
    const caseId = req.params.id;
    const live = ALWAYS_LIVE || req.query.live === '1';

    const caseRes = await db.query(
      'SELECT id, name, image, price FROM cases WHERE id = $1',
      [caseId]
    );
    if (!caseRes.rows.length) return res.status(404).json({ error: 'Case not found' });

    let { rows: items } = await db.query(
      `SELECT id, name, image, price, chance, market_hash_name, price_updated_at
         FROM case_items
        WHERE case_id = $1
        ORDER BY id`,
      [caseId]
    );

    if (live) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.market_hash_name) {
          try {
            const newPrice = await repriceItemById(it.id, it.market_hash_name);
            items[i] = { ...it, price: newPrice, price_updated_at: new Date() };
          } catch {}
          await sleep(REQ_DELAY_MS);
        }
      }
    }

    res.json({ ...caseRes.rows[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Открыть кейс — теперь цена результата ВСЕГДА берётся со Steam (если есть market_hash_name)
router.post('/:id/open', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user.id;
    const caseId = req.params.id;

    const c = await client.query(
      'SELECT name, price FROM cases WHERE id = $1 FOR UPDATE',
      [caseId]
    );
    if (!c.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Case not found' });
    }
    const { name: caseName, price: casePrice } = c.rows[0];

    const u = await client.query(
      'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (!u.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const curBalance = Number(u.rows[0].balance);
    if (curBalance < casePrice) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // При желании — освежим цены в самом кейсе перед выпадением (если включен ALWAYS_LIVE)
    if (ALWAYS_LIVE) {
      const list = await client.query(
        `SELECT id, market_hash_name FROM case_items WHERE case_id = $1`,
        [caseId]
      );
      for (const it of list.rows) {
        if (it.market_hash_name) {
          try {
            const p = await fetchSteamPrice(it.market_hash_name);
            await client.query(
              `UPDATE case_items SET price = $1, price_updated_at = NOW() WHERE id = $2`,
              [p, it.id]
            );
          } catch {}
          await sleep(REQ_DELAY_MS);
        }
      }
    }

    // Берём предметы (с market_hash_name!)
    const itemsRes = await client.query(
      `SELECT id, name, image, price, chance, market_hash_name
         FROM case_items
        WHERE case_id = $1`,
      [caseId]
    );
    const items = itemsRes.rows;
    if (!items.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Case has no items' });
    }

    // Списываем деньги
    const newBalance = Math.round((curBalance - casePrice) * 100) / 100;
    await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);

    // Ролл по шансам
    let acc = 0;
    const rand = Math.random() * 100;
    let selected = items[items.length - 1];
    for (const it of items) {
      acc += Number(it.chance);
      if (rand <= acc) { selected = it; break; }
    }

    // ****** КЛЮЧЕВОЕ: цена результата из Steam ******
    let livePrice = Number(selected.price) || 0;
    if (selected.market_hash_name) {
      try {
        livePrice = await fetchSteamPrice(selected.market_hash_name);
        // можно синхронно обновить сам case_item:
        await client.query(
          `UPDATE case_items SET price = $1, price_updated_at = NOW() WHERE id = $2`,
          [livePrice, selected.id]
        );
      } catch {
        // если Steam не ответил — оставим цену из БД
      }
    }
    livePrice = Math.round(livePrice * 100) / 100;

    // Пишем в инвентарь с актуальной ценой
    await client.query(
      `INSERT INTO user_inventory
         (user_id, case_id, case_name, item_id, name, image, price_current, won_at, is_sold)
       VALUES ($1,      $2,      $3,        $4,      $5,   $6,    $7,            NOW(),  FALSE)`,
      [userId, caseId, caseName, selected.id, selected.name, selected.image, livePrice]
    );

    // Транзакцию — тоже с актуальной ценой
    await client.query(
      `INSERT INTO transactions
         (user_id, type, amount, item_case_name, item_name, item_image, item_price, created_at)
       VALUES ($1, 'case_open', $2, $3, $4, $5, $6, NOW())`,
      [userId, casePrice, caseName, selected.name, selected.image, livePrice]
    );

    await client.query('COMMIT');

    // Отдаём фронту предмет с корректной ценой
    res.json({
      item: {
        id: selected.id,
        name: selected.name,
        image: selected.image,
        price: livePrice, // ← теперь здесь всегда актуальная цена со Steam
      },
      balance: newBalance,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
