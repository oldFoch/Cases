// flashdrops-backend/src/services/priceService.js
// Тянет цену со Steam Market (median/lowest), умеет парсить любой формат цены,
// пробует несколько валют (ENV → USD → EUR → RUB), применяет ваш минус-% и возвращает число.

const STEAM_APPID = Number(process.env.STEAM_APPID || 730);
const PRIMARY_CURRENCY = Number(process.env.STEAM_CURRENCY || 5); // 5=RUB, 1=USD, 3=EUR
const PRICE_MARGIN_PERCENT = Number(process.env.PRICE_MARGIN_PERCENT || 5);

// порядок попыток валют (ENV → USD → EUR → RUB), без дублей
const CURRENCY_CHAIN = [PRIMARY_CURRENCY, 1, 3, 5].filter(
  (v, i, a) => a.indexOf(v) === i
);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Нормализуем строку цены в число (поддержка "1 234,56 ₽", "1,234.56", "1234.56", и т.п.)
function parsePrice(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d.,\s]/g, '').trim(); // выкинуть символы валюты
  s = s.replace(/\s+/g, ''); // убрать пробелы тысяч
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // формат "1.234,56" → "1234.56"
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // формат "1,234.56" или "1234.56" → "1234.56"
    s = s.replace(/,/g, '');
  }
  const num = Number(s);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

async function fetchPriceOverview(marketHashName, currency) {
  const url = `https://steamcommunity.com/market/priceoverview/?currency=${currency}` +
              `&appid=${STEAM_APPID}&market_hash_name=${encodeURIComponent(marketHashName)}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': 'FlashDropsBot/1.0 (+priceService)' }
  });

  const text = await resp.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // иногда Steam отдаёт HTML (rate-limit/капча) — считаем это неуспехом
    throw new Error(`Steam non-JSON response (currency=${currency})`);
  }

  if (!data || data.success === false) {
    throw new Error(`Steam success=false (currency=${currency})`);
  }

  const raw = data.median_price || data.lowest_price || data.volume; // volume как последний шанс
  const price = parsePrice(raw);
  if (price == null) {
    throw new Error(`price parse failed (currency=${currency}, raw=${raw})`);
  }

  // применяем ваш минус-% (скидку)
  const adjusted = Math.max(0, price * (1 - (PRICE_MARGIN_PERCENT / 100)));
  return Number(adjusted.toFixed(2));
}

// Публичная функция: получить цену с фолбэком по валютам и лёгким ретраем
async function getPriceWithCache(marketHashName) {
  let lastErr = null;

  for (const cur of CURRENCY_CHAIN) {
    // до 2 попыток на валюту — на случай редкого rate-limit
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const price = await fetchPriceOverview(marketHashName, cur);
        return price;
      } catch (e) {
        lastErr = e;
        // маленький экспоненциальный бэкофф
        await sleep(attempt * 400);
      }
    }
  }

  throw new Error(`Steam price not found for "${marketHashName}": ${lastErr?.message || 'unknown'}`);
}

module.exports = { getPriceWithCache };
