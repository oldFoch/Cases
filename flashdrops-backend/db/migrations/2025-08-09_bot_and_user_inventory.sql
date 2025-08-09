BEGIN;

-- 0) Чистим старые индексы/триггеры/таблицу (могли создаться с кривыми колонками)
DROP INDEX IF EXISTS idx_bot_inv_available;
DROP INDEX IF EXISTS idx_bot_inv_base_name;
DROP TRIGGER IF EXISTS trg_bot_inventory_updated ON bot_inventory;
DROP TABLE IF EXISTS bot_inventory CASCADE;

-- 1) Создаём таблицу bot_inventory с НОРМАЛЬНЫМИ именами колонок
CREATE TABLE bot_inventory (
  id               SERIAL PRIMARY KEY,
  asset_id         TEXT,
  classid          TEXT,
  instanceid       TEXT,

  market_hash_name TEXT NOT NULL,           -- полное рыночное имя
  base_name        TEXT NOT NULL,           -- без качества/префиксов, напр. "Desert Eagle | Hypnotic"
  image            TEXT,
  wear             TEXT,
  is_stattrak      BOOLEAN NOT NULL DEFAULT FALSE,
  is_souvenir      BOOLEAN NOT NULL DEFAULT FALSE,

  price_current    NUMERIC(12,2),
  price_updated_at TIMESTAMP,

  reserved_by_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reserved_at      TIMESTAMP,
  used             BOOLEAN NOT NULL DEFAULT FALSE,  -- уже выдан/списан

  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2) Индексы (строго по английским идентификаторам)
CREATE INDEX IF NOT EXISTS idx_bot_inv_available
  ON bot_inventory (used, reserved_by_user);

CREATE INDEX IF NOT EXISTS idx_bot_inv_base_name
  ON bot_inventory (lower(base_name));

-- 3) Функция и триггер updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bot_inventory_updated
BEFORE UPDATE ON bot_inventory
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4) Чиним внешнюю связь из user_inventory (на случай, если она отвалилась из-за CASCADE)
ALTER TABLE user_inventory
  DROP CONSTRAINT IF EXISTS user_inventory_bot_item_id_fkey;

ALTER TABLE user_inventory
  ADD CONSTRAINT user_inventory_bot_item_id_fkey
  FOREIGN KEY (bot_item_id) REFERENCES bot_inventory(id) ON DELETE SET NULL;

COMMIT;
