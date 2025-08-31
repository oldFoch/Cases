'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../db');

let addTx = null;
try { ({ addTx } = require('../../services/transactions')); } catch {}

const uid = (req) => req.session?.passport?.user?.id || req.user?.id || null;

// Функция для получения цвета по номеру
const getColorByNumber = (number) => {
  if (number === 0) return 'yellow';
  return number % 2 === 0 ? 'black' : 'red';
};

// Memory fallback
let memoryHistory = [];

// Получение истории из БД
const getWheelHistory = async () => {
  const client = await db.getClient();
  try {
    const result = await client.query(`
      SELECT id, round_id, result_index, result_color, created_at 
      FROM wheel_history 
      ORDER BY created_at DESC 
      LIMIT 18
    `);
    
    console.log('DB history records:', result.rows.length);
    return result.rows;
  } catch (e) {
    console.error('Error getting wheel history from DB:', e.message);
    return memoryHistory;
  } finally {
    client.release();
  }
};

// Добавление результата в БД
const addWheelResult = async (result_index, result_color) => {
  const client = await db.getClient();
  try {
    console.log('Adding to DB:', result_index, result_color);
    
    const result = await client.query(
      `INSERT INTO wheel_history (result_index, result_color) 
       VALUES ($1, $2) 
       RETURNING id, round_id, result_index, result_color, created_at`,
      [result_index, result_color]
    );
    
    const newResult = result.rows[0];
    console.log('Added to DB successfully:', newResult);
    
    return newResult;
  } catch (e) {
    console.error('Error adding wheel result to DB:', e.message);
    
    // Fallback to memory
    const newResult = {
      id: Date.now(),
      round_id: null,
      result_index,
      result_color,
      created_at: new Date()
    };
    
    memoryHistory.unshift(newResult);
    if (memoryHistory.length > 18) {
      memoryHistory = memoryHistory.slice(0, 18);
    }
    
    return newResult;
  } finally {
    client.release();
  }
};

// Удаляем старые записи если больше 18
const cleanupOldRecords = async () => {
  const client = await db.getClient();
  try {
    const countResult = await client.query('SELECT COUNT(*) FROM wheel_history');
    const totalCount = parseInt(countResult.rows[0].count);
    
    if (totalCount > 18) {
      const deleteCount = totalCount - 18;
      console.log('Cleaning up', deleteCount, 'old records');
      
      await client.query(`
        DELETE FROM wheel_history 
        WHERE id IN (
          SELECT id FROM wheel_history 
          ORDER BY created_at ASC 
          LIMIT $1
        )
      `, [deleteCount]);
    }
  } catch (e) {
    console.error('Error cleaning up old records:', e.message);
  } finally {
    client.release();
  }
};

// Инициализация истории при старте
const initializeHistory = async () => {
  try {
    // Сначала очищаем таблицу полностью
    const client = await db.getClient();
    await client.query('TRUNCATE TABLE wheel_history RESTART IDENTITY');
    client.release();
    
    console.log('Initializing fresh wheel history with 18 random results...');
    
    for (let i = 0; i < 18; i++) {
      const result_index = Math.floor(Math.random() * 14);
      const result_color = getColorByNumber(result_index);
      await addWheelResult(result_index, result_color);
    }
    
    console.log('Wheel history initialized with 18 records');
  } catch (e) {
    console.error('Error initializing wheel history:', e);
  }
};

// Запускаем инициализацию при старте
initializeHistory();

