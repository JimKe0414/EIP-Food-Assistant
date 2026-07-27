CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  health_goal varchar(40) NOT NULL DEFAULT '均衡飲食',
  reminder_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TYPE meal_source ADD VALUE IF NOT EXISTS 'tfda';

ALTER TABLE meals ADD COLUMN IF NOT EXISTS client_request_id varchar(100);

CREATE UNIQUE INDEX IF NOT EXISTS meals_user_client_request_uidx
  ON meals(user_id, client_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS meal_import_batches_user_hash_uidx
  ON meal_import_batches(user_id, file_hash);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_isolation ON user_preferences;
CREATE POLICY user_isolation ON user_preferences
  USING (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
