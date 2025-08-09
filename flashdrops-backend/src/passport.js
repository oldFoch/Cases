// flashdrops-backend/src/passport.js

const passport      = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const db            = require('./db');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await db.query(
      'SELECT id, steam_id, username, avatar, balance, is_admin FROM users WHERE id = $1',
      [id]
    );
    if (!rows.length) return done(null, false);
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

passport.use(new SteamStrategy(
  {
    returnURL:  `${process.env.FRONTEND_URL}/api/auth/steam/return`,
    realm:      process.env.FRONTEND_URL,
    apiKey:     process.env.STEAM_API_KEY
  },
  async (_identifier, profile, done) => {
    try {
      const steamId  = profile.id;
      const username = profile.displayName;
      const avatar   = profile.photos?.[2]?.value || profile.photos?.[0]?.value || null;

      let { rows } = await db.query(
        'SELECT id, steam_id, username, avatar, balance, is_admin FROM users WHERE steam_id = $1',
        [steamId]
      );

      let user;
      if (rows.length) {
        user = rows[0];
        // опционально обновим ник/аватар
        await db.query(
          'UPDATE users SET username = $1, avatar = $2 WHERE id = $3',
          [username, avatar, user.id]
        );
      } else {
        const insert = await db.query(
          `INSERT INTO users (steam_id, username, avatar, balance, is_admin)
           VALUES ($1, $2, $3, 0, FALSE)
           RETURNING id, steam_id, username, avatar, balance, is_admin`,
          [steamId, username, avatar]
        );
        user = insert.rows[0];
      }

      done(null, user);
    } catch (err) {
      done(err);
    }
  }
));

module.exports = passport;
