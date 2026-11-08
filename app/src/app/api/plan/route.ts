import { z } from "zod";
import { aiConfigured, normalizePlan, proposePlan } from "@/lib/ai";
import { errorResponse, HttpError } from "@/lib/server/auth";

const Body = z.object({ habit: z.string().min(3).max(500) });

/** Fallback when the AI is unavailable: simple keyword rules, clearly labelled. */
function heuristicPlan(habit: string) {
  const h = habit.toLowerCase();
  // Respect numbers the creator gave, even without the AI.
  const xp = Number(h.match(/(\d+)\s*xp/)?.[1]) || 30;
  const words: Record<string, number> = { once: 1, twice: 2, thrice: 3, two: 2, three: 3, four: 4, five: 5 };
  const timesM = h.match(/\b(once|twice|thrice)\b|\b(\d|two|three|four|five)\s*(times|meals|photos)\b/);
  const perDay = Math.min(5, timesM ? words[timesM[1] ?? ""] ?? (Number(timesM[2]) || words[timesM[2]] || 1) : 1);
  const daysM = h.match(/(\d+)\s*(day|week)s?/);
  const numDays = /\b(today|tonight)\b/.test(h) ? 1 : daysM ? Math.min(60, Number(daysM[1]) * (daysM[2] === "week" ? 7 : 1)) : null;
  const hourM = h.match(/(?:next|within|in)\s+(?:the\s+next\s+)?(\d+|an|one|a)?\s*(hour|minute|min)s?/);
  const roundMinutes = hourM ? (Number(hourM[1]) || 1) * (hourM[2] === "hour" ? 60 : 1) : null;
  const common = { numDays, roundMinutes };
  if (/duolingo|language|spanish|french|learn .*(german|japanese|yoruba)/.test(h))
    return normalizePlan({ title: xp !== 30 ? `+${xp} XP on Duolingo` : "Duolingo every day", proofType: "duolingo", rule: `Earn at least ${xp} XP each day, counted from your starting XP.`, strengthReason: "XP is read from your public Duolingo profile; the account is linked by username (verification optional).", minXp: xp, ...common, tips: ["Make your profile public", "Do your lesson before midnight"] });
  if (/github|commit|push code|ship code|open source|coding/.test(h)) {
    const commits = Number(h.match(/(\d+)\s*commits?/)?.[1]) || 1;
    return normalizePlan({ title: commits > 1 ? `${commits} commits a day` : "Commit every day", proofType: "github", rule: `Push at least ${commits} commit${commits > 1 ? "s" : ""} to public GitHub repos each day.`, strengthReason: "Counted from your public GitHub activity, timed by when GitHub received the push.", minCommits: commits, ...common, tips: ["Only public repos count", "Push before the day ends — GitHub's feed can lag a few minutes"] });
  }
  if (/gym|workout|lift|weights/.test(h))
    return normalizePlan({ title: "Gym streak", proofType: "gym", rule: "Check in and check out at the gym, at least 45 minutes apart, showing the pose.", strengthReason: "Two live photos with random poses, GPS and a time gap.", minGapMinutes: 45, windowStartHour: 5, windowEndHour: 23, tips: ["Allow location access", "Check out after your workout"] });
  if (/^no |quit|stop|avoid|without/.test(h))
    return normalizePlan({ title: "Honor challenge", proofType: "honor", rule: "Self-report each day.", strengthReason: "Not doing something can't be photographed, so this is honor system.", reframe: "Try a positive version you can prove, e.g. a photo of every meal.", tips: ["Pick a provable reframe for a stronger challenge"] });
  const one = habit.replace(/\b(once|twice|thrice|today|tonight|every ?day|daily)\b|\b(\d|two|three|four|five)\s*times\b|(for|in|within)\s+(the\s+next\s+)?\d*\s*(an?\s+)?(hours?|minutes?|days?|weeks?)/gi, "").replace(/\s+/g, " ").trim();
  return normalizePlan({
    title: habit.slice(0, 40),
    proofType: "photo",
    rule: `One photo of the person doing this: ${one || habit}.`,
    strengthReason: perDay > 1 ? `${perDay} live photos a day, each with its own random pose.` : "A live photo with a random pose in a surprise window.",
    perDay,
    minGapMinutes: perDay > 1 ? 60 : undefined,
    ...common,
    tips: [perDay > 1 ? "Open each photo window when you're actually doing it" : "Keep your phone handy during the window hours"],
  });
}

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Describe your habit in a few words");
    if (!aiConfigured()) return Response.json({ plan: heuristicPlan(parsed.data.habit), source: "rules" });
    try {
      return Response.json({ plan: await proposePlan(parsed.data.habit), source: "ai" });
    } catch (e) {
      console.warn("[plan] AI failed, using rules:", e);
      return Response.json({ plan: heuristicPlan(parsed.data.habit), source: "rules" });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
