'use strict';
const axios = require('axios');

const BASE_URL = process.env.WAXPEER_BASE_URL || 'https://api.waxpeer.com';

// Пути берём из .env, чтобы не менять код
const PATHS = {
  BALANCE:      process.env.WAXPEER_PATH_BALANCE      || '/v1/user/balance',
  SEARCH:       process.env.WAXPEER_PATH_SEARCH       || '/v1/market/search',
  BUY:          process.env.WAXPEER_PATH_BUY          || '/v1/market/buy',
  INFO:         process.env.WAXPEER_PATH_INFO         || '/v1/market/info',
  WITHDRAW:     process.env.WAXPEER_PATH_WITHDRAW     || '/v1/market/withdraw',
  WITHDRAW_ALL: process.env.WAXPEER_PATH_WITHDRAW_ALL || '/v1/market/withdraw-all',
};

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { Accept: 'application/json' }
});

// Поддержим и header, и query-param (на всякий случай)
api.interceptors.request.use((cfg) => {
  const key = process.env.WAXPEER_API_KEY;
  if (key) {
    cfg.headers.Authorization = `Bearer ${key}`;
    cfg.params = { ...(cfg.params || {}), api_key: key };
  }
  return cfg;
});

async function getBalance() {
  const { data } = await api.get(PATHS.BALANCE);
  return data?.data || data; // приведи при необходимости
}

/**
 * Поиск предметов по названию (минимум — query). Дальше фильтруем по цене на нашей стороне.
 * Важное: подгони под реальный формат Waxpeer (параметры/поля).
 */
async function search({ query, limit = 50 }) {
  const { data } = await api.get(PATHS.SEARCH, {
    params: {
      game: 'csgo',
      q: query,
      per_page: Math.min(200, Math.max(1, limit))
    }
  });
  // ожидаемый формат — data.data:[{id, name, price, ...}]
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Покупка (для Waxpeer может быть другой контракт/параметры — см. доку).
 * Здесь придерживаемся общей структуры, как у lis-skins:
 * { ids: number[], partner, token, max_price, custom_id, skip_unavailable }
 */
async function buy({ ids, partner, token, max_price, custom_id, skip_unavailable = true }) {
  const { data } = await api.post(PATHS.BUY, {
    ids, partner, token, max_price, custom_id, skip_unavailable
  }, { headers: { 'Content-Type': 'application/json' } });
  // ожидаем data.data.purchase_id, data.data.skins...
  return data?.data || data;
}

/**
 * Информация о покупках/скинах (статусы)
 * Возвращает массив покупок с вложенными skins[]
 */
async function getPurchaseInfo() {
  const { data } = await api.get(PATHS.INFO);
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Запрос на withdraw (для скинов с hold’ом).
 * Если в Waxpeer иначе — поменяешь PATH и форму.
 */
async function withdraw({ purchase_id, partner, token }) {
  const { data } = await api.post(PATHS.WITHDRAW, {
    purchase_id, partner, token
  }, { headers: { 'Content-Type': 'application/json' } });
  return Array.isArray(data?.data) ? data.data : data?.data || data;
}

module.exports = {
  getBalance,
  search,
  buy,
  getPurchaseInfo,
  withdraw,
  _api: api,
  _PATHS: PATHS
};
