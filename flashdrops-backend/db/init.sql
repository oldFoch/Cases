-- flashdrops-backend/db/init.sql
CREATE TABLE IF NOT EXISTS cases (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT,
  price INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS case_items (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  name TEXT,
  image TEXT,
  price INTEGER,
  chance INTEGER
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  steam_id TEXT UNIQUE NOT NULL,
  username TEXT,
  avatar TEXT,
  balance INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER,
  item_case_name TEXT,
  item_name TEXT,
  item_image TEXT,
  item_price INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
