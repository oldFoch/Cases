// src/services/withdrawWorker.js
'use strict';

const db = require('../db');
const { handleProviderProgress } = require('./withdrawService');

// период опроса (мс)
const TICK_MS = 5000;

let timer = null;

/**
 * Рабочий цикл: ищет заказы в статусах, которые нужно допушить,
 * дергает провайдер и обновляет статусы.
 */
async function tickOnce() {
  try {
    // сюда попадают заказы, которые:
    // - уже отправлены на покупку и ждут статусов от провайдера
    // - ждут withdraw/unlock у провайдера
    const { rows } = await db.query(
      `SELECT id
         FROM withdraw_orders
        WHERE status IN ('processing','wait_accept','wait_unlock')
        ORDER BY id ASC
        LIMIT 50`
    );

    for (const r of rows) {
      try {
        await handleProviderProgress(r.id);
      } catch (e) {
        console.warn('[withdrawWorker] order', r.id, 'progress error:', e.message);
      }
    }
  } catch (e) {
    console.warn('[withdrawWorker] tick error:', e.message);
  }
}

function startWithdrawWorker() {
  if (timer) return; // уже запущен
  const loop = async () => {
    await tickOnce();
    timer = setTimeout(loop, TICK_MS);
  };
  loop();
  console.log('✔ withdraw worker started (interval', TICK_MS, 'ms)');
}

module.exports = { startWithdrawWorker };
