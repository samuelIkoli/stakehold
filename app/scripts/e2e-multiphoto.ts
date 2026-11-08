// End-to-end test of a multi-photo day ("eat yam twice") against a local validator,
// with AI_MOCK=1 on the server (windows, gaps and onchain recording are real).
//   APP_URL=http://localhost:3100 NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 npx tsx scripts/e2e-multiphoto.ts
import crypto from "node:crypto";
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { canonicalJson, type ChallengeRules } from "../src/lib/canonical";
import { createChallengeTx } from "../src/lib/client/tx";
import { keypairWallet, makeConnection } from "../src/lib/solana/program";
import { nextDemoMidnight } from "../src/lib/time";

const APP = process.env.APP_URL || "http://localhost:3100";
let cookie = "";
const wait = (s: number) => new Promise((r) => setTimeout(r, Math.max(0, s) * 1000));
const now = () => Math.floor(Date.now() / 1000);

async function api(path: string, init: RequestInit = {}, allowFail = false) {
  const r = await fetch(APP + path, { ...init, headers: { ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }), cookie, ...(init.headers ?? {}) } });
  const set = r.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const j = await r.json();
  if (!r.ok && !allowFail) throw new Error(`${path}: ${j.error}`);
  return { ok: r.ok, ...j };
}

// 1x1 JPEG
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");

async function photo(challengeId: string) {
  const fd = new FormData();
  fd.append("challengeId", challengeId);
  fd.append("kind", "photo");
  fd.append("image", new Blob([JPEG], { type: "image/jpeg" }), "p.jpg");
  return api("/api/proof/photo", { method: "POST", body: fd }, true);
}

const openWin = (challengeId: string, allowFail = false) => api("/api/window", { method: "POST", body: JSON.stringify({ challengeId }) }, allowFail);
const ok = (cond: unknown, msg: string) => console.log(cond ? "✓" : "✗", msg);

async function main() {
  const conn = makeConnection();
  const user = Keypair.generate();
  await conn.confirmTransaction(await conn.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL), "confirmed");
  const wallet = keypairWallet(user) as unknown as Parameters<typeof createChallengeTx>[1];
  const pk = user.publicKey.toBase58();
  const { message, issuedAt } = await api(`/api/auth?wallet=${pk}`);
  const sig = ed25519.sign(new TextEncoder().encode(message), user.secretKey.slice(0, 32));
  await api("/api/auth", { method: "POST", body: JSON.stringify({ wallet: pk, issuedAt, signature: bs58.encode(sig) }) });

  const rules: ChallengeRules = {
    v: 1, title: "Yam twice", habit: "eat yam twice today", proofType: "photo", rule: "The person is eating a plate of yam.", strength: "good",
    windowStartHour: 0, windowEndHour: 24, windowMinutes: 10, minGapSecs: 15, perDay: 2,
  };
  const hash = crypto.createHash("sha256").update(canonicalJson(rules)).digest("hex");
  const dayLen = 180;
  const start = nextDemoMidnight(now(), dayLen, 20);
  const { sig: tx, challenge } = await createChallengeTx(conn, wallet, {
    mode: 2, demo: true, stakeLamports: 0.05 * LAMPORTS_PER_SOL, startTs: start, dayLen, numDays: 1, graceSecs: 20, windowSecs: 60, maxPlayers: 1,
    configHashHex: hash, failDest: 0, charityIndex: 0, joinOffsetMin: 0,
  });
  await api("/api/challenges", { method: "POST", body: JSON.stringify({ pubkey: challenge, rules, tx }) });
  await api(`/api/challenges/${challenge}/join`, { method: "POST", body: JSON.stringify({ tz: "Africa/Lagos", tx }) });
  ok(true, `solo challenge with perDay 2 registered (rules hash matches onchain) ${challenge}`);
  await wait(start - now() + 2);

  const w0 = await openWin(challenge);
  ok(w0.index === 0 && w0.pose, `photo 1 window opened on demand, index ${w0.index}, pose ${JSON.stringify(w0.pose)}`);
  const p1 = await photo(challenge);
  ok(p1.verdict === "pass" && !p1.tx && p1.part?.n === 1, `photo 1 accepted offchain (tx: ${p1.tx ?? "none"}), part ${JSON.stringify(p1.part)}`);
  let v = await api(`/api/challenges/${challenge}`);
  ok(v.participants[0].passedBitmap === "0", "day not passed yet after photo 1");

  const early = await openWin(challenge, true);
  ok(!early.ok, `photo 2 blocked before the gap: ${early.error}`);
  await wait(16);
  const w1 = await openWin(challenge);
  ok(w1.index === 1, `photo 2 window opened, index ${w1.index}, pose ${JSON.stringify(w1.pose)}`);
  const p2 = await photo(challenge);
  ok(p2.verdict === "pass" && p2.tx && p2.part?.dayDone, `photo 2 passed ONCHAIN ${p2.tx?.slice(0, 12)} part ${JSON.stringify(p2.part)}`);
  v = await api(`/api/challenges/${challenge}`);
  ok(v.participants[0].passedBitmap === "1", `day 1 passed (bitmap ${v.participants[0].passedBitmap})`);
  const again = await openWin(challenge, true);
  ok(!again.ok, `no third window: ${again.error}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
