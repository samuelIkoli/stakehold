// Duolingo public profile reader (unofficial endpoint — see README limitations).
// Verified working Nov 2026: GET /2017-06-30/users?username=<name> returns
// { users: [{ id, username, totalXp, streak, bio, streakData: { currentStreak: { length, endDate } } }] }.
// Note: adding a `fields=` parameter makes it return {} — don't.

export type DuoProfile = {
  id: number;
  username: string;
  totalXp: number;
  streak: number;
  bio: string;
  streakEndDate: string | null;
};

export async function fetchDuolingo(username: string): Promise<DuoProfile | null> {
  const url = `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(username.trim())}`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Stakehold habit challenge; public profile read)", accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Duolingo responded ${res.status}`);
  const json = (await res.json()) as { users?: Record<string, unknown>[] };
  const u = json.users?.[0];
  if (!u) return null;
  const sd = u.streakData as { currentStreak?: { length?: number; endDate?: string } | null } | undefined;
  return {
    id: Number(u.id),
    username: String(u.username ?? username),
    totalXp: Number(u.totalXp ?? 0),
    streak: Number(sd?.currentStreak?.length ?? u.streak ?? 0),
    bio: String(u.bio ?? ""),
    streakEndDate: sd?.currentStreak?.endDate ?? null,
  };
}

export function makeLinkCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `STAKE-${s}`;
}

export type DuoRuleResult = {
  pass: boolean;
  xpGained: number;
  streakNow: number;
  streakBefore: number;
  reasonCode: number;
  message: string;
  benefitOfDoubt: boolean;
};

/**
 * Daily rule — both must hold: XP gained since the previous snapshot ≥ minXp AND
 * streak = previous streak + 1. If the previous boundary snapshot was missed, we
 * compare against the latest earlier snapshot and accept any streak increase
 * (benefit of the doubt).
 */
export function evaluateDuolingo(
  before: { totalXp: number; streak: number },
  now: { totalXp: number; streak: number },
  minXp: number,
  missedBoundary = false,
): DuoRuleResult {
  const xpGained = now.totalXp - before.totalXp;
  const streakOk = missedBoundary ? now.streak > before.streak : now.streak === before.streak + 1;
  const xpOk = xpGained >= minXp;
  const pass = xpOk && streakOk;
  const reasonCode = pass ? (missedBoundary ? 13 : 0) : !xpOk ? 7 : 8;
  const message = pass
    ? `+${xpGained} XP, streak ${now.streak} ✅ you're safe today`
    : !xpOk
      ? `+${xpGained} XP so far — you need at least ${minXp} XP today`
      : now.streak === before.streak
        ? `+${xpGained} XP, but your streak hasn't ticked over yet (${now.streak}). Finish a lesson that extends today's streak.`
        : `Streak went from ${before.streak} to ${now.streak} — it must go up by exactly 1 (freezes and resets don't count).`;
  return { pass, xpGained, streakNow: now.streak, streakBefore: before.streak, reasonCode, message, benefitOfDoubt: missedBoundary && pass };
}
