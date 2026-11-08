import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError, requireWallet } from "@/lib/server/auth";
import { clockOf, openWindowFor, passedDay, perDayOf, photoPassesToday } from "@/lib/server/game";
import { dayAt } from "@/lib/time";

const Body = z.object({ challengeId: z.string(), index: z.number().int().min(0).max(4).optional() });

/**
 * On-demand windows. Gym: "I'm at the gym" opens the check-in window, "Check out" (after
 * the minimum gap) opens the check-out window with a new pose. Multi-photo days: each
 * "Take photo n" opens that photo's window, at least the minimum gap after the last one.
 */
export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const body = Body.parse(await req.json());
    const ch = await db.challenge.findUnique({ where: { id: body.challengeId } });
    if (!ch) throw new HttpError(404, "Challenge not found");
    const challengeId = ch.id;
    const perDay = perDayOf(ch);
    if (ch.proofType !== "gym" && perDay === 1) throw new HttpError(400, "Windows for this challenge open by surprise — watch for the alert");
    const p = await db.participant.findFirst({ where: { challengeId, wallet } });
    if (!p || p.status !== "active") throw new HttpError(403, "You're not an active player in this challenge");
    const now = Math.floor(Date.now() / 1000);
    const day = dayAt(clockOf(ch, p), now);
    if (day < 1 || day > ch.numDays) throw new HttpError(400, "The challenge isn't running for you right now");
    if (passedDay(p, day)) throw new HttpError(400, "You've already passed today 🎉");
    let index = body.index ?? 0;
    if (ch.proofType === "photo") {
      const done = await photoPassesToday(p, day);
      if (done.length >= perDay) throw new HttpError(400, "You've already passed today 🎉");
      // Each window has its own onchain account, so a fresh (or replacement) window takes the next index.
      const windows = await db.proofWindow.findMany({ where: { participantId: p.id, day }, orderBy: { index: "desc" } });
      const latest = windows[0];
      const spent = !!latest && done.some((d) => d.windowIndex === latest.index);
      if (latest?.status === "open" && !spent && (latest.expiresAt ?? 0) > now + 15) {
        const used = await db.proof.count({ where: { participantId: p.id, day, kind: "photo", windowIndex: latest.index } });
        if (used < 2) return Response.json({ ...latest, pose: latest.pose ? JSON.parse(latest.pose) : null });
      }
      index = latest ? latest.index + 1 : 0;
      if (index > 7) throw new HttpError(400, "No photo windows left for today");
      const last = done[done.length - 1];
      if (last) {
        const ready = Math.floor(last.createdAt.getTime() / 1000) + (ch.minGapSecs ?? 3600);
        if (now < ready) throw new HttpError(400, `Photo ${done.length + 1} unlocks in ${ready - now < 120 ? `${ready - now} s` : `${Math.ceil((ready - now) / 60)} min`}`);
      }
    } else if (index === 1) {
      const gymIn = await db.proof.findFirst({ where: { participantId: p.id, day, kind: "gym_in", verdict: "pass" }, orderBy: { createdAt: "desc" } });
      if (!gymIn) throw new HttpError(400, "Check in first");
      const ready = Math.floor(gymIn.createdAt.getTime() / 1000) + (ch.minGapSecs ?? 2700);
      if (now < ready) throw new HttpError(400, `Check-out unlocks in ${ready - now < 120 ? `${ready - now} s` : `${Math.ceil((ready - now) / 60)} min`}`);
    }
    const w = await openWindowFor(ch, p, day, index);
    return Response.json({ ...w, pose: w.pose ? JSON.parse(w.pose) : null });
  } catch (e) {
    return errorResponse(e);
  }
}
