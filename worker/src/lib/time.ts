// Pure time helpers. All bucketing is in the airport's LOCAL time (America/St_Johns is UTC−3:30 / −2:30),
// so an "hour" is a local clock hour (e.g. 20:00–21:00 NST = 23:30–00:30Z), never a UTC hour.
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Offset of `tz` from UTC at instant `ts` (seconds), e.g. -12600 for NST, -9000 for NDT. */
export function tzOffsetSec(ts: number, tz: string): number {
  const t = Math.floor(ts);
  const parts = Object.fromEntries(fmt(tz).formatToParts(new Date(t * 1000)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) / 1000;
  return asUtc - t;
}

/** Local calendar day key "YYYY-MM-DD" in tz. */
export function localDayKey(ts: number, tz: string): string {
  return new Date((Math.floor(ts) + tzOffsetSec(ts, tz)) * 1000).toISOString().slice(0, 10);
}

/**
 * Unix seconds of the start of the LOCAL clock hour containing ts.
 * Offsets differ by whole hours across DST, so (ts + offset) mod 3600 is exact on transition days too;
 * in the repeated 01:xx hour on fall-back day the two local "01:00" hours are distinct instants.
 */
export function localHourStart(ts: number, tz: string): number {
  const t = Math.floor(ts);
  return t - mod(t + tzOffsetSec(t, tz), 3600);
}

/** Unix seconds of local midnight (in tz) for the day containing ts. Correct on 23 h and 25 h days. */
export function localDayStart(ts: number, tz: string): number {
  const t = Math.floor(ts);
  const off = tzOffsetSec(t, tz);
  const midnightLocal = t + off - mod(t + off, 86400);     // local wall-clock midnight, as if UTC
  // Midnight may be on the other side of a DST change from ts (changes happen at 02:00 local),
  // so take the offset in force at midnight itself.
  return midnightLocal - tzOffsetSec(midnightLocal - off, tz);
}

export const unixNow = (d: Date) => Math.floor(d.getTime() / 1000);
