// Day-boundary logic. Mirrors the Anchor program exactly: every member has their own
// `startTs` (their local midnight, or the shared demo start) and days are fixed-length
// slices after it. Offchain code must use these same boundaries so it never disagrees
// with what the program will accept.

export type DayClock = { startTs: number; dayLen: number; numDays: number };

/** 1-based day at `now` (0 before start). Can exceed numDays after the end. */
export function dayAt(c: DayClock, now: number): number {
  if (now < c.startTs) return 0;
  return Math.floor((now - c.startTs) / c.dayLen) + 1;
}

export function dayStart(c: DayClock, day: number): number {
  return c.startTs + (day - 1) * c.dayLen;
}

export function dayEnd(c: DayClock, day: number): number {
  return c.startTs + day * c.dayLen;
}

export function challengeEnd(c: DayClock): number {
  return c.startTs + c.numDays * c.dayLen;
}

/** Current day clamped to the challenge, or null if not running. */
export function activeDay(c: DayClock, now: number): number | null {
  const d = dayAt(c, now);
  return d >= 1 && d <= c.numDays ? d : null;
}

/**
 * UTC offset (minutes east of UTC) of an IANA zone at a given instant.
 * Lagos → +60, New York (EST) → -300.
 */
export function utcOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Calendar date (YYYY-MM-DD) in a zone. */
export function localDate(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** 00:00 UTC of a YYYY-MM-DD date, in Unix seconds — the challenge's reference start. */
export function utcMidnightOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 1000;
}

/** Next calendar date after `date` (YYYY-MM-DD). */
export function nextDate(date: string): string {
  const t = utcMidnightOf(date) + 86_400;
  return new Date(t * 1000).toISOString().slice(0, 10);
}

/**
 * A member's own start: local midnight of the reference date, i.e. refStart − offset.
 * The offset is measured at that midnight so DST at the start date is right.
 */
export function memberStart(refStart: number, timeZone: string): { startTs: number; offsetMin: number } {
  // Offset at (approximately) local midnight: probe at refStart, then correct once.
  let offset = utcOffsetMinutes(timeZone, new Date(refStart * 1000));
  offset = utcOffsetMinutes(timeZone, new Date((refStart - offset * 60) * 1000));
  // The program accepts 15-minute multiples only (every real zone qualifies).
  offset = Math.round(offset / 15) * 15;
  return { startTs: refStart - offset * 60, offsetMin: offset };
}

/** Next "demo midnight": the next multiple of dayLen at least `leadSecs` from now. */
/** Quick rounds start exactly the chosen lead time after creation — never later. */
export function quickStart(now: number, leadSecs: number): number {
  return now + leadSecs;
}

export function nextDemoMidnight(now: number, dayLen: number, leadSecs: number): number {
  return Math.ceil((now + leadSecs) / dayLen) * dayLen;
}

/** Window open time inside a day: random between allowed local hours (real) or a fraction of the day (demo). */
export function pickWindowTime(
  c: DayClock,
  day: number,
  opts: { demo: boolean; startHour: number; endHour: number; windowSecs: number; rand?: () => number },
): number {
  const rand = opts.rand ?? Math.random;
  const s = dayStart(c, day);
  if (opts.demo) {
    // Demo: open early in the day so the story moves fast.
    return s + Math.floor(c.dayLen * (0.05 + rand() * 0.1));
  }
  // Member's startTs is their local midnight, so local hours are offsets from it.
  const lo = s + opts.startHour * 3600;
  const hi = Math.max(lo, s + opts.endHour * 3600 - opts.windowSecs);
  return lo + Math.floor(rand() * (hi - lo));
}

export function formatDuration(secs: number): string {
  secs = Math.max(0, Math.floor(secs));
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export const nowSecs = () => Math.floor(Date.now() / 1000);
