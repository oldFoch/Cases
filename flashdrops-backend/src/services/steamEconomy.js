// flashdrops-backend/src/services/steamEconomy.js
// Берём у Steam classinfo по classid/instanceid -> получаем market_hash_name, картинку, качества/флаги.
// Используется при пополнении скинами (депозит), при работе с ботом и т.п.

const API_KEY = process.env.STEAM_API_KEY;
if (!API_KEY) {
  console.warn('[steamEconomy] STEAM_API_KEY is not set — classinfo lookups will fail.');
}

// Парсим wear/флаги из market_hash_name
function parseFromMHN(mhn) {
  if (!mhn) return { english_name: null, wear: null, is_stattrak: false, is_souvenir: false };
  const is_souvenir = mhn.startsWith('Souvenir ');
  const is_stattrak = mhn.startsWith('StatTrak™ ');
  // уберём префиксы
  let base = mhn.replace(/^Souvenir\s+|^StatTrak™\s+/i, '');
  // ищем (Factory New) / (Minimal Wear) / ...
  const wearMatch = base.match(/\(([^)]+)\)\s*$/);
  const wear = wearMatch ? wearMatch[1] : null;
  const english_name = wear ? base.replace(/\s*\([^)]+\)\s*$/, '') : base;
  return { english_name, wear, is_stattrak, is_souvenir };
}

// Строим ссылку на иконку
function buildImageUrl(icon_url) {
  if (!icon_url) return null;
  return `https://steamcommunity-a.akamaihd.net/economy/image/${icon_url}/360x360f?allow_animated=1`;
}

// items: [{ classid, instanceid? , assetid? }, ...]
async function enrichItemsWithClassInfo(appid, items) {
  if (!Array.isArray(items) || !items.length) return [];
  if (!API_KEY) throw new Error('STEAM_API_KEY is missing');

  // Готовим form-data для ISteamEconomy/GetAssetClassInfo/v1
  const form = new URLSearchParams();
  form.set('key', API_KEY);
  form.set('appid', String(appid));
  form.set('class_count', String(items.length));

  items.forEach((it, i) => {
    form.set(`classid${i}`, String(it.classid));
    if (it.instanceid) {
      form.set(`classid${i}_instanceid`, String(it.instanceid));
    }
  });

  const resp = await fetch('https://api.steampowered.com/ISteamEconomy/GetAssetClassInfo/v1/', {
    method: 'POST',
    body: form
  });
  if (!resp.ok) throw new Error(`Steam classinfo HTTP ${resp.status}`);
  const data = await resp.json();

  // Ответ может быть в разных обёртках, нормализуем
  const classes = (data && (data.result?.classes || data.result || data)) || {};
  const out = [];

  items.forEach((it, i) => {
    const keyA = it.instanceid ? `${it.classid}_${it.instanceid}` : String(it.classid);
    const keyB = String(i); // иногда Steam кладёт по индексу
    const ci = classes[keyA] || classes[keyB];

    const market_hash_name = ci?.market_hash_name || null;
    const icon_url = ci?.icon_url_large || ci?.icon_url || null;
    const image = buildImageUrl(icon_url);

    // Если нет MHN — попробуем из name/tags (но обычно MHN есть)
    let english_name, wear, is_stattrak, is_souvenir;
    if (market_hash_name) {
      ({ english_name, wear, is_stattrak, is_souvenir } = parseFromMHN(market_hash_name));
    } else {
      const n = ci?.name || '';
      // грубо: если нет MHN — хотя бы префиксы/скобки с name
      const m2 = parseFromMHN(n);
      english_name = m2.english_name || n || null;
      wear = m2.wear || null;
      is_stattrak = m2.is_stattrak || false;
      is_souvenir = m2.is_souvenir || false;
    }

    out.push({
      ...it,
      market_hash_name,
      english_name,
      wear,
      is_stattrak,
      is_souvenir,
      name: english_name || market_hash_name || ci?.name || null,
      image
    });
  });

  return out;
}

module.exports = { enrichItemsWithClassInfo, parseFromMHN, buildImageUrl };
