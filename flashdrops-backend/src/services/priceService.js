// flashdrops-backend/src/services/priceService.js
'use strict';

/**
 * Получение цены со Steam Market:
 * 1) пробуем RUB (5)
 * 2) если пусто — USD (1) → конвертим в RUB
 * 3) если пусто — EUR (3) → конвертим в RUB
 * Всегда возвращаем РУБЛИ с вычетом маржи.
 */

const axios = require('axios');

const APPID = Number(process.env.STEAM_APPID || 730);
const MARGIN = Number(process.env.PRICE_MARGIN_PERCENT || 0);

const FETCH_TIMEOUT = Number(process.env.PRICE_FETCH_TIMEOUT_MS || 2000);
const FETCH_RETRIES = Number(process.env.PRICE_FETCH_RETRIES || 0);
const FETCH_COOLDOWN_MS = Number(process.env.PRICE_FETCH_COOLDOWN_MS || 200);

// FX fallback (обязательно выстави в .env)
const FX_USD_RUB = Number(process.env.FX_USD_RUB || 95);
const FX_EUR_RUB = Number(process.env.FX_EUR_RUB || 103);

// Cookies для региона (желательно)
const STEAM_SESSIONID = process.env.STEAM_SESSIONID || '';
const STEAM_COUNTRY = process.env.STEAM_COUNTRY || ''; // пример: RU%7C<hash> или DE%7C<hash>

const CURRENCIES = [
  { id: 5,  mulToRub: 1,                name: 'RUB' },
  { id: 1,  mulToRub: Number(FX_USD_RUB) || 95,  name: 'USD' },
  { id: 3,  mulToRub: Number(FX_EUR_RUB) || 103, name: 'EUR' },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function buildHeaders() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; FlashDropsBot/1.0)',
    'Accept': 'application/json, text/javascript,*/*;q=0.1',
  };
  const cookies = [];
  if (STEAM_SESSIONID) cookies.push(`sessionid=${STEAM_SESSIONID}`);
  if (STEAM_COUNTRY)   cookies.push(`steamCountry=${STEAM_COUNTRY}`);
  if (cookies.length) headers['Cookie'] = cookies.join('; ');
  return headers;
}

function parsePriceNumber(str) {
  if (!str) return null;
  const cleaned = String(str)
    .replace(/\s+/g, '')
    .replace(/[^\d,.\-]/g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function applyMarginRub(rub) {
  const p = Number(rub) || 0;
  const m = Number(MARGIN) || 0;
  const withMargin = p * (1 - m / 100);
  return Math.round(withMargin * 100) / 100;
}

async function fetchOne(marketHashName, currencyId) {
  const url = `https://steamcommunity.com/market/priceoverview/` +
              `?appid=${APPID}&currency=${currencyId}&market_hash_name=${encodeURIComponent(marketHashName)}`;

  let lastErr;
  for (let i = 0; i <= FETCH_RETRIES; i++) {
    try {
      const { data } = await axios.get(url, { timeout: FETCH_TIMEOUT, headers: buildHeaders() });
      if (!data || data.success !== true) throw new Error('bad-status');

      const s = data.lowest_price || data.median_price;
      const num = parsePriceNumber(s);
      if (num == null || num <= 0) throw new Error('no-price');

      if (FETCH_COOLDOWN_MS > 0) await sleep(FETCH_COOLDOWN_MS);
      return num; // число в валюте currencyId
    } catch (e) {
      lastErr = e;
      if (FETCH_COOLDOWN_MS > 0) await sleep(FETCH_COOLDOWN_MS);
    }
  }
  throw lastErr || new Error('fetch-failed');
}

/**
 * Главная функция: всегда возвращает цену в РУБЛЯХ (с маржей).
 */
async function fetchSteamPrice(marketHashName) {
  let lastErr;
  for (const cur of CURRENCIES) {
    try {
      const numInCurrency = await fetchOne(marketHashName, cur.id);
      const inRub = Math.round(numInCurrency * cur.mulToRub * 100) / 100;
      return applyMarginRub(inRub);
    } catch (e) {
      lastErr = e;
      // пробуем следующую валюту
    }
  }
  throw lastErr || new Error('no-price');
}

module.exports = { fetchSteamPrice };
