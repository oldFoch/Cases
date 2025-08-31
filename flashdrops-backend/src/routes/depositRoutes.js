// flashdrops-backend/src/routes/depositRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Переписано без `undici`:
 *  - используем встроенный в Node.js 18+ `global.fetch` (у тебя v22 — он есть)
 *  - если вдруг запустят на старом Node — попробуем подтянуть node-fetch (не обязательно)
 */

const hasGlobalFetch = typeof global.fetch === 'function';
let fetchFn = global.fetch;
if (!hasGlobalFetch) {
  try {
    // fallback для старых Node (не обязателен у тебя)
    fetchFn = require('node-fetch');
  } catch {
    // оставим как есть — ниже вернём 500, если нет fetch
  }
}

async function httpJson(url, { method = 'GET', headers = {}, body } = {}) {
  if (typeof fetchFn !== 'function') {
    throw new Error('fetch is not available (install node-fetch or use Node.js >= 18)');
  }
  const resp = await fetchFn(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!resp.ok) {
    const msg = json?.error || json?.message || `HTTP ${resp.status}`;
    const err = new Error(msg);
    err.status = resp.status;
    err.payload = json;
    throw err;
  }
  return json;
}

// Конфиг провайдера депозита (любой: фиат/крипто/и т.п.)
const DEPOSIT_API_URL = process.env.DEPOSIT_API_URL || ''; // например: https://api.pay.example.com
const DEPOSIT_API_KEY = process.env.DEPOSIT_API_KEY || ''; // токен
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Хелпер: заголовки авторизации к провайдеру
function providerHeaders() {
  const h = {};
  if (DEPOSIT_API_KEY) h['Authorization'] = `Bearer ${DEPOSIT_API_KEY}`;
  return h;
}

/**
 * POST /api/deposits/create
 * body: { amount: number } — сумма в вашей валюте (₽/FC и т.п.)
 * Возвращает платёжную ссылку/QR/идентификатор провайдера.
 */
