-- Convert the old per-user, per-date EIP menu snapshot into a shared restaurant catalog.
-- Personal EIP order history remains private in eip_orders and meals.

CREATE TABLE IF NOT EXISTS eip_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  normalized_name varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS eip_restaurants_normalized_name_uidx
  ON eip_restaurants(normalized_name);
CREATE INDEX IF NOT EXISTS eip_restaurants_name_idx
  ON eip_restaurants(name);

ALTER TABLE eip_menu_items
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES eip_restaurants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS normalized_name varchar(160);

INSERT INTO eip_restaurants (name, normalized_name)
SELECT DISTINCT
  coalesce(nullif(btrim(vendor_name), ''), '未命名餐廳'),
  lower(regexp_replace(coalesce(nullif(btrim(vendor_name), ''), '未命名餐廳'), '\s+', ' ', 'g'))
FROM eip_menu_items
ON CONFLICT (normalized_name) DO NOTHING;

UPDATE eip_menu_items AS item
SET
  restaurant_id = restaurant.id,
  normalized_name = lower(regexp_replace(btrim(item.name), '\s+', ' ', 'g'))
FROM eip_restaurants AS restaurant
WHERE restaurant.normalized_name =
  lower(regexp_replace(coalesce(nullif(btrim(item.vendor_name), ''), '未命名餐廳'), '\s+', ' ', 'g'))
  AND (item.restaurant_id IS NULL OR item.normalized_name IS NULL);

-- When old user/date snapshots contain the same restaurant and meal more than once,
-- retain the most recently imported row before adding the global unique constraint.
DELETE FROM eip_menu_items AS older
USING eip_menu_items AS newer
WHERE older.restaurant_id = newer.restaurant_id
  AND older.normalized_name = newer.normalized_name
  AND (
    older.imported_at < newer.imported_at
    OR (older.imported_at = newer.imported_at AND older.id::text < newer.id::text)
  );

DROP POLICY IF EXISTS user_isolation ON eip_menu_items;
ALTER TABLE eip_menu_items NO FORCE ROW LEVEL SECURITY;
ALTER TABLE eip_menu_items DISABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS eip_menu_user_date_idx;

ALTER TABLE eip_menu_items
  ALTER COLUMN restaurant_id SET NOT NULL,
  ALTER COLUMN normalized_name SET NOT NULL,
  DROP COLUMN IF EXISTS user_id,
  DROP COLUMN IF EXISTS service_date,
  DROP COLUMN IF EXISTS vendor_name;

CREATE UNIQUE INDEX IF NOT EXISTS eip_menu_restaurant_name_uidx
  ON eip_menu_items(restaurant_id, normalized_name);
CREATE INDEX IF NOT EXISTS eip_menu_restaurant_food_type_idx
  ON eip_menu_items(restaurant_id, food_type);

CREATE TABLE IF NOT EXISTS user_daily_restaurant_selections (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES eip_restaurants(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_daily_restaurant_selections_pk PRIMARY KEY (user_id, service_date)
);

CREATE INDEX IF NOT EXISTS user_daily_restaurant_selections_restaurant_idx
  ON user_daily_restaurant_selections(restaurant_id);

ALTER TABLE user_daily_restaurant_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_restaurant_selections FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_isolation ON user_daily_restaurant_selections;
CREATE POLICY user_isolation ON user_daily_restaurant_selections
  USING (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
