import { errorResponse } from "@/lib/server/auth";
import { settleChallenge } from "@/lib/server/game";

/** Permissionless settle via the server's crank key (anyone can also settle from their own wallet). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const tx = await settleChallenge(id);
    return Response.json({ tx });
  } catch (e) {
    return errorResponse(e);
  }
}
