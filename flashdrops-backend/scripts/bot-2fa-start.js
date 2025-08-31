#!/usr/bin/env node
'use strict';

require('dotenv').config();
const db = require('../src/db');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');

// <<< подставлены твои креды >>>
const BOT_LOGIN = 'flashdropsbot1';
const BOT_PASS  = 'Limon007700';
// имя “витрины” бота в таблице bots:
const BOT_NAME  = 'Bot #1';

async function ensureBot(name) {
  // пытаемся найти
  const ex = await db.query('SELECT id FROM bots WHERE name=$1 LIMIT 1', [name]);
  if (ex.rowCount) {
    const id = ex.rows[0].id;
    // убедимся, что активен
    await db.query('UPDATE bots SET is_active=TRUE WHERE id=$1', [id]);
    return id;
  }
  // создаём
  const ins = await db.query(
    'INSERT INTO bots (name, is_active) VALUES ($1, TRUE) RETURNING id',
    [name]
  );
  return ins.rows[0].id;
}

async function ensureAccount(botId, login, pass) {
  // ищем учётку по логину
  const ex = await db.query(
    'SELECT id FROM bot_accounts WHERE steam_login=$1 LIMIT 1',
    [login]
  );
  if (ex.rowCount) {
    const id = ex.rows[0].id;
    // обновим пароль/привязку/флаг активности
    await db.query(
      `UPDATE bot_accounts
          SET bot_id=$1, steam_password=$2, is_active=TRUE, name=COALESCE(name,'Main Account')
        WHERE id=$3`,
      [botId, pass, id]
    );
    return id;
  }
  // создаём новую запись
  const ins = await db.query(
    `INSERT INTO bot_accounts (bot_id, name, steam_login, steam_password, is_active)
     VALUES ($1, 'Main Account', $2, $3, TRUE)
     RETURNING id`,
    [botId, login, pass]
  );
  return ins.rows[0].id;
}

(async () => {
  try {
    console.log('[2FA] ищу/создаю бота…');
    const botId = await ensureBot(BOT_NAME);
    console.log('[2FA] bot_id =', botId);

    console.log('[2FA] ищу/создаю аккаунт…');
    const accId = await ensureAccount(botId, BOT_LOGIN, BOT_PASS);
    console.log('[2FA] bot_account_id =', accId);

    // логин в Steam
    console.log('[2FA] логин в Steam…', BOT_LOGIN);
    const user = new SteamUser();
    const community = new SteamCommunity();

    const webCookiesPromise = new Promise((resolve, reject) => {
      user.once('webSession', (_sid, cookies) => resolve(cookies));
      user.once('error', reject);
    });

    user.logOn({ accountName: BOT_LOGIN, password: BOT_PASS });
    const cookies = await webCookiesPromise;
    community.setCookies(cookies);

    console.log('[2FA] включаю мобильный Guard (нужен привязанный телефон!)…');
    const enable = await new Promise((resolve, reject) => {
      community.enableTwoFactor((err, resp) => (err ? reject(err) : resolve(resp)));
    });
    // enable => { shared_secret, identity_secret, revocation_code, ... }

    await db.query(
      `UPDATE bot_accounts
          SET shared_secret=$1,
              identity_secret=$2,
              revocation_code=$3
        WHERE id=$4`,
      [enable.shared_secret, enable.identity_secret, enable.revocation_code, accId]
    );

    console.log('─────────────────────────────────────────────');
    console.log('[2FA] Шаг 1 выполнен. Steam отправил SMS-код на привязанный номер.');
    console.log(`[2FA] Введите код командой: node scripts/bot-2fa-finalize.js --bot-id ${botId} --code 12345`);
    console.log('─────────────────────────────────────────────');
    process.exit(0);
  } catch (e) {
    // Частый кейс: InvalidPassword, NeedCaptcha, EmailCodeRequired, PhoneNumberUnverified и т.п.
    console.error('[2FA] ошибка:', e.message || e);
    process.exit(1);
  }
})();
