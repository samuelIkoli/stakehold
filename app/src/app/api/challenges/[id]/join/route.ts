import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError, requireWallet } from "@/lib/server/auth";
import { registerJoin } from "@/lib/server/challenges";

const Body = z.object({ tz: z.string(), tx: z.string(), name: z.string().max(40).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const wallet = await requireWallet();
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Bad request");
    const ch = await db.challenge.findUnique({ where: { id } });
    if (!ch) throw new HttpError(404, "Challenge not found");
    // The join already happened onchain, so never refuse here. Without a linked
    // Duolingo account the player is asked to link one on the challenge / proof page.
    let duolingoUsername: string | null = null;
    if (ch.proofType === "duolingo") {
      const link = await db.duoLink.findUnique({ where: { wallet } });
      const clash = link && (await db.participant.findFirst({ where: { challengeId: id, duolingoUsername: link.username, NOT: { wallet } } }));
      if (link && !clash) duolingoUsername = link.username;
    }
    const p = await registerJoin({ challengeId: id, wallet, tz: parsed.data.tz, tx: parsed.data.tx, name: parsed.data.name, duolingoUsername });
    return Response.json({ id: p.id, needsDuolingo: ch.proofType === "duolingo" && !duolingoUsername });
  } catch (e) {
    return errorResponse(e);
  }
}
