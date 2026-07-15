CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE sex AS ENUM ('male', 'female');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE meal_source AS ENUM ('manual', 'photo', 'voice', 'eip', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE food_type AS ENUM ('meat', 'veg', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM ('success', 'no_change', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_hmac varchar(64) NOT NULL UNIQUE,
  role varchar(20) NOT NULL DEFAULT 'user',
  push_subscription jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  age integer NOT NULL, sex sex NOT NULL, height_cm numeric(5,1) NOT NULL, weight_kg numeric(5,1) NOT NULL,
  body_fat_percent numeric(4,1), muscle_kg numeric(5,1), activity_factor numeric(4,3) NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_snapshots_user_measured_idx ON profile_snapshots(user_id, measured_at);

CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_date date NOT NULL, meal_type meal_type NOT NULL, source meal_source NOT NULL, name varchar(160) NOT NULL,
  calories_kcal numeric(8,2) NOT NULL, protein_g numeric(7,2), fat_g numeric(7,2), carbs_g numeric(7,2),
  fiber_g numeric(7,2), sodium_mg numeric(9,2), confidence numeric(4,3), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meals_user_date_idx ON meals(user_id, meal_date);

CREATE TABLE IF NOT EXISTS custom_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL, calories_kcal numeric(8,2) NOT NULL, protein_g numeric(7,2), fat_g numeric(7,2),
  carbs_g numeric(7,2), sodium_mg numeric(9,2), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_foods_user_idx ON custom_foods(user_id);

CREATE TABLE IF NOT EXISTS eip_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_date date NOT NULL, food_type food_type NOT NULL DEFAULT 'unknown', vendor_name varchar(120), name varchar(160) NOT NULL,
  calories_kcal numeric(8,2) NOT NULL, protein_g numeric(7,2), fat_g numeric(7,2), carbs_g numeric(7,2),
  sodium_mg numeric(9,2), imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eip_menu_user_date_idx ON eip_menu_items(user_id, service_date);

CREATE TABLE IF NOT EXISTS eip_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_date date NOT NULL, name varchar(100) NOT NULL, calories_kcal numeric(8,2) NOT NULL,
  protein_g numeric(7,2), fat_g numeric(7,2), carbs_g numeric(7,2), sodium_mg numeric(9,2),
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eip_orders_user_date_idx ON eip_orders(user_id, meal_date);

CREATE TABLE IF NOT EXISTS nutrients (
  sample_id varchar(32) PRIMARY KEY, name varchar(200) NOT NULL, aliases text, description text,
  waste_percent numeric(7,3), calories_kcal numeric(10,3), adjusted_calories_kcal numeric(10,3), water_g numeric(10,3),
  protein_g numeric(10,3), fat_g numeric(10,3), saturated_fat_g numeric(10,3), ash_g numeric(10,3),
  carbs_g numeric(10,3), fiber_g numeric(10,3), sugar_g numeric(10,3), optional_nutrients jsonb NOT NULL DEFAULT '{}',
  trace_fields jsonb NOT NULL DEFAULT '[]', version_hash varchar(64) NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nutrients_name_idx ON nutrients(name);

CREATE TABLE IF NOT EXISTS nutrients_staging (sample_id varchar(32) PRIMARY KEY, payload jsonb NOT NULL, version_hash varchar(64) NOT NULL);
CREATE TABLE IF NOT EXISTS nutrient_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), file_hash varchar(64) NOT NULL UNIQUE, columns_hash varchar(64) NOT NULL,
  source_etag text, source_last_modified text, row_count integer NOT NULL, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nutrient_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status sync_status NOT NULL, message text NOT NULL, file_hash varchar(64),
  row_count integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meal_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_hash varchar(64) NOT NULL, row_count integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meal_import_batches_user_idx ON meal_import_batches(user_id);
CREATE TABLE IF NOT EXISTS ai_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  job_type varchar(40) NOT NULL, provider varchar(40) NOT NULL, status varchar(20) NOT NULL,
  duration_ms integer, error_code varchar(80), created_at timestamptz NOT NULL DEFAULT now()
);

-- Private tables use both PostgreSQL RLS and explicit application WHERE clauses.
ALTER TABLE profile_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals FORCE ROW LEVEL SECURITY;
ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_foods FORCE ROW LEVEL SECURITY;
ALTER TABLE eip_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE eip_menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE eip_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE eip_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE meal_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_import_batches FORCE ROW LEVEL SECURITY;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['profile_snapshots','meals','custom_foods','eip_menu_items','eip_orders','meal_import_batches'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS user_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY user_isolation ON %I USING (user_id = nullif(current_setting(''app.current_user_id'', true), '''')::uuid) WITH CHECK (user_id = nullif(current_setting(''app.current_user_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;
