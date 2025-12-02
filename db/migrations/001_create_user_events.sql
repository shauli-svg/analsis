CREATE TABLE IF NOT EXISTS user_events (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT,
  event_name   TEXT NOT NULL,
  event_time   TIMESTAMP NOT NULL DEFAULT NOW(),
  context      JSONB,
  session_id   TEXT,
  source       TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_events_event_time
  ON user_events(event_time);
