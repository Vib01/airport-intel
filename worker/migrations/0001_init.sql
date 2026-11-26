-- 0001_init.sql
CREATE TABLE IF NOT EXISTS state (       -- latest snapshots, one row per key
  key TEXT PRIMARY KEY,                  -- live, tracks, metar, metar_hist, taf, pirep, sigmet, forecast, health
  value TEXT NOT NULL,                   -- JSON
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('ARR','DEP')),
  hex TEXT NOT NULL, callsign TEXT, reg TEXT, type TEXT, airline TEXT,
  runway TEXT, ts INTEGER NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('HIGH','LOW'))
);
CREATE INDEX IF NOT EXISTS idx_mov_ts ON movements(ts DESC);
