#!/usr/bin/env node
'use strict';

require('dotenv').config();
const db = require('../src/db');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');

function parseArgs() {
  const a = process.argv.slice(2);
  const map = {};
  for (let i = 0; i < a.length; i += 2) {
    if (a[i] && a[i].startsWith('--')) map[a[i].slice(2)] = a[i + 1];
  }
  return map;
}

async function getAccount(botId) {
  const q = await db.query(
    `SELECT id, bot_id, steam_login, steam_password, shared_secret
       FROM bot_accounts
      WHERE bot_id=$1 AND is_active=TRUE
      ORDER BY id
      LIMIT 1`,
    [botId]
  );
  return q.rows[0] || null;
}

(async () => {
  try {
    const { ['bot-id']: botIdStr, code } = parseArgs();
    const botId = Number(botIdStr);
    if (!botId || !code) {
      console.error('Usage: node scripts/bot-2fa-finalize.js --bot-id 1 --code 12345');
      process.exit(2);
    }

    const acc = await getAccount(botId);
    if (!acc) {
      console.error('Active bot_account not found for bot_id =', botId);
      process.exit(3);
    }
    if (!acc.shared_secret) {
      console.error('shared_secret is missing. Run bot-2fa-start first.');
      process.exit(4);
    }

    const user = new SteamUser();
    const community = new SteamCommunity();

    const webCookiesPromise = new Promise((resolve, reject) => {
      user.on('webSession', (_sid, cookies) => resolve(cookies));
      user.on('error', reject);
    });

    console.log('[2FA] logging in…', acc.steam_login);
    user.logOn({ accountName: acc.steam_login, password: acc.steam_password });
    const cookies = await webCookiesPromise;
    community.setCookies(cookies);

    console.log('[2FA] finalizing with SMS code…');
    await new Promise((resolve, reject) => {
      community.finalizeTwoFactor(acc.shared_secret, String(code).trim(), (err) => (err ? reject(err) : resolve()));
    });

    await db.query(
      `UPDATE bot_accounts
          SET twofa_enabled=TRUE
        WHERE id=$1`,
      [acc.id]
    );

    console.log('---------------------------------------------');
    console.log('[2FA] Success. Mobile Guard enabled. Auto-confirm ready.');
    console.log('---------------------------------------------');

    process.exit(0);
  } catch (e) {
    console.error('[2FA] finalize failed:', e.message || e);
    process.exit(1);
  }
})();
