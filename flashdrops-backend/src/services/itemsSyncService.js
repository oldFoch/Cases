'use strict';

const axios = require('axios');
const db = require('../db');

const DEFAULT_MARKUP = Number(process.env.ITEMS_DEFAULT_MARKUP || 12); // % наценка по умолчанию

// приведение одного предмета к формату upsert_items_master
function mapWaxpeerItem(x) {
  const mhn = String(x.market_hash_name || x.name || '').trim();
  if (!mhn) return null;

  const img =
    x.image ||
    x.img ||
    x.icon_url ||
    null;

  // базовая цена в рублях (waxpeer обычно отдаёт либо price, либо priceRUB)
  const base =
    x.base_price_rub != null ? Number(x.base_price_rub) :
    x.price_rub      != null ? Number(x.price_rub)      :
    x.priceRUB       != null ? Number(x.priceRUB)       :
    x.price          != null ? Number(x.price)          :
    null;

  if (base == null || !Number.isFinite(base) || base <= 0) return null;

  return {
    market_hash_name: mhn,
    name: String(x.name || mhn),
    image: img || null,
    base_price_rub: Number(base),
    // если хочешь — можно пробрасывать индивидуальную наценку x.markup_percent
    // иначе null, и функция в БД применит DEFAULT_MARKUP
    markup_percent: x.markup_percent != null ? Number(x.markup_percent) : null
  };
}

// чанкуем, чтобы не упереться в лимиты JSON/SQL
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Ручной апсертом из уже готового массива предметов (JSON)
 * itemsJson: Array<{ market_hash_name, name?, image?, base_price_rub, markup_percent? }>
 */
async function upsertFromJson(itemsJson, defaultMarkup = DEFAULT_MARKUP) {
  const mapped = (Array.isArray(itemsJson) ? itemsJson : [])
    .map(mapWaxpeerItem)
    .filter(Boolean);

  if (!mapped.length) return { inserted: 0, chunks: 0 };

  const parts = chunk(mapped, 800); // безопасный размер
  let total = 0;

  for (const part of parts) {
    // upsert_items_master ожидает JSONB
    await db.query('SELECT upsert_items_master($1::jsonb, $2::numeric)', [
      JSON.stringify(part),
      Number(defaultMarkup) || DEFAULT_MARKUP
    ]);
    total += part.length;
  }

  return { inserted: total, chunks: parts.length };
}

/**
 * Автосинк с Waxpeer (конкретный endpoint настраивается через .env)
 * Ожидаем, что API отдаёт массив предметов с полями price/img/market_hash_name.
 */
async function syncFromWaxpeer() {
  const API_KEY  = process.env.WAXPEER_API_KEY;
  const API_URL  = process.env.WAXPEER_ITEMS_URL || 'https://api.waxpeer.com/v1/prices'; // можно переопределить
  const TYPE     = process.env.WAXPEER_GAME || 'csgo';

  if (!API_KEY) throw new Error('WAXPEER_API_KEY не задан в .env');

  // Многие энтпоинты waxpeer принимают ключ через query (?api=) или через header.
  // Сделаем оба варианта, чтобы было совместимо.
  const params = { type: TYPE };
  const headers = { };

  if (API_URL.includes('api=')) {
    // уже указано в URL
  } else {
    params.api = API_KEY;
    headers['Authorization'] = API_KEY; // вдруг потребуется
  }

  const { data } = await axios.get(API_URL, { params, headers, timeout: 30000 });
  if (!data) throw new Error('Пустой ответ Waxpeer');

  // возможные форматы:
  // - массив предметов
  // - { items: [...] }
  const raw = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
  if (!raw.length) return { inserted: 0, chunks: 0 };

  return await upsertFromJson(raw, DEFAULT_MARKUP);
}

module.exports = {
  upsertFromJson,
  syncFromWaxpeer
};
