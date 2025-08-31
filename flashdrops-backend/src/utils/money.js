'use strict';

// ЖЁСТКО включаем режим "цены в БД в копейках".
const STORE_IN_CENTS = true;

function fromStore(v) {
  const n = Number(v) || 0;
  return STORE_IN_CENTS ? n / 100 : n;
}

function toStore(v) {
  const n = Number(v) || 0;
  return STORE_IN_CENTS ? Math.round(n * 100) : Math.round(n * 100) / 100;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

module.exports = { STORE_IN_CENTS, fromStore, toStore, round2 };
