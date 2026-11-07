import { z } from "zod";
import { aiConfigured, normalizePlan, proposePlan } from "@/lib/ai";
import { errorResponse, HttpError } from "@/lib/server/auth";

const Body = z.object({ habit: z.string().min(3).max(500) });

/** Fallback when the AI is unavailable: simple keyword rules, clearly labelled. */
function heuristicPlan(habit: string) {
  const h = habit.toLowerCase();
  if (/duolingo|language|spanish|french|learn .*(german|japanese|yoruba)/.test(h))
    return normalizePlan({ title: "Duolingo every day", proofType: "duolingo", rule: "Gain at least 30 XP and extend your streak by exactly 1 each day.", strengthReason: "Verified from your public Duolingo profile data.", minXp: 30, tips: ["Make your profile public", "Do your lesson before midnight"] });
  if (/gym|workout|lift|weights/.test(h))
    return normalizePlan({ title: "Gym streak", proofType: "gym", rule: "Check in and check out at the gym, at least 45 minutes apart, showing the pose.", strengthReason: "Two live photos with random poses, GPS and a time gap.", minGapMinutes: 45, windowStartHour: 5, windowEndHour: 23, tips: ["Allow location access", "Check out after your workout"] });
  if (/^no |quit|stop|avoid|without/.test(h))
    return normalizePlan({ title: "Honor challenge", proofType: "honor", rule: "Self-report each day.", strengthReason: "Not doing something can't be photographed, so this is honor system.", reframe: "Try a positive version you can prove, e.g. a photo of every meal.", tips: ["Pick a provable reframe for a stronger challenge"] });
  return normalizePlan({ title: habit.slice(0, 40), proofType: "photo", rule: `The photo clearly shows: ${habit}.`, strengthReason: "A live photo with a random pose in a surprise window.", tips: ["Keep your phone handy during the window hours"] });
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