router.post('/create', async (req, res) => {
  try {
    const userId = req.session?.passport?.user?.id || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    const amount = Math.max(1, Math.floor(Number(req.body?.amount || 0)));
    if (!amount) return res.status(400).json({ error: 'Неверная сумма' });

    // Создаём локальную запись попытки депозита
    const { rows } = await db.query(
      `INSERT INTO deposits (user_id, amount, status)
       VALUES ($1, $2, 'created')
       RETURNING id`,
      [userId, amount]
    );
    const depId = rows[0].id;

    // Если провайдер не сконфигурирован — вернём «заглушку»
    if (!DEPOSIT_API_URL || !DEPOSIT_API_KEY) {
      return res.json({
        ok: true,
        deposit_id: depId,
        // ссылка-заглушка (на фронте можешь показать инструкцию)
        pay_url: `${FRONTEND_URL}/deposit/${depId}`,
        provider: 'none',
      });
    }

    // Иначе — обращаемся к внешнему провайдеру (примерный контракт)
    const createPayload = {
      amount,
      currency: 'RUB', // подставь свою валюту, если нужно
      // callback/webhook URL провайдера (должен сходиться с твоим /callback)
      callback_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/deposits/callback`,
      metadata: { dep_id: depId, user_id: userId },
      success_url: `${FRONTEND_URL}/profile`,
      cancel_url: `${FRONTEND_URL}/profile`,
    };

    const data = await httpJson(`${DEPOSIT_API_URL}/payments`, {
      method: 'POST',
      headers: providerHeaders(),
      body: createPayload,
    });

    const providerId = data?.id || data?.payment_id || null;
    const payUrl = data?.url || data?.pay_url || null;

    await db.query(
      `UPDATE deposits
         SET provider = $2,
             provider_id = $3
       WHERE id = $1`,
      [depId, 'external', providerId]
    );

    res.json({
      ok: true,
      deposit_id: depId,
      provider_id: providerId,
      pay_url: payUrl,
    });
  } catch (e) {
    console.warn('[deposit:create] error:', e.message);
    res.status(e.status || 500).json({ error: e.message || 'Deposit create error' });
  }
});

/**
 * GET /api/deposits/status/:id
 * Проверка статуса депозита (локально и/или у провайдера)
 */
router.get('/status/:id', async (req, res) => {
  try {
    const depId = Number(req.params.id);
    if (!depId) return res.status(400).json({ error: 'Bad id' });

    const { rows } = await db.query(
      `SELECT d.*, u.username
         FROM deposits d
         JOIN users u ON u.id = d.user_id
        WHERE d.id = $1`,
      [depId]
    );
    const dep = rows[0];
    if (!dep) return res.status(404).json({ error: 'Not found' });

    // Если уже зачислен — просто вернём
    if (dep.status === 'done') {
      return res.json({ ok: true, status: dep.status, balance_after: dep.balance_after });
    }

    // Если провайдера нет — статусы только локальные
    if (!DEPOSIT_API_URL || !DEPOSIT_API_KEY || !dep.provider_id) {
      return res.json({ ok: true, status: dep.status });
    }

    // Иначе — спросим у провайдера
    const info = await httpJson(`${DEPOSIT_API_URL}/payments/${encodeURIComponent(dep.provider_id)}`, {
      headers: providerHeaders(),
    });

    // маппинг статуса провайдера → наш
    const provStatus = String(info?.status || '').toLowerCase();
    // допустим: 'paid' | 'pending' | 'canceled' | ...
    if (provStatus === 'paid' && dep.status !== 'done') {
      // атомарно начислим
      await db.tx(async (t) => {
        // на всякий (если tx-хелпера нет) — используем t.query вместо db.query
        const user = await t.query(`SELECT balance FROM users WHERE id=$1 FOR UPDATE`, [dep.user_id]);
        const cur = Number(user.rows[0]?.balance || 0);
        const next = cur + Number(dep.amount || 0);

        await t.query(`UPDATE users SET balance=$2 WHERE id=$1`, [dep.user_id, next]);
        await t.query(
          `UPDATE deposits
              SET status='done',
                  balance_after=$2
            WHERE id=$1`,
          [depId, next]
        );
      });

      // отдадим обновлённый статус
      const { rows: r2 } = await db.query(`SELECT balance FROM users WHERE id=$1`, [dep.user_id]);
      return res.json({ ok: true, status: 'done', balance_after: Number(r2[0]?.balance || 0) });
    }

    // иначе — просто прокинем текущий статус
    res.json({ ok: true, status: dep.status, provider_status: provStatus });
  } catch (e) {
    console.warn('[deposit:status] error:', e.message);
    res.status(e.status || 500).json({ error: e.message || 'Deposit status error' });
  }
});

/**
 * POST /api/deposits/callback
 * Webhook от провайдера. Важно: нужно защитить по секрету/подписи в проде!
 * Тело (пример): { id, status, metadata: { dep_id, user_id }, amount }
 */
router.post('/callback', async (req, res) => {
  try {
    // TODO: проверить подпись провайдера (X-Signature, HMAC и т.д.)
    const payload = req.body || {};
    const depId = Number(payload?.metadata?.dep_id || 0);
    const status = String(payload?.status || '').toLowerCase();

    if (!depId) return res.status(400).json({ error: 'Bad metadata' });

    const { rows } = await db.query(`SELECT * FROM deposits WHERE id=$1`, [depId]);
    const dep = rows[0];
    if (!dep) return res.status(404).json({ error: 'Not found' });

    if (status === 'paid' && dep.status !== 'done') {
      await db.tx(async (t) => {
        const user = await t.query(`SELECT balance FROM users WHERE id=$1 FOR UPDATE`, [dep.user_id]);
        const cur = Number(user.rows[0]?.balance || 0);
        const next = cur + Number(dep.amount || 0);

        await t.query(`UPDATE users SET balance=$2 WHERE id=$1`, [dep.user_id, next]);
        await t.query(
          `UPDATE deposits
              SET status='done',
                  balance_after=$2
            WHERE id=$1`,
          [depId, next]
        );
      });
    } else if (['canceled', 'failed', 'expired'].includes(status)) {
      await db.query(`UPDATE deposits SET status=$2 WHERE id=$1`, [depId, status]);
    }

    res.json({ ok: true });
  } catch (e) {
    console.warn('[deposit:callback] error:', e.message);
    res.status(e.status || 500).json({ error: e.message || 'Deposit callback error' });
  }
});

module.exports = router;
