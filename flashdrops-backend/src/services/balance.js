// backend/services/balance.js
'use strict';
const db = require('../db');

async function getUserById(userId) {
  const { rows } = await db.query('SELECT id, balance, trade_url FROM users WHERE id=$1', [userId]);
  return rows[0] || null;
}

async function changeBalance(userId, amount, kind, meta = {}) {
  await db.query('BEGIN');
  try {
    const { rows } = await db.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!rows[0]) throw new Error('user not found');
    const current = Number(rows[0].balance) || 0;
    const next = current + Number(amount);
    if (next < -1e-6) throw new Error('insufficient funds');

    await db.query('UPDATE users SET balance=$1 WHERE id=$2', [next, userId]);
    await db.query(
      'INSERT INTO balance_tx(user_id, amount, kind, meta) VALUES($1,$2,$3,$4)',
      [userId, amount, kind, meta]
    );
    await db.query('COMMIT');
    return next;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}

module.exports = { getUserById, changeBalance };
