// flashdrops-backend/src/services/priceUpdater.js

const db = require('../db');

const STEAM_APPID  = Number(process.env.STEAM_APPID || 730);          // CS2
const CURRENCY     = Number(process.env.STEAM_CURRENCY || 5);         // 5 = RUB
const MARGIN_PCT   = Number(process.env.PRICE_MARGIN_PERCENT || 5);   // -5% от рынка
const REQ_DELAY_MS = Number(process.env.PRICE_REQUEST_DELAY_MS || 800);
const RETRIES      = Number(process.env.PRICE_RETRIES || 2);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Нормализованный парсер цены:
 * - убирает ВСЕ пробелы (включая NBSP \u00A0 и узкий NBSP \u202F)
 * - срезает любые буквы/символы валюты
 * - определяет десятичный разделитель как «самый правый из , или .»
 * - убирает остальные как разделители тысяч
 * Примеры:
 *  "22 189,05 руб." -> 22189.05
 *  "9 668,37 руб."  -> 9668.37
 *  "65,93 руб."     -> 65.93
 *  "1,234.56"       -> 1234.56
 *  "1.234,56"       -> 1234.56
 */
function parsePrice(raw) {
  if (raw == null) return null;
  let s = String(raw);

  // оставляем только цифры, запятую, точку и пробелы (включая NBSP)
  s = s.replace(/[^\d.,\s\u00A0\u202F]/g, '');

  // убираем все виды пробелов
  s = s.replace(/[\s\u00A0\u202F]+/g, '');

  if (!s) return null;

  // если последний символ разделитель — уберём его
  if (s.endsWith(',') || s.endsWith('.')) s = s.slice(0, -1);

  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');

  // оба разделителя присутствуют -> правый считается десятичным
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // десятичный — запятая, точки были разделителями тысяч
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // десятичный — точка, запятые были разделителями тысяч
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // только запятая — десятичный разделитель
    s = s.replace(',', '.');
  } else {
    // только точка или вообще нет разделителей — уже ок
  }

  const num = Number(s);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

async function fetchSteamPriceOnce(marketHashName) {
  const url =
    `https://steamcommunity.com/market/priceoverview/` +
    `?currency=${CURRENCY}&appid=${STEAM_APPID}&market_hash_name=${encodeURIComponent(marketHashName)}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'FlashDropsBot/1.0',
      'Accept': 'application/json,text/javascript,*/*;q=0.1'
    },
  });
  if (!resp.ok) throw new Error(`Steam HTTP ${resp.status}`);

  const data = await resp.json();
  if (!data || data.success === false) throw new Error('Steam success=false');

  const raw = data.median_price || data.lowest_price || data.volume;
  const price = parsePrice(raw);
  if (price == null) throw new Error(`Price parse failed (raw="${raw}")`);

  const adjusted = Math.max(0, price * (1 - MARGIN_PCT / 100));
  return Math.round(adjusted * 100) / 100;
}

async function fetchSteamPrice(marketHashName) {
  let attempt = 0;
  let delay = 400;
  for (;;) {
    try {
      return await fetchSteamPriceOnce(marketHashName);
    } catch (e) {
      attempt++;
      if (attempt > RETRIES) throw e;
      await sleep(delay);
      delay *= 2;
    }
  }
}

async function updateAllPrices() {
  const { rows: list } = await db.query(
    `SELECT DISTINCT market_hash_name
       FROM case_items
      WHERE market_hash_name IS NOT NULL
        AND market_hash_name <> ''`
  );

  for (const { market_hash_name: mhn } of list) {
    try {
      const newPrice = await fetchSteamPrice(mhn);

      const { rows: updatedItems } = await db.query(
        `UPDATE case_items
            SET price = $1,
                price_updated_at = NOW()
          WHERE market_hash_name = $2
          RETURNING id`,
        [newPrice, mhn]
      );

      if (updatedItems.length) {
        const ids = updatedItems.map(r => r.id);
        await db.query(
          `UPDATE user_inventory
              SET price_current = $1
            WHERE item_id = ANY($2) AND is_sold = FALSE`,
          [newPrice, ids]
        );
      }

      console.log(`[prices] ${mhn} -> ${newPrice}`);
    } catch (e) {
      console.warn(`[prices] ${mhn} FAILED: ${e.message}`);
    }
    await sleep(REQ_DELAY_MS);
  }
}

module.exports = { updateAllPrices, fetchSteamPrice, parsePrice };
