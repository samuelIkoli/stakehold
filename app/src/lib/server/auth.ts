// Wallet sign-in: the user signs a short message once; we keep a session cookie so
// proof submissions don't need a wallet popup each time.
import crypto from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { cookies } from "next/headers";
import { PublicKey } from "@solana/web3.js";
import { db } from "../db";

export const SESSION_COOKIE = "sh_session";

export function signInMessage(wallet: string, issuedAt: string) {
  return `Sign in to Stakehold\n\nThis proves you own this wallet. It costs nothing and sends no transaction.\n\nWallet: ${wallet}\nIssued: ${issuedAt}`;
}

export async function verifySignIn(wallet: string, issuedAt: string, signatureB58: string) {
  const age = Date.now() - Date.parse(issuedAt);
  if (!(age >= -60_000 && age < 10 * 60_000)) throw new Error("Sign-in message expired, try again");
  const msg = new TextEncoder().encode(signInMessage(wallet, issuedAt));
  const ok = ed25519.verify(bs58.decode(signatureB58), msg, new PublicKey(wallet).toBytes());
  if (!ok) throw new Error("Invalid signature");
  const token = crypto.randomBytes(24).toString("hex");
  await db.session.create({ data: { token, wallet, expiresAt: new Date(Date.now() + 7 * 86400_000) } });
  return token;
}

export async function sessionWallet(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { token } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.wallet;
}

export async function requireWallet(): Promise<string> {
  const w = await sessionWallet();
  if (!w) throw new HttpError(401, "Sign in with your wallet first");
  return w;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : String(e);
  if (status >= 500) console.error("[api]", e);
  return Response.json({ error: friendlyChainError(message) }, { status });
}

/** Turn Anchor/RPC noise into something readable. */
export function friendlyChainError(m: string) {
  const anchor = m.match(/Error Message: ([^.]+)\./);
  if (anchor) return anchor[1];
  if (/insufficient (funds|lamports)/i.test(m)) return "Not enough SOL in the paying wallet";
  if (/blockhash not found|block height exceeded/i.test(m)) return "Network was slow — please try again";
  if (/429|Too Many Requests/i.test(m)) return "Devnet RPC is rate-limiting us — try again in a few seconds";
  return m.length > 300 ? m.slice(0, 300) + "…" : m;
}
