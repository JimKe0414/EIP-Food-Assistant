ALTER TABLE meals ADD COLUMN IF NOT EXISTS meal_time time;

UPDATE meals
SET meal_time = (created_at AT TIME ZONE 'Asia/Taipei')::time
WHERE meal_time IS NULL;

ALTER TABLE meals ALTER COLUMN meal_time SET DEFAULT time '12:00:00';
ALTER TABLE meals ALTER COLUMN meal_time SET NOT NULL;
