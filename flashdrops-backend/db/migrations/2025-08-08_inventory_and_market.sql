-- flashdrops-backend/db/migrations/2025-08-08_market_prices.sql

BEGIN;

-- Связка предмета с Steam Market
ALTER TABLE case_items
  ADD COLUMN IF NOT EXISTS market_hash_name TEXT;

-- Инвентарь пользователя (создаём, если ещё нет)
CREATE TABLE IF NOT EXISTS user_inventory (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id       INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  case_name     TEXT    NOT NULL,
  item_id       INTEGER REFERENCES case_items(id) ON DELETE SET NULL,
  name          TEXT    NOT NULL,
  image         TEXT,
  price_current NUMERIC(12,2) NOT NULL DEFAULT 0,
  won_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  is_sold       BOOLEAN  NOT NULL DEFAULT FALSE,
  sold_at       TIMESTAMP
);

-- На случай, если таблица уже была без нужных колонок — добавляем безопасно
ALTER TABLE user_inventory
  ADD COLUMN IF NOT EXISTS price_current NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE user_inventory
  ADD COLUMN IF NOT EXISTS is_sold BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_inventory
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id       ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_item_id       ON user_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_case_items_market_hash_name  ON case_items(market_hash_name);

COMMIT;
