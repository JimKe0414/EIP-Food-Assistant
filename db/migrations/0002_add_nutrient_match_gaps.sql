CREATE TABLE IF NOT EXISTS nutrient_match_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_name varchar(160) NOT NULL,
  matched_sample_id varchar(32),
  matched_name varchar(200),
  score numeric(4,3),
  occurrences integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS nutrient_match_gaps_query_name_uidx ON nutrient_match_gaps(query_name);
