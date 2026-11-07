import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError, requireWallet } from "@/lib/server/auth";
import { submitHonor } from "@/lib/server/game";

const Body = z.object({ challengeId: z.string(), note: z.string().max(200).default("") });

export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const { challengeId, note } = Body.parse(await req.json());
    const ch = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!ch || ch.proofType !== "honor") throw new HttpError(404, "Honor-system challenge not found");
    const p = await db.participant.findFirst({ where: { challengeId, wallet } });
    if (!p) throw new HttpError(403, "You're not in this challenge");
    return Response.json(await submitHonor(ch, p, note));
  } catch (e) {
    return errorResponse(e);
  }
}
