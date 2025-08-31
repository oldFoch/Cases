'use strict';
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// ===== Конфиг из .env (с дефолтами) =====
const MIN_BET   = Number(process.env.COINFLIP_MIN_BET || 10);
const MAX_BET   = Number(process.env.COINFLIP_MAX_BET || 100000);

// Шансы выигрыша по режимам
const P_EASY    = Number(process.env.COINFLIP_P_EASY    || 0.40); // 40%
const P_NORMAL  = Number(process.env.COINFLIP_P_NORMAL  || 0.20); // 30%
const P_HARD    = Number(process.env.COINFLIP_P_HARD    || 0.07); // 10%

// Выплаты по режимам (во сколько раз умножаем ставку при победе)
// Можно настраивать, например: чем сложнее — тем больше кэф.
const X_EASY    = Number(process.env.COINFLIP_X_EASY    || 1.10);
const X_NORMAL  = Number(process.env.COINFLIP_X_NORMAL  || 1.35);
const X_HARD    = Number(process.env.COINFLIP_X_HARD    || 1.5);

function pickModeConfig(mode) {
  const m = String(mode || '').toLowerCase();
  if (m === 'hard')   return { key:'hard',   p: P_HARD,   payout: X_HARD };
  if (m === 'normal') return { key:'normal', p: P_NORMAL, payout: X_NORMAL };
  return { key:'easy', p: P_EASY, payout: X_EASY };
}

// POST /api/coinflip/play { side: 'heads'|'tails', amount, mode: 'easy'|'normal'|'hard' }
router.post('/play', auth, async (req, res) => {
  const userId = req.user.id;
  const side = String(req.body.side || '').toLowerCase() === 'tails' ? 'tails' : 'heads';
  const amount = Math.floor(Number(req.body.amount || 0));
  const { key: mode, p, payout } = pickModeConfig(req.body.mode);

  if (!Number.isFinite(amount) || amount < MIN_BET) {
    return res.status(400).json({ error: `Минимальная ставка: ${MIN_BET}₽` });
  }
  if (amount > MAX_BET) {
    return res.status(400).json({ error: `Максимальная ставка: ${MAX_BET}₽` });
  }
  if (!(p > 0 && p < 1) || !(payout > 1)) {
    return res.status(400).json({ error: 'Неверная конфигурация режима' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const u = await client.query('SELECT balance FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!u.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    const balance = Number(u.rows[0].balance) || 0;
    if (balance < amount) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Недостаточно средств' }); }

    // списываем ставку
    const afterBet = Math.round((balance - amount) * 100) / 100;
    await client.query('UPDATE users SET balance=$1 WHERE id=$2', [afterBet, userId]);

    // Подкручиваем шанс выигрыша в зависимости от режима:
    // - если выпадет нужная сторона и "проходит" вероятность p — win, иначе lose.
    const landed = Math.random() < 0.4 ? 'heads' : 'tails';
    const sideMatches = landed === side;
    const probPass = Math.random() < p;
    const isWin = sideMatches && probPass;

    let finalBalance = afterBet;
    let won = 0;

    if (isWin) {
      won = Math.round(amount * payout); // выплату делаем целым рублём
      finalBalance = Math.round((afterBet + won) * 100) / 100;
      await client.query('UPDATE users SET balance=$1 WHERE id=$2', [finalBalance, userId]);
    }

    // лог в транзакции
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, created_at, meta)
       VALUES ($1::int, $2::text, $3::numeric, NOW(), $4::jsonb)`,
      [
        userId,
        'coinflip',
        isWin ? won : -amount,
        JSON.stringify({
          mode,
          p,
          payout,
          side,
          landed,
          bet: amount
        })
      ]
    );

    await client.query('COMMIT');
    return res.json({
      ok: true,
      outcome: isWin ? 'win' : 'lose',
      landed,
      mode,
      p,
      payout,
      balance: finalBalance
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    return res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
