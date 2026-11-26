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

/** Offset of `tz` from UTC at instant `ts` (seconds), e.g. -12600 for NST. */
export function tzOffsetSec(ts: number, tz: string): number {
  const parts = Object.fromEntries(fmt(tz).formatToParts(new Date(ts * 1000)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) / 1000;
  return asUtc - Math.floor(ts);
}

/** Local calendar day key "YYYY-MM-DD" in tz. */
export function localDayKey(ts: number, tz: string): string {
  const d = new Date((ts + tzOffsetSec(ts, tz)) * 1000);
  return d.toISOString().slice(0, 10);
}

/** Unix seconds of local midnight (in tz) for the day containing ts. */
export function localDayStart(ts: number, tz: string): number {
  const off = tzOffsetSec(ts, tz);
  const local = ts + off;
  const midnightLocal = local - (((local % 86400) + 86400) % 86400);
  // Re-evaluate offset at midnight (DST changes happen at 02:00 local, so this is stable).
  return midnightLocal - tzOffsetSec(midnightLocal - off, tz);
}

export const hourStart = (ts: number) => ts - (((ts % 3600) + 3600) % 3600);
export const unixNow = (d: Date) => Math.floor(d.getTime() / 1000);
