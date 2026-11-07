import { aiConfigured, readDuolingoUsername } from "@/lib/ai";
import { errorResponse, HttpError, requireWallet } from "@/lib/server/auth";

/** Pre-fill helper only: screenshots are never accepted as proof. */
export async function POST(req: Request) {
  try {
    await requireWallet();
    if (!aiConfigured()) throw new HttpError(503, "AI not configured");
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) throw new HttpError(400, "Missing image");
    const r = await readDuolingoUsername({ mimeType: file.type || "image/png", base64: Buffer.from(await file.arrayBuffer()).toString("base64") });
    return Response.json(r);
  } catch (e) {
    return errorResponse(e);
  }
}
