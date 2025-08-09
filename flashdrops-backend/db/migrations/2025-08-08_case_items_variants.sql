BEGIN;

ALTER TABLE case_items
  ADD COLUMN IF NOT EXISTS english_name TEXT,
  ADD COLUMN IF NOT EXISTS wear TEXT
    CHECK (wear IN ('Factory New','Minimal Wear','Field-Tested','Well-Worn','Battle-Scarred')),
  ADD COLUMN IF NOT EXISTS is_stattrak BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_souvenir BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS market_hash_name TEXT,
  ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_case_items_variant
  ON case_items (english_name, wear, is_stattrak, is_souvenir);

COMMIT;
