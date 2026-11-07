import { db } from "@/lib/db";
import { errorResponse, requireWallet } from "@/lib/server/auth";

export async function GET() {
  try {
    const wallet = await requireWallet();
    const [parts, link, created] = await Promise.all([
      db.participant.findMany({ where: { wallet }, include: { challenge: true }, orderBy: { createdAt: "desc" } }),
      db.duoLink.findUnique({ where: { wallet } }),
      db.challenge.count({ where: { creator: wallet } }),
    ]);
    return Response.json({
      wallet,
      duolingo: link,
      created,
      history: parts.map((p) => ({
        challengeId: p.challengeId,
        title: p.challenge.title,
        proofType: p.challenge.proofType,
        mode: p.challenge.mode,
        stakeLamports: p.challenge.stakeLamports,
        numDays: p.challenge.numDays,
        status: p.status,
        daysPassed: p.daysPassed,
        eliminatedDay: p.eliminatedDay,
        claimTx: p.claimTx,
        challengeStatus: p.challenge.status,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
