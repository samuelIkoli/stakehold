import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/server/auth";
import { donateToPool, openAllWindows, processNow, seedDemo, settleNow } from "@/lib/server/demo";

// Hidden demo control panel API. Set DEMO_KEY in .env.local to require a key.
const Body = z.object({
  action: z.enum(["seed", "open", "process", "settle", "donate", "list"]),
  key: z.string().optional(),
  challengeId: z.string().optional(),
  kind: z.enum(["photo", "duolingo"]).optional(),
  dayLen: z.number().int().min(60).max(3600).optional(),
  days: z.number().int().min(1).max(10).optional(),
  leadSecs: z.number().int().min(20).max(1800).optional(),
  sol: z.number().min(0.001).max(2).optional(),
});

export async function POST(req: Request) {
  try {
    const b = Body.parse(await req.json());
    if (process.env.DEMO_KEY && b.key !== process.env.DEMO_KEY) throw new HttpError(401, "Wrong demo key");
    switch (b.action) {
      case "seed":
        return Response.json(await seedDemo({ kind: b.kind, dayLen: b.dayLen, days: b.days, leadSecs: b.leadSecs }));
      case "open":
        return Response.json({ results: await openAllWindows(need(b.challengeId)) });
      case "process":
        await processNow(need(b.challengeId));
        return Response.json({ ok: true });
      case "settle":
        return Response.json({ tx: await settleNow(need(b.challengeId)) });
      case "donate":
        return Response.json({ tx: await donateToPool(b.sol ?? 0.1) });
      case "list": {
        const rows = await db.challenge.findMany({ where: { demo: true }, orderBy: { createdAt: "desc" }, take: 10, include: { participants: true } });
        return Response.json(rows);
      }
    }
  } catch (e) {
    return errorResponse(e);
  }
}

function need(id?: string) {
  if (!id) throw new HttpError(400, "challengeId required");
  return id;
}
