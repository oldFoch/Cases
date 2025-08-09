-- flashdrops-backend/db/manual/grant_admin.sql
-- ЗАПУСТИ ЭТО ОТДЕЛЬНО в Adminer/psql после миграции
-- Поставь свой SteamID64

UPDATE users
SET is_admin = TRUE
WHERE steam_id = '76561198299737710';

-- Проверка
SELECT id, steam_id, username, is_admin FROM users WHERE steam_id = '76561198299737710';
