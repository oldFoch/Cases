'use strict';

const STEAM_URL_RE = /https?:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=(\d+)&token=([A-Za-z0-9_-]+)/i;

function parseTradeURL(url) {
  if (!url) return null;
  const m = String(url).match(STEAM_URL_RE);
  if (!m) return null;
  return { partner: m[1], token: m[2] };
}

module.exports = { parseTradeURL };
