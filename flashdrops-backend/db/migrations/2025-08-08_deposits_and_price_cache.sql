BEGIN;

-- Кэш цен, чтобы не долбить Steam по 100 раз
CREATE TABLE IF NOT EXISTS price_cache (
  market_hash_name TEXT PRIMARY KEY,
  price           NUMERIC(12,2) NOT NULL,
  updated_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Склад бота / депозиты
CREATE TABLE IF NOT EXISTS bot_inventory (
  id               SERIAL PRIMARY KEY,
  appid            INTEGER NOT NULL,              -- 730
  classid          TEXT    NOT NULL,
  instanceid       TEXT,
  assetid          TEXT,                          -- ID в инвентаре бота
  name             TEXT,
  image            TEXT,
  market_hash_name TEXT,
  english_name     TEXT,
  wear             TEXT CHECK (wear IN ('Factory New','Minimal Wear','Field-Tested','Well-Worn','Battle-Scarred') OR wear IS NULL),
  is_stattrak      BOOLEAN NOT NULL DEFAULT FALSE,
  is_souvenir      BOOLEAN NOT NULL DEFAULT FALSE,

  price_current    NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_updated_at TIMESTAMP,
  owner_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL, -- кто внёс
  deposit_tx_id    INTEGER REFERENCES transactions(id) ON DELETE SET NULL, -- запись о депозите
  tradelock_until  TIMESTAMP,                 -- когда можно выводить
  status           TEXT NOT NULL DEFAULT 'in_stock'  -- in_stock|reserved|sold|withdrawn
);

CREATE INDEX IF NOT EXISTS idx_bot_inventory_status ON bot_inventory(status);
CREATE INDEX IF NOT EXISTS idx_bot_inventory_owner ON bot_inventory(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_inventory_mhn    ON bot_inventory(market_hash_name);
CREATE INDEX IF NOT EXISTS idx_price_cache_updated  ON price_cache(updated_at);

COMMIT;
