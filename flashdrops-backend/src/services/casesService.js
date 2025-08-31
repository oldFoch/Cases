// src/services/casesService.js
'use strict';

const db = require('../db');

/**
 * Возвращает кейс по slug вместе с предметами.
 * На стороне SQL подстраховываемся по названиям столбцов, чтобы не упасть,
 * если где-то остались старые поля (title/name, price_rub/price_major).
 */
async function getCaseWithItems(slug) {
  const sqlCase = `
    SELECT
      c.id,
      c.slug,
      COALESCE(c.title, c.name, c.slug)                         AS title,
      COALESCE(c.price_rub, c.price_major, 0)::NUMERIC(12,2)   AS price_rub,
      c.image,
      COALESCE(c.is_active, TRUE)                               AS is_active
    FROM cases c
    WHERE c.slug = $1
    LIMIT 1
  `;
  const r1 = await db.query(sqlCase, [slug]);
  if (r1.rowCount === 0) return null;

  const caseRow = r1.rows[0];

  const sqlItems = `
    SELECT
      ci.item_master_id              AS id,
      im.market_hash_name,
      im.name,
      im.image,
      im.price_rub::NUMERIC(12,2)    AS price_rub,
      COALESCE(ci.weight, 1)         AS weight
    FROM case_items ci
    JOIN items_master im ON im.id = ci.item_master_id
    WHERE ci.case_id = $1
    ORDER BY im.price_rub ASC, im.id ASC
  `;
  const r2 = await db.query(sqlItems, [caseRow.id]);
  const items = r2.rows;

  return {
    id: caseRow.id,
    slug: caseRow.slug,
    title: caseRow.title,
    name: caseRow.title,     // на всякий случай для старого фронта
    price_rub: caseRow.price_rub,
    price: Number(caseRow.price_rub), // чтобы фронт точно увидел
    image: caseRow.image,
    is_active: caseRow.is_active,
    items
  };
}

/**
 * Возвращает список кейсов (без предметов), для гридов/списков.
 */
async function listCases() {
  const sql = `
    SELECT
      c.id,
      c.slug,
      COALESCE(c.title, c.name, c.slug)                       AS title,
      COALESCE(c.price_rub, c.price_major, 0)::NUMERIC(12,2) AS price_rub,
      c.image,
      COALESCE(c.is_active, TRUE)                             AS is_active
    FROM cases c
    ORDER BY c.id ASC
  `;
  const r = await db.query(sql);
  return r.rows.map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    name: row.title,
    price_rub: row.price_rub,
    price: Number(row.price_rub),
    image: row.image,
    is_active: row.is_active
  }));
}

/**
 * Полная очистка кейса от предметов по slug.
 */
async function clearCaseBySlug(slug) {
  const r = await db.query(`SELECT id FROM cases WHERE slug = $1 LIMIT 1`, [slug]);
  if (r.rowCount === 0) return { ok: false, error: 'Case not found' };
  const caseId = r.rows[0].id;
  await db.query(`DELETE FROM case_items WHERE case_id = $1`, [caseId]);
  return { ok: true };
}

module.exports = {
  getCaseWithItems,
  listCases,
  clearCaseBySlug,
};
