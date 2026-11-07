// End-to-end test of photo + gym proof paths against a local validator, with
// AI_MOCK=1 on the server (code checks — windows, GPS, time gap — are real).
//   APP_URL=http://localhost:3100 NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 npx tsx scripts/e2e-photo-gym.ts
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

async function photo(challengeId: string, kind: string, lat?: number, lng?: number) {
  const fd = new FormData();
  fd.append("challengeId", challengeId);
  fd.append("kind", kind);
  fd.append("image", new Blob([JPEG], { type: "image/jpeg" }), "p.jpg");
  if (lat != null) {
    fd.append("lat", String(lat));
    fd.append("lng", String(lng));
    fd.append("accuracy", "12");
  }
  return api("/api/proof/photo", { method: "POST", body: fd }, true);
}

async function create(conn: ReturnType<typeof makeConnection>, wallet: Parameters<typeof createChallengeTx>[1], rules: ChallengeRules, dayLen: number, windowSecs: number) {
  const hash = crypto.createHash("sha256").update(canonicalJson(rules)).digest("hex");
  const start = nextDemoMidnight(now(), dayLen, 20);
  const { sig, challenge } = await createChallengeTx(conn, wallet, {
    mode: 0, demo: true, stakeLamports: 0.05 * LAMPORTS_PER_SOL, startTs: start, dayLen, numDays: 1, graceSecs: 15, windowSecs, maxPlayers: 4,
    configHashHex: hash, failDest: 0, charityIndex: 0, joinOffsetMin: 0,
  });
  await api("/api/challenges", { method: "POST", body: JSON.stringify({ pubkey: challenge, rules, tx: sig }) });
  await api(`/api/challenges/${challenge}/join`, { method: "POST", body: JSON.stringify({ tz: "Africa/Lagos", tx: sig }) });
  return { challenge, start };
}

async function main() {
  const conn = makeConnection();
  const user = Keypair.generate();
  await conn.confirmTransaction(await conn.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL), "confirmed");
  const wallet = keypairWallet(user) as unknown as Parameters<typeof createChallengeTx>[1];
  const pk = user.publicKey.toBase58();
  const { message, issuedAt } = await api(`/api/auth?wallet=${pk}`);
  const sig = ed25519.sign(new TextEncoder().encode(message), user.secretKey.slice(0, 32));
  await api("/api/auth", { method: "POST", body: JSON.stringify({ wallet: pk, issuedAt, signature: bs58.encode(sig) }) });

  // ---------------- gym ----------------
  const gymAt = { lat: 6.5244, lng: 3.3792 };
  const gymRules: ChallengeRules = {
    v: 1, title: "E2E gym", habit: "Gym", proofType: "gym", rule: "In a gym.", strength: "good", windowStartHour: 0, windowEndHour: 24, windowMinutes: 10,
    minGapSecs: 20, gym: { ...gymAt, radiusM: 100, label: "Test Gym" },
  };
  const gym = await create(conn, wallet, gymRules, 120, 60);
  console.log("✓ gym challenge", gym.challenge);
  await wait(gym.start - now() + 2);
  const w0 = await api("/api/window", { method: "POST", body: JSON.stringify({ challengeId: gym.challenge, index: 0 }) });
  console.log("✓ check-in window", w0.pose, "slot", w0.slot);
  const far = await photo(gym.challenge, "gym_in", gymAt.lat + 0.01, gymAt.lng);
  console.log(far.verdict === "fail" ? "✓" : "✗", "far away rejected:", far.reason, far.tx ? "(onchain)" : "");
  const near = await photo(gym.challenge, "gym_in", gymAt.lat + 0.0003, gymAt.lng);
  console.log(near.verdict === "pass" ? "✓" : "✗", "check-in accepted:", near.reason);
  const early = await api("/api/window", { method: "POST", body: JSON.stringify({ challengeId: gym.challenge, index: 1 }) }, true);
  console.log(!early.ok ? "✓" : "✗", "early check-out blocked:", early.error);
  await wait(21);
  const w1 = await api("/api/window", { method: "POST", body: JSON.stringify({ challengeId: gym.challenge, index: 1 }) });
  console.log("✓ check-out window, new pose", w1.pose, JSON.stringify(w1.pose) !== JSON.stringify(w0.pose) ? "(differs ✓)" : "(SAME ✗)");
  const out = await photo(gym.challenge, "gym_out", gymAt.lat, gymAt.lng + 0.0002);
  console.log(out.verdict === "pass" && out.tx ? "✓" : "✗", "check-out pass onchain:", out.tx?.slice(0, 12), "gap", out.checks?.gap_secs);

  // ---------------- photo ----------------
  const photoRules: ChallengeRules = { v: 1, title: "E2E photo", habit: "Water", proofType: "photo", rule: "Holding water.", strength: "good", windowStartHour: 0, windowEndHour: 24, windowMinutes: 1 };
  const ph = await create(conn, wallet, photoRules, 60, 40);
  console.log("✓ photo challenge", ph.challenge);
  await wait(ph.start - now() + 1);
  let win: { pose: number[] | null; expiresAt: number } | undefined;
  for (let i = 0; i < 15 && !win; i++) {
    const v = await api(`/api/challenges/${ph.challenge}`);
    win = v.windows.find((w: { participantId: string }) => v.participants.find((p: { id: string; wallet: string }) => p.id === w.participantId && p.wallet === pk));
    if (!win) await wait(2);
  }
  console.log(win ? "✓" : "✗", "surprise window opened by scheduler", win?.pose);
  const r = await photo(ph.challenge, "photo");
  console.log(r.verdict === "pass" && r.tx ? "✓" : "✗", "photo proof pass onchain", r.tx?.slice(0, 12), "proofHash", r.proofHash?.slice(0, 12));
  const again = await photo(ph.challenge, "photo");
  console.log(!again.ok ? "✓" : "✗", "second submission after pass blocked:", again.error);
  process.exit(0);
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
