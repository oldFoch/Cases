// flashdrops-backend/src/services/userService.js
'use strict';

const db = require('../db');

/**
 * Создаёт/обновляет пользователя из данных Steam.
 * Гарантирует ненулевой username.
 *
 * @param {string} steamId
 * @param {string|null} personaName
 * @param {string|null} avatarUrl
 * @returns {Promise<object>} user row
 */
async function upsertUserFromSteam(steamId, personaName, avatarUrl) {
  if (!steamId) throw new Error('steamId required');

  const raw = (personaName || '').trim();
  let username = raw || `user_${String(steamId).slice(-6)}`;
  if (username.length > 64) username = username.slice(0, 64);

  const avatar = avatarUrl || null;

  // предполагается, что в схеме есть уникальный индекс на users.steam_id
  const { rows } = await db.query(
    `
    INSERT INTO users (steam_id, username, avatar, last_login_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (steam_id) DO UPDATE
      SET username      = COALESCE(EXCLUDED.username, users.username),
          avatar        = COALESCE(EXCLUDED.avatar, users.avatar),
          last_login_at = NOW()
    RETURNING id, steam_id, username, avatar, balance, trade_url, is_admin, created_at, last_login_at
    `,
    [steamId, username, avatar]
  );

  return rows[0];
}

module.exports = {
  upsertUserFromSteam,
};
