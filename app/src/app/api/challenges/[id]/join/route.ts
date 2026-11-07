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
    let duolingoUsername: string | null = null;
    if (ch.proofType === "duolingo") {
      const link = await db.duoLink.findUnique({ where: { wallet } });
      if (!link?.verified) throw new HttpError(400, "Link and verify your Duolingo account first");
      duolingoUsername = link.username;
    }
    const p = await registerJoin({ challengeId: id, wallet, tz: parsed.data.tz, tx: parsed.data.tx, name: parsed.data.name, duolingoUsername });
    return Response.json({ id: p.id });
  } catch (e) {
    return errorResponse(e);
  }
}
