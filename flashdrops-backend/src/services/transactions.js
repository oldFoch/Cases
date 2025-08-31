'use strict';
const db = require('../db');

/** Универсальная запись транзакции. Пиши всё в meta. */
async function addTx({ userId, type, amount, balanceBefore, balanceAfter, meta = {} }) {
  return db.query(
    `INSERT INTO transactions
       (user_id, type, amount, balance_before, balance_after, meta,
        item_case_name, item_name, item_image)
     VALUES ($1,$2,$3,$4,$5,$6,
             COALESCE($6->>'item_case_name', NULL),
             COALESCE($6->>'item_name', NULL),
             COALESCE($6->>'item_image', NULL)
     ) RETURNING id`,
    [userId, type, amount, balanceBefore, balanceAfter, meta]
  );
}

module.exports = { addTx };
