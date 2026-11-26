-- 0002_stats.sql
CREATE TABLE IF NOT EXISTS stats_hourly (
  hour_ts INTEGER PRIMARY KEY,           -- start of hour, unix s
  arr INTEGER NOT NULL, dep INTEGER NOT NULL,
  by_airline TEXT NOT NULL,              -- JSON {"ACA":3,...}
  by_type TEXT NOT NULL,                 -- JSON {"DH8D":2,...}
  by_runway TEXT NOT NULL,               -- JSON {"29":5,...}
  max_aircraft_seen INTEGER NOT NULL
);
