'use strict';

const SteamStrategy = require('passport-steam').Strategy;
const db = require('./db');

const FRONTEND_URL  = process.env.FRONTEND_URL || 'http://localhost:5173';
const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_REALM   = process.env.STEAM_REALM || 'http://localhost:5000';
const STEAM_RETURN  = process.env.STEAM_RETURN_URL || `${STEAM_REALM}/api/auth/steam/return`;

module.exports = function configurePassport(passport) {
  passport.serializeUser((user, done) => {
    done(null, { id: user.id, steam_id: user.steam_id });
  });

  passport.deserializeUser(async (obj, done) => {
    try {
      let row = null;
      if (obj?.id) {
        const r = await db.query('SELECT * FROM users WHERE id = $1', [obj.id]);
        row = r.rows[0] || null;
      } else if (obj?.steam_id) {
        const r = await db.query('SELECT * FROM users WHERE steam_id = $1', [obj.steam_id]);
        row = r.rows[0] || null;
      }
      done(null, row || null);
    } catch (e) {
      done(e);
    }
  });

  passport.use(new SteamStrategy(
    {
      returnURL: STEAM_RETURN,
      realm: STEAM_REALM,
      apiKey: STEAM_API_KEY
    },
    async (_identifier, profile, done) => {
      try {
        const steamId = String(profile?.id || '').trim();
        const username =
          profile?.displayName ||
          profile?._json?.personaname ||
          `user_${steamId}`;
        const avatar =
          profile?._json?.avatarfull ||
          profile?.photos?.[2]?.value ||
          profile?.photos?.[0]?.value ||
          null;

        if (!steamId) return done(new Error('Missing SteamID'));

        const q = `
          INSERT INTO users (steam_id, username, avatar, balance, is_admin)
          VALUES ($1, $2, $3, 0, false)
          ON CONFLICT (steam_id) DO UPDATE SET
            username = EXCLUDED.username,
            avatar   = EXCLUDED.avatar
          RETURNING *;
        `;

        const { rows } = await db.query(q, [steamId, username, avatar]);
        return done(null, rows[0]);
      } catch (err) {
        return done(err);
      }
    }
  ));
};
