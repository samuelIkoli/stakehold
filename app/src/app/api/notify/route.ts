import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/server/auth";

const Body = z.object({ page: z.enum(["stake", "sponsor"]), contact: z.string().min(3).max(120) });

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Enter an email or wallet address");
    await db.notifySignup.create({ data: parsed.data });
    const count = await db.notifySignup.count({ where: { page: parsed.data.page } });
    return Response.json({ ok: true, count });
  } catch (e) {
    return errorResponse(e);
  }
}
