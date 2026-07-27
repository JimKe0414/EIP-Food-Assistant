ALTER TABLE eip_menu_items
  ADD COLUMN IF NOT EXISTS fiber_g numeric(7, 2),
  ADD COLUMN IF NOT EXISTS nutrition_estimated boolean NOT NULL DEFAULT false;
