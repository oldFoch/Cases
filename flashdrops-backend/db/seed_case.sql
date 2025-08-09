-- flashdrops-backend/db/seed_case.sql

BEGIN;

-- Вставляем новый кейс
INSERT INTO cases (name, image, price)
VALUES
  ('Starter Case', '/images/starter-case.png', 100)
RETURNING id;

-- Предположим, что вернулось id = 1
-- Вставляем предметы для этого кейса
INSERT INTO case_items (case_id, name, image, price, chance) VALUES
  (1, 'Common Skin',    '/images/common-skin.png',    10,  70),
  (1, 'Rare Skin',      '/images/rare-skin.png',     100,  25),
  (1, 'Legendary Skin', '/images/legendary-skin.png',500,   5);

COMMIT;
