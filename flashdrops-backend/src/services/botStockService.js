'use strict';
const db = require('../db');

/**
 * Выбрать случайную доступную фактическую вещь на складе под этот шаблон.
 * Если нет — вернём null.
 */
async function pickAnyAvailableStock(itemMasterId) {
  const r = await db.query(
    `SELECT id, price_rub, wear, asset_id
     FROM bot_stock
     WHERE item_master_id=$1 AND available=true
     ORDER BY random()
     LIMIT 1`,
    [itemMasterId]
  );
  return r.rows[0] || null;
}

/**
 * Зарезервировать выбранную вещь (если нужна логика резерва)
 */
async function reserveStock(stockId) {
  await db.query(
    `UPDATE bot_stock SET available=false WHERE id=$1`,
    [stockId]
  );
}

module.exports = {
  pickAnyAvailableStock,
  reserveStock
};
