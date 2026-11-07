import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError, requireWallet } from "@/lib/server/auth";
import { clockOf, openWindowFor, passedDay } from "@/lib/server/game";
import { dayAt } from "@/lib/time";

const Body = z.object({ challengeId: z.string(), index: z.number().int().min(0).max(1) });

/**
 * On-demand windows for the gym template: "I'm at the gym" opens the check-in window,
 * "Check out" (after the minimum gap) opens the check-out window with a new pose.
 */
export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const { challengeId, index } = Body.parse(await req.json());
    const ch = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!ch) throw new HttpError(404, "Challenge not found");
    if (ch.proofType !== "gym") throw new HttpError(400, "Windows for this challenge open by surprise — watch for the alert");
    const p = await db.participant.findFirst({ where: { challengeId, wallet } });
    if (!p || p.status !== "active") throw new HttpError(403, "You're not an active player in this challenge");
    const now = Math.floor(Date.now() / 1000);
    const day = dayAt(clockOf(ch, p), now);
    if (day < 1 || day > ch.numDays) throw new HttpError(400, "The challenge isn't running for you right now");
    if (passedDay(p, day)) throw new HttpError(400, "You've already passed today 🎉");
    if (index === 1) {
      const gymIn = await db.proof.findFirst({ where: { participantId: p.id, day, kind: "gym_in", verdict: "pass" }, orderBy: { createdAt: "desc" } });
      if (!gymIn) throw new HttpError(400, "Check in first");
      const ready = Math.floor(gymIn.createdAt.getTime() / 1000) + (ch.minGapSecs ?? 2700);
      if (now < ready) throw new HttpError(400, `Check-out unlocks in ${Math.ceil((ready - now) / 60)} min`);
    }
    const w = await openWindowFor(ch, p, day, index);
    return Response.json({ ...w, pose: w.pose ? JSON.parse(w.pose) : null });
  } catch (e) {
    return errorResponse(e);
  }
}
