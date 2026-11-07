import { db } from "@/lib/db";
import { poolBalance } from "@/lib/server/chain";

export async function GET() {
  const [challenges, players, eliminated, survivors, proofs, staked, pool] = await Promise.all([
    db.challenge.count(),
    db.participant.count(),
    db.participant.count({ where: { status: "eliminated" } }),
    db.participant.count({ where: { status: { in: ["survived", "claimed"] } } }),
    db.proof.count({ where: { onchain: true } }),
    db.challenge.findMany({ select: { stakeLamports: true, _count: { select: { participants: true } } } }),
    poolBalance().catch(() => null),
  ]);
  const totalStaked = staked.reduce((s, c) => s + c.stakeLamports * c._count.participants, 0);
  return Response.json({ challenges, players, eliminated, survivors, proofs, totalStaked, pool });
}
