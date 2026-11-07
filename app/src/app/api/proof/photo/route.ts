import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ai";
import { errorResponse, HttpError, requireWallet } from "@/lib/server/auth";
import { submitPhoto } from "@/lib/server/game";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    if (!aiConfigured()) throw new HttpError(503, "The AI referee isn't configured (GEMINI_API_KEY missing)");
    const form = await req.formData();
    const challengeId = String(form.get("challengeId") ?? "");
    const kind = String(form.get("kind") ?? "photo") as "photo" | "gym_in" | "gym_out";
    if (!["photo", "gym_in", "gym_out"].includes(kind)) throw new HttpError(400, "Bad proof kind");
    const file = form.get("image");
    if (!(file instanceof File)) throw new HttpError(400, "Missing photo");
    if (file.size > 8 * 1024 * 1024) throw new HttpError(413, "Photo too large");
    const num = (k: string) => {
      const v = form.get(k);
      return v == null || v === "" ? undefined : Number(v);
    };
    const ch = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!ch) throw new HttpError(404, "Challenge not found");
    const p = await db.participant.findFirst({ where: { challengeId, wallet } });
    if (!p) throw new HttpError(403, "You're not in this challenge");
    const result = await submitPhoto({
      ch,
      p,
      kind,
      image: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type || "image/jpeg",
      lat: num("lat"),
      lng: num("lng"),
      accuracy: num("accuracy"),
    });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
