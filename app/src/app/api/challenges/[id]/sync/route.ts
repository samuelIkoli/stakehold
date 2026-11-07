import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, sessionWallet } from "@/lib/server/auth";
import { logEvent, syncChallenge } from "@/lib/server/game";

const Body = z.object({ action: z.enum(["claim", "forfeit", "settle"]).optional(), tx: z.string().optional() }).optional();

/** Called by the client after it sent a claim/forfeit/settle transaction itself. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = Body.parse(await req.json().catch(() => undefined));
    await new Promise((r) => setTimeout(r, 800));
    await syncChallenge(id);
    const wallet = await sessionWallet();
    if (body?.action && body.tx && wallet) {
      const p = await db.participant.findFirst({ where: { challengeId: id, wallet } });
      if (body.action === "claim" && p) {
        await db.participant.update({ where: { id: p.id }, data: { claimTx: body.tx } });
        await logEvent(id, "claimed", `${p.name || wallet.slice(0, 4) + "…" + wallet.slice(-4)} claimed their share 💰`, { participantId: p.id, tx: body.tx });
      }
      if (body.action === "forfeit" && p) {
        await db.participant.update({ where: { id: p.id }, data: { eliminatedReason: "Quit" } });
        await logEvent(id, "quit", `${p.name || wallet.slice(0, 4) + "…" + wallet.slice(-4)} quit 🏳️ — their stake stays in the pot`, { participantId: p.id, tx: body.tx });
      }
      if (body.action === "settle") {
        await db.challenge.update({ where: { id }, data: { settleTx: body.tx } });
        await logEvent(id, "settled", "Settled by a player 🏆", { tx: body.tx });
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
