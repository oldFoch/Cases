// flashdrops-backend/src/passport.js

const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const User = require("./models/User");

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(
  new SteamStrategy(
    {
      returnURL: process.env.STEAM_RETURN_URL,
      realm: process.env.STEAM_REALM,
      apiKey: process.env.STEAM_API_KEY,
    },
    async (identifier, profile, done) => {
      try {
        const steamId = profile.id;
        // Определяем, является ли пользователь админом
        const isAdmin = steamId === process.env.ADMIN_STEAM_ID;

        // Сохраняем или обновляем пользователя в базе
        const user = await User.findOneAndUpdate(
          { steamId },
          {
            steamId,
            username: profile.displayName,
            avatar: profile.photos[2]?.value,
            isAdmin,
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

module.exports = passport;
