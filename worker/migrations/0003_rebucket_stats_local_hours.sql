-- 0003_rebucket_stats_local_hours.sql  (one-off)
--
-- stats_hourly used to be bucketed on UTC hours. For St. John's (NST UTC−3:30 / NDT UTC−2:30) that
-- made every "hour" run from :30 to :30 local time. The Worker now writes LOCAL clock hours; this
-- migration rebuilds existing rows to match.
--
-- In America/St_Johns every local hour starts at :30 UTC in BOTH seasons (offsets differ by a whole
-- hour), so the local hour containing `ts` is:  ts - ((ts - 1800) % 3600).
-- The 1800 constant is specific to this airport's time zone.
--
-- Rules:
--   1. Hours covered by raw movements are recounted from `movements` (exact).
--      max_aircraft_seen = max of the overlapping old UTC rows (best available).
--   2. Old UTC-aligned rows whose hour has no movements:
--      - inside the movements window: kept only for max_aircraft_seen (counts would double-count);
--      - older than the movements window (retention 90 d): counts kept, shifted to the local hour
--        that starts 30 min earlier (best effort; those movements no longer exist to recount).
--   3. Rows that are already local-aligned (written by the new code) are kept unchanged.

CREATE TABLE stats_hourly_local (
  hour_ts INTEGER PRIMARY KEY,
  arr INTEGER NOT NULL, dep INTEGER NOT NULL,
  by_airline TEXT NOT NULL, by_type TEXT NOT NULL, by_runway TEXT NOT NULL,
  max_aircraft_seen INTEGER NOT NULL
);

-- 1. Recount from movements.
WITH m AS (
  SELECT ts - ((ts - 1800) % 3600) AS h, kind, airline, type, runway FROM movements
),
hrs AS (SELECT h, SUM(kind = 'ARR') AS arr, SUM(kind = 'DEP') AS dep FROM m GROUP BY h),
al AS (SELECT h, json_group_object(airline, n) AS j FROM (SELECT h, airline, COUNT(*) AS n FROM m WHERE airline IS NOT NULL GROUP BY h, airline) GROUP BY h),
ty AS (SELECT h, json_group_object(type, n) AS j FROM (SELECT h, type, COUNT(*) AS n FROM m WHERE type IS NOT NULL GROUP BY h, type) GROUP BY h),
rw AS (SELECT h, json_group_object(runway, n) AS j FROM (SELECT h, runway, COUNT(*) AS n FROM m WHERE runway IS NOT NULL GROUP BY h, runway) GROUP BY h)
INSERT INTO stats_hourly_local (hour_ts, arr, dep, by_airline, by_type, by_runway, max_aircraft_seen)
SELECT hrs.h, hrs.arr, hrs.dep,
       COALESCE(al.j, '{}'), COALESCE(ty.j, '{}'), COALESCE(rw.j, '{}'),
       COALESCE((SELECT MAX(o.max_aircraft_seen) FROM stats_hourly o
                 WHERE o.hour_ts BETWEEN hrs.h - 1800 AND hrs.h + 1800), 0)
FROM hrs
LEFT JOIN al ON al.h = hrs.h
LEFT JOIN ty ON ty.h = hrs.h
LEFT JOIN rw ON rw.h = hrs.h;

-- 3. Already local-aligned rows: keep as they are (unless step 1 recounted that hour).
INSERT OR IGNORE INTO stats_hourly_local
SELECT hour_ts, arr, dep, by_airline, by_type, by_runway, max_aircraft_seen
FROM stats_hourly
WHERE (hour_ts - 1800) % 3600 = 0;

-- 2. Old UTC-aligned rows for hours with no movements.
INSERT OR IGNORE INTO stats_hourly_local
SELECT o.hour_ts - 1800,
       CASE WHEN o.hour_ts + 3600 > w.min_ts THEN 0 ELSE o.arr END,
       CASE WHEN o.hour_ts + 3600 > w.min_ts THEN 0 ELSE o.dep END,
       CASE WHEN o.hour_ts + 3600 > w.min_ts THEN '{}' ELSE o.by_airline END,
       CASE WHEN o.hour_ts + 3600 > w.min_ts THEN '{}' ELSE o.by_type END,
       CASE WHEN o.hour_ts + 3600 > w.min_ts THEN '{}' ELSE o.by_runway END,
       o.max_aircraft_seen
FROM stats_hourly o, (SELECT COALESCE(MIN(ts), 9007199254740991) AS min_ts FROM movements) w
WHERE (o.hour_ts - 1800) % 3600 <> 0;

DELETE FROM stats_hourly;
INSERT INTO stats_hourly SELECT * FROM stats_hourly_local;
DROP TABLE stats_hourly_local;
