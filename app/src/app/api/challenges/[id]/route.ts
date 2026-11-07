import { errorResponse, sessionWallet } from "@/lib/server/auth";
import { challengeView } from "@/lib/server/challenges";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const view = await challengeView(id, await sessionWallet());
    if (!view) return Response.json({ error: "Challenge not found" }, { status: 404 });
    return Response.json(view);
  } catch (e) {
    return errorResponse(e);
  }
}
