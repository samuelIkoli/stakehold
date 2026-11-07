import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError, requireWallet } from "@/lib/server/auth";
import { checkDuolingo } from "@/lib/server/game";

const Body = z.object({ challengeId: z.string() });

/** "I'm done for today" — reads the public profile now and records a pass if the rule holds. */
export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const { challengeId } = Body.parse(await req.json());
    const ch = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!ch || ch.proofType !== "duolingo") throw new HttpError(404, "Duolingo challenge not found");
    const p = await db.participant.findFirst({ where: { challengeId, wallet } });
    if (!p) throw new HttpError(403, "You're not in this challenge");
    return Response.json(await checkDuolingo(ch, p, { source: "manual" }));
  } catch (e) {
    return errorResponse(e);
  }
}
