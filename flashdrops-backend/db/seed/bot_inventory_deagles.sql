-- Добавляем РОВНО те market_hash_name, что ты прислал ссылками
-- (вставка произойдет только если такой записи ещё нет)

-- Desert Eagle | Golden Koi (Minimal Wear)
INSERT INTO bot_inventory (market_hash_name, base_name, wear)
SELECT 'Desert Eagle | Golden Koi (Minimal Wear)', 'Desert Eagle | Golden Koi', 'Minimal Wear'
WHERE NOT EXISTS (
  SELECT 1 FROM bot_inventory WHERE market_hash_name = 'Desert Eagle | Golden Koi (Minimal Wear)'
);

-- Desert Eagle | Code Red (Factory New)
INSERT INTO bot_inventory (market_hash_name, base_name, wear)
SELECT 'Desert Eagle | Code Red (Factory New)', 'Desert Eagle | Code Red', 'Factory New'
WHERE NOT EXISTS (
  SELECT 1 FROM bot_inventory WHERE market_hash_name = 'Desert Eagle | Code Red (Factory New)'
);

-- Desert Eagle | Hypnotic (Factory New)
INSERT INTO bot_inventory (market_hash_name, base_name, wear)
SELECT 'Desert Eagle | Hypnotic (Factory New)', 'Desert Eagle | Hypnotic', 'Factory New'
WHERE NOT EXISTS (
  SELECT 1 FROM bot_inventory WHERE market_hash_name = 'Desert Eagle | Hypnotic (Factory New)'
);

-- Desert Eagle | Oxide Blaze (Factory New)
INSERT INTO bot_inventory (market_hash_name, base_name, wear)
SELECT 'Desert Eagle | Oxide Blaze (Factory New)', 'Desert Eagle | Oxide Blaze', 'Factory New'
WHERE NOT EXISTS (
  SELECT 1 FROM bot_inventory WHERE market_hash_name = 'Desert Eagle | Oxide Blaze (Factory New)'
);

-- Desert Eagle | Ocean Drive (Factory New)
INSERT INTO bot_inventory (market_hash_name, base_name, wear)
SELECT 'Desert Eagle | Ocean Drive (Factory New)', 'Desert Eagle | Ocean Drive', 'Factory New'
WHERE NOT EXISTS (
  SELECT 1 FROM bot_inventory WHERE market_hash_name = 'Desert Eagle | Ocean Drive (Factory New)'
);

-- Desert Eagle | Meteorite (Factory New)
INSERT INTO bot_inventory (market_hash_name, base_name, wear)
SELECT 'Desert Eagle | Meteorite (Factory New)', 'Desert Eagle | Meteorite', 'Factory New'
WHERE NOT EXISTS (
  SELECT 1 FROM bot_inventory WHERE market_hash_name = 'Desert Eagle | Meteorite (Factory New)'
);
