// End-to-end test of exact quick-round starts, closed joins after start, and early
// settlement (last one standing / solo out), against a local validator.
//   APP_URL=http://localhost:3100 NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 npx tsx scripts/e2e-early-settle.ts
import crypto from "node:crypto";
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { canonicalJson, type ChallengeRules } from "../src/lib/canonical";
import { createChallengeTx, forfeitTx, joinTx } from "../src/lib/client/tx";
import { keypairWallet, makeConnection } from "../src/lib/solana/program";
import { quickStart } from "../src/lib/time";
import { poolPda } from "../src/lib/solana/pdas";

const APP = process.env.APP_URL || "http://localhost:3100";
const wait = (s: number) => new Promise((r) => setTimeout(r, Math.max(0, s) * 1000));
const now = () => Math.floor(Date.now() / 1000);
const ok = (cond: unknown, msg: string) => console.log(cond ? "✓" : "✗", msg);
const conn = makeConnection();

async function player() {
  const kp = Keypair.generate();
  await conn.confirmTransaction(await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL), "confirmed");
  let cookie = "";
  const api = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(APP + path, { ...init, headers: { "content-type": "application/json", cookie } });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { ok: r.ok, ...(await r.json()) };
  };
  const pk = kp.publicKey.toBase58();
  const { message, issuedAt } = await api(`/api/auth?wallet=${pk}`);
  await api("/api/auth", { method: "POST", body: JSON.stringify({ wallet: pk, issuedAt, signature: bs58.encode(ed25519.sign(new TextEncoder().encode(message), kp.secretKey.slice(0, 32))) }) });
  return { kp, wallet: keypairWallet(kp) as unknown as Parameters<typeof createChallengeTx>[1], api };
}

const rules = (title: string): ChallengeRules => ({ v: 1, title, habit: title, proofType: "honor", rule: "Self-report.", strength: "honor", windowStartHour: 0, windowEndHour: 24, windowMinutes: 10 });

async function create(p: Awaited<ReturnType<typeof player>>, mode: 0 | 1 | 2, title: string) {
  const r = rules(title);
  const hash = crypto.createHash("sha256").update(canonicalJson(r)).digest("hex");
  const before = now();
  const start = quickStart(before, 25);
  const { sig, challenge } = await createChallengeTx(conn, p.wallet, {
    mode, demo: true, stakeLamports: 0.05 * LAMPORTS_PER_SOL, startTs: start, dayLen: 600, numDays: 3, graceSecs: 30, windowSecs: 60, maxPlayers: mode === 2 ? 1 : 4,
    configHashHex: hash, failDest: 0, charityIndex: 0, joinOffsetMin: 0,
  });
  await p.api("/api/challenges", { method: "POST", body: JSON.stringify({ pubkey: challenge, rules: r, tx: sig }) });
  await p.api(`/api/challenges/${challenge}/join`, { method: "POST", body: JSON.stringify({ tz: "Africa/Lagos", tx: sig }) });
  ok(start - before === 25, `${title}: starts exactly ${start - before}s after creation (chosen lead 25s)`);
  return { challenge, start };
}

async function settledWithin(api: Awaited<ReturnType<typeof player>>["api"], challenge: string, secs: number) {
  for (let i = 0; i < secs / 3; i++) {
    const v = await api(`/api/challenges/${challenge}`);
    if (v.challenge?.status === "settled") return v;
    await wait(3);
  }
  return null;
}

async function main() {
  // Group: two players, one quits → the other wins right away.
  const a = await player();
  const b = await player();
  const g = await create(a, 0, "Early group");
  const jsig = await joinTx(conn, b.wallet, g.challenge, 60);
  await b.api(`/api/challenges/${g.challenge}/join`, { method: "POST", body: JSON.stringify({ tz: "Africa/Lagos", tx: jsig }) });
  await wait(g.start - now() + 2);
  const late = await player();
  let lateErr = "";
  try {
    await joinTx(conn, late.wallet, g.challenge, -720);
  } catch (e) {
    lateErr = String(e).slice(0, 80);
  }
  ok(lateErr, `late join (claiming UTC-12) rejected after start: ${lateErr}`);
  const poolBefore = await conn.getBalance(poolPda());
  await forfeitTx(conn, b.wallet, g.challenge);
  const v = await settledWithin(a.api, g.challenge, 45);
  ok(v, `group settled early once only one player was left (instead of waiting ~30 min)`);
  const winner = v?.participants.find((p: { wallet: string }) => p.wallet === a.kp.publicKey.toBase58());
  ok(winner?.status === "survived" || winner?.status === "claimed", `last one standing survived (status ${winner?.status}), share ${(v?.settlement?.share ?? 0) / 1e9} SOL`);

  // Solo: player quits → stake goes to the pool right away.
  const s = await player();
  const solo = await create(s, 2, "Early solo");
  await wait(solo.start - now() + 2);
  await forfeitTx(conn, s.wallet, solo.challenge);
  const vs = await settledWithin(s.api, solo.challenge, 45);
  ok(vs, "solo settled early once the player was out");
  const poolAfter = await conn.getBalance(poolPda());
  ok(poolAfter - poolBefore >= 0.05 * LAMPORTS_PER_SOL, `pool grew by ${((poolAfter - poolBefore) / 1e9).toFixed(3)} SOL (solo stake)`);
  process.exit(0);
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
