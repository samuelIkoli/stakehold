import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/server/auth";
import { registerChallenge } from "@/lib/server/challenges";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const rows = await db.challenge.findMany({
    where: mode ? { mode } : { mode: "public" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { participants: { select: { status: true, isBot: true } } },
  });
  return Response.json(
    rows.map((c) => ({
      id: c.id,
      title: c.title,
      habit: c.habit,
      proofType: c.proofType,
      strength: c.strength,
      mode: c.mode,
      stakeLamports: c.stakeLamports,
      demo: c.demo,
      refStartTs: c.refStartTs,
      dayLen: c.dayLen,
      numDays: c.numDays,
      maxPlayers: c.maxPlayers,
      status: c.status,
      players: c.participants.length,
      active: c.participants.filter((p) => p.status === "active" || p.status === "survived" || p.status === "claimed").length,
    })),
  );
}

const Rules = z.object({
  v: z.literal(1),
  title: z.string().min(2).max(80),
  habit: z.string().min(2).max(500),
  proofType: z.enum(["photo", "gym", "duolingo", "honor"]),
  rule: z.string().min(2).max(600),
  strength: z.enum(["strong", "good", "honor"]),
  windowStartHour: z.number().int().min(0).max(23),
  windowEndHour: z.number().int().min(1).max(24),
  windowMinutes: z.number().int().min(1).max(60),
  minXp: z.number().int().optional(),
  minGapSecs: z.number().int().optional(),
  perDay: z.number().int().min(2).max(5).optional(),
  gym: z.object({ lat: z.number(), lng: z.number(), radiusM: z.number(), label: z.string().optional() }).optional(),
});

const Body = z.object({ pubkey: z.string(), rules: Rules, description: z.string().max(1000).optional(), tx: z.string() });

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const ch = await registerChallenge(parsed.data);
    return Response.json({ id: ch.id });
  } catch (e) {
    return errorResponse(e);
  }
}