/* ---------- SPIN: запуск колеса ---------- */
router.post('/spin', async (req, res) => {
  try {
    // Генерируем случайный результат
    const result_index = Math.floor(Math.random() * 14);
    const result_color = getColorByNumber(result_index);
    
    console.log('Generated spin result:', result_index, result_color);

    // Сохраняем в базу
    const newResult = await addWheelResult(result_index, result_color);
    
    // Удаляем старые записи если нужно
    await cleanupOldRecords();
    
    // Получаем обновленную историю
    const history = await getWheelHistory();
    
    console.log('Current history length:', history.length);

    // Форматируем историю для фронтенда
    const formattedHistory = history.map(item => ({
      round_id: item.id,
      winning_number: item.result_index,
      winning_color: item.result_color,
      created_at: item.created_at
    }));

    res.json({ 
      ok: true, 
      round_id: newResult.id,
      winning_number: newResult.result_index,
      winning_color: newResult.result_color,
      history: formattedHistory
    });

  } catch (e) {
    console.error('[wheel:spin]', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

/* ---------- HISTORY: получение истории ---------- */
router.get('/history', async (_req, res) => {
  try {
    const history = await getWheelHistory();
    
    console.log('History request, records found:', history.length);
    
    // Форматируем историю для фронтенда
    const formattedHistory = history.map(item => ({
      round_id: item.id,
      winning_number: item.result_index,
      winning_color: item.result_color,
      created_at: item.created_at
    }));
    
    res.json(formattedHistory);
  } catch (e) {
    console.error('[wheel:history]', e);
    res.json([]);
  }
});

/* ---------- BET: размещение ставки ---------- */
router.post(['/bet','/'], async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

  const body = req.body || {};
  const cb = body.color_bet && typeof body.color_bet === 'object' ? body.color_bet : null;
  const nb = body.number_bet && typeof body.number_bet === 'object' ? body.number_bet : null;

  const a1 = Number(cb?.amount || 0);
  const a2 = Number(nb?.amount || 0);
  const total = Math.round((a1 + a2) * 100) / 100;

  if (!Number.isFinite(total) || total <= 0) {
    return res.status(400).json({ error: 'Некорректная ставка' });
  }

  const MIN = Number(process.env.CASINO_MIN_BET || 0.01);
  const MAX = Number(process.env.CASINO_MAX_BET || 100000);

  if (total < MIN) return res.status(400).json({ error: `Минимальная ставка ${MIN}` });
  if (total > MAX) return res.status(400).json({ error: `Максимальная ставка ${MAX}` });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const qb = await client.query(
      `SELECT balance::numeric(12,2) AS balance FROM users WHERE id=$1 FOR UPDATE`,
      [userId]
    );
    const balanceBefore = Number(qb.rows[0]?.balance || 0);
    if (balanceBefore < total) {
      await client.query('ROLLBACK'); client.release();
      return res.status(400).json({ error: 'Недостаточно средств' });
    }

    const balanceAfter = Math.round((balanceBefore - total) * 100) / 100;
    await client.query(`UPDATE users SET balance=$1 WHERE id=$2`, [balanceAfter, userId]);

    try {
      if (addTx) {
        await addTx({
          userId,
          type: 'casino:wheel:bet',
          amount: -total,
          balanceBefore,
          balanceAfter,
          meta: {
            game: 'wheel',
            round_id: body.round_id ?? null,
            color_bet: cb ?? null,
            number_bet: nb ?? null
          }
        });
      }
    } catch {}

    await client.query('COMMIT'); client.release();
    return res.json({ ok: true, balance: balanceAfter });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    try { client.release(); } catch {}
    console.error('[wheel:bet]', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/* ---------- SETTLE: обработка выигрыша ---------- */
router.post('/settle', async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

  const { winning_number, winning_color, bets } = req.body || {};
  
  if (winning_number === undefined || !winning_color || !bets) {
    return res.status(400).json({ error: 'Неверные параметры' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Рассчитываем выигрыш
    let totalWin = 0;
    
    if (bets.color_bet) {
      const { color, amount } = bets.color_bet;
      if (color === winning_color) {
        const multiplier = winning_color === 'yellow' ? 14 : 2;
        totalWin += amount * multiplier;
      }
    }
    
    if (bets.number_bet) {
      const { number, amount } = bets.number_bet;
      if (number === winning_number) {
        totalWin += amount * 14;
      }
    }

    // Начисляем выигрыш
    if (totalWin > 0) {
      const qb = await client.query(
        `SELECT balance::numeric(12,2) AS balance FROM users WHERE id=$1 FOR UPDATE`,
        [userId]
      );
      const balanceBefore = Number(qb.rows[0]?.balance || 0);
      const balanceAfter = Math.round((balanceBefore + totalWin) * 100) / 100;
      
      await client.query(`UPDATE users SET balance=$1 WHERE id=$2`, [balanceAfter, userId]);

      try {
        if (addTx) {
          await addTx({
            userId,
            type: 'casino:wheel:win',
            amount: totalWin,
            balanceBefore,
            balanceAfter,
            meta: {
              game: 'wheel',
              winning_number,
              winning_color,
              bets,
              total_win: totalWin
            }
          });
        }
      } catch {}
    }

    await client.query('COMMIT');
    res.json({ ok: true, win: totalWin });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[wheel:settle]', e);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

/* ---------- RESET: полный сброс истории ---------- */
router.post('/reset-history', async (_req, res) => {
  try {
    await initializeHistory();
    const history = await getWheelHistory();
    
    res.json({ 
      ok: true, 
      message: 'History reset successfully',
      record_count: history.length
    });
  } catch (e) {
    console.error('Reset error:', e);
    res.status(500).json({ error: 'Reset failed' });
  }
});

/* ---------- DEBUG: отладка ---------- */
router.get('/debug', async (_req, res) => {
  try {
    const client = await db.getClient();
    
    // Проверяем все записи
    const allRecords = await client.query(`
      SELECT id, round_id, result_index, result_color, created_at 
      FROM wheel_history 
      ORDER BY created_at DESC
    `);
    
    // Проверяем структуру
    const structure = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'wheel_history'
    `);
    
    client.release();

    res.json({
      total_records: allRecords.rows.length,
      records: allRecords.rows,
      table_structure: structure.rows,
      memory_history: memoryHistory.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- CONFIG: конфигурация ---------- */
router.get(['/config','/'], (_req, res) => {
  res.json({ 
    ok: true,
    min_bet: Number(process.env.CASINO_MIN_BET || 0.01),
    max_bet: Number(process.env.CASINO_MAX_BET || 100000),
    history_limit: 18,
    numbers_count: 14
  });
});

module.exports = router;