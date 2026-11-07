import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError, SESSION_COOKIE, sessionWallet, signInMessage, verifySignIn } from "@/lib/server/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");
  if (wallet) {
    const issuedAt = new Date().toISOString();
    return Response.json({ message: signInMessage(wallet, issuedAt), issuedAt });
  }
  return Response.json({ wallet: await sessionWallet() });
}

const Body = z.object({ wallet: z.string(), issuedAt: z.string(), signature: z.string() });

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Bad request");
    const token = await verifySignIn(parsed.data.wallet, parsed.data.issuedAt, parsed.data.signature);
    (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
    return Response.json({ wallet: parsed.data.wallet });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { token } });
  jar.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
