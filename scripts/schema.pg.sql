-- Toko Mama — skema database PostgreSQL (Supabase)
-- Jalankan lewat `npm run db:setup` dengan DB_CLIENT=postgres / DATABASE_URL terisi.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(16)  NOT NULL DEFAULT 'pembeli',
  phone         VARCHAR(20)  DEFAULT NULL,
  avatar_url    TEXT         DEFAULT NULL,
  is_active     SMALLINT     NOT NULL DEFAULT 1,
  last_login_at TIMESTAMPTZ  DEFAULT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT ck_users_role CHECK (role IN ('admin', 'seller', 'pembeli'))
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (is_active);

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(60)  NOT NULL,
  slug        VARCHAR(80)  NOT NULL,
  description VARCHAR(200) DEFAULT NULL,
  created_by  INTEGER      DEFAULT NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_categories_name UNIQUE (name),
  CONSTRAINT uq_categories_slug UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  seller_id   INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id INTEGER      NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  name        VARCHAR(80)  NOT NULL,
  price       INTEGER      NOT NULL DEFAULT 0,
  stock       INTEGER      NOT NULL DEFAULT 0,
  description VARCHAR(300) DEFAULT NULL,
  image_url   TEXT         DEFAULT NULL,
  is_featured SMALLINT     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_seller ON products (seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products (is_featured);

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) PRIMARY KEY,
  data       TEXT         NOT NULL,
  expires    BIGINT       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);

CREATE TABLE IF NOT EXISTS settings (
  setting_key   VARCHAR(64) PRIMARY KEY,
  setting_value TEXT        DEFAULT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at otomatis (pengganti ON UPDATE CURRENT_TIMESTAMP di MySQL)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
