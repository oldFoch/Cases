-- backend/db/migrations/9999_lis_withdraw.sql
CREATE TABLE IF NOT EXISTS withdraw_orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  inventory_id BIGINT,
  lis_item_id BIGINT NOT NULL,
  lis_purchase_id BIGINT,
  trade_partner TEXT,
  trade_token TEXT,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdraw_user ON withdraw_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_withdraw_purchase ON withdraw_orders(lis_purchase_id);

CREATE TABLE IF NOT EXISTS balance_tx (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  kind TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
