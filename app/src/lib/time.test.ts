import { describe, expect, it } from "vitest";
import {
  activeDay,
  dayAt,
  dayEnd,
  dayStart,
  memberStart,
  nextDate,
  nextDemoMidnight,
  pickWindowTime,
  utcMidnightOf,
  utcOffsetMinutes,
} from "./time";

describe("day boundaries", () => {
  const c = { startTs: 1_000_000, dayLen: 86_400, numDays: 7 };

  it("is day 0 before start and day 1 exactly at start", () => {
    expect(dayAt(c, c.startTs - 1)).toBe(0);
    expect(dayAt(c, c.startTs)).toBe(1);
  });

  it("rolls over exactly at each boundary", () => {
    expect(dayAt(c, dayEnd(c, 1) - 1)).toBe(1);
    expect(dayAt(c, dayEnd(c, 1))).toBe(2);
    expect(dayStart(c, 2)).toBe(dayEnd(c, 1));
  });

  it("activeDay is null outside the challenge", () => {
    expect(activeDay(c, c.startTs - 5)).toBeNull();
    expect(activeDay(c, dayEnd(c, 7) - 1)).toBe(7);
    expect(activeDay(c, dayEnd(c, 7))).toBeNull();
  });
});

describe("time zones", () => {
  it("computes offsets for fixed and DST zones", () => {
    expect(utcOffsetMinutes("Africa/Lagos", new Date("2026-11-08T12:00:00Z"))).toBe(60);
    expect(utcOffsetMinutes("America/New_York", new Date("2026-11-08T12:00:00Z"))).toBe(-300);
    expect(utcOffsetMinutes("America/New_York", new Date("2026-07-01T12:00:00Z"))).toBe(-240);
    expect(utcOffsetMinutes("Asia/Kolkata", new Date("2026-11-08T12:00:00Z"))).toBe(330);
  });

  it("member start is their own local midnight of the reference date", () => {
    const ref = utcMidnightOf("2026-11-09");
    const lagos = memberStart(ref, "Africa/Lagos");
    expect(lagos.offsetMin).toBe(60);
    expect(new Date(lagos.startTs * 1000).toISOString()).toBe("2026-11-08T23:00:00.000Z");
    const ny = memberStart(ref, "America/New_York");
    expect(new Date(ny.startTs * 1000).toISOString()).toBe("2026-11-09T05:00:00.000Z");
  });

  it("uses the offset in force at midnight across a DST change", () => {
    // US DST ends 1 Nov 2026; midnight on 1 Nov is still EDT (-240).
    const ref = utcMidnightOf("2026-11-01");
    expect(memberStart(ref, "America/New_York").offsetMin).toBe(-240);
    expect(memberStart(utcMidnightOf("2026-11-02"), "America/New_York").offsetMin).toBe(-300);
  });

  it("nextDate handles month ends", () => {
    expect(nextDate("2026-11-30")).toBe("2026-12-01");
    expect(nextDate("2026-12-31")).toBe("2027-01-01");
  });
});

describe("demo clock and windows", () => {
  it("next demo midnight is a multiple of the day length after the lead", () => {
    expect(nextDemoMidnight(1000, 120, 30)).toBe(1080);
    expect(nextDemoMidnight(1050, 120, 30)).toBe(1080);
    expect(nextDemoMidnight(1051, 120, 30)).toBe(1200);
  });

  it("window time stays within allowed local hours", () => {
    const c = { startTs: 1_000_000, dayLen: 86_400, numDays: 3 };
    for (const r of [0, 0.5, 0.999]) {
      const t = pickWindowTime(c, 2, { demo: false, startHour: 7, endHour: 21, windowSecs: 600, rand: () => r });
      expect(t).toBeGreaterThanOrEqual(dayStart(c, 2) + 7 * 3600);
      expect(t + 600).toBeLessThanOrEqual(dayStart(c, 2) + 21 * 3600);
    }
  });
});
