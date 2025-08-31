'use strict';

module.exports = {
  baseURL: 'https://api.waxpeer.com/v1',
  apiKey: process.env.WAXPEER_API_KEY || 'REPLACE_ME', // положи ключ в .env
  currency: 'FC',         // ваша внутренняя валюта
  // коэффициент перевода FC→USD если надо (оставь 1 если FC ~ RUB и уже считаешь цены в FC)
  fcToUsdRate: Number(process.env.FC_TO_USD_RATE || 1),

  // таймауты и ретраи
  timeoutMs: 10000,
  retries: 1,
};
