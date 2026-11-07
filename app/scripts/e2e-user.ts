// End-to-end test of the user-facing API flow with a scripted wallet (no browser):
// sign in → create solo honor challenge (+join in the same tx) → register → daily
// honor proofs → wait for settlement → claim (stake + pool bonus).
//   APP_URL=http://localhost:3100 NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 npx tsx scripts/e2e-user.ts
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { canonicalJson, type ChallengeRules } from "../src/lib/canonical";
import { createChallengeTx, claimTx } from "../src/lib/client/tx";
import { keypairWallet, makeConnection } from "../src/lib/solana/program";
import { nextDemoMidnight } from "../src/lib/time";
import crypto from "node:crypto";

const APP = process.env.APP_URL || "http://localhost:3100";
const DAY = 60;
let cookie = "";

async function api(path: string, init: RequestInit = {}) {
  const r = await fetch(APP + path, { ...init, headers: { "content-type": "application/json", cookie, ...(init.headers ?? {}) } });
  const set = r.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${j.error}`);
  return j;
}

const wait = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

async function main() {
  const conn = makeConnection();
  const user = Keypair.generate();
  await conn.confirmTransaction(await conn.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL), "confirmed");
  const wallet = keypairWallet(user) as unknown as Parameters<typeof createChallengeTx>[1];
  const pk = user.publicKey.toBase58();

  // sign in
  const { message, issuedAt } = await api(`/api/auth?wallet=${pk}`);
  const sig = ed25519.sign(new TextEncoder().encode(message), user.secretKey.slice(0, 32));
  await api("/api/auth", { method: "POST", body: JSON.stringify({ wallet: pk, issuedAt, signature: bs58.encode(sig) }) });
  console.log("✓ signed in", (await api("/api/auth")).wallet === pk);

  // create solo honor challenge, joining in the same tx
  const rules: ChallengeRules = { v: 1, title: "E2E solo honor", habit: "Stretch daily", proofType: "honor", rule: "Self-report.", strength: "honor", windowStartHour: 0, windowEndHour: 24, windowMinutes: 10 };
  const hash = crypto.createHash("sha256").update(canonicalJson(rules)).digest("hex");
  const start = nextDemoMidnight(Math.floor(Date.now() / 1000), DAY, 20);
  const { sig: createSig, challenge } = await createChallengeTx(conn, wallet, {
    mode: 2, demo: true, stakeLamports: 0.1 * LAMPORTS_PER_SOL, startTs: start, dayLen: DAY, numDays: 2, graceSecs: 15, windowSecs: 40, maxPlayers: 1,
    configHashHex: hash, failDest: 1, charityIndex: 0, joinOffsetMin: 0,
  });
  await api("/api/challenges", { method: "POST", body: JSON.stringify({ pubkey: challenge, rules, tx: createSig }) });
  await api(`/api/challenges/${challenge}/join`, { method: "POST", body: JSON.stringify({ tz: "Africa/Lagos", tx: createSig }) });
  console.log("✓ created + joined", challenge);

  for (const day of [1, 2]) {
    const at = start + (day - 1) * DAY + 3;
    await wait(Math.max(0, at - Date.now() / 1000));
    const r = await api("/api/proof/honor", { method: "POST", body: JSON.stringify({ challengeId: challenge, note: `day ${day} done` }) });
    console.log(`✓ day ${day}`, r.verdict, r.tx?.slice(0, 10));
  }

  // wait for the scheduler to settle
  await wait(Math.max(0, start + 2 * DAY + 15 + 8 - Date.now() / 1000));
  for (let i = 0; i < 20; i++) {
    const v = await api(`/api/challenges/${challenge}`);
    if (v.challenge.status === "settled") {
      console.log("✓ settled", v.settlement);
      break;
    }
    await wait(3);
  }
  const before = await conn.getBalance(user.publicKey);
  const c = await claimTx(conn, wallet, challenge);
  await api(`/api/challenges/${challenge}/sync`, { method: "POST", body: JSON.stringify({ action: "claim", tx: c }) });
  const after = await conn.getBalance(user.publicKey);
  console.log(`✓ claimed ${(after - before) / LAMPORTS_PER_SOL} SOL (stake 0.1 + bonus)`);
  const prof = await api("/api/profile");
  console.log("✓ profile history:", prof.history.map((h: { title: string; status: string }) => `${h.title}=${h.status}`).join(", "));
  process.exit(0);
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
