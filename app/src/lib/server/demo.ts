// Demo mode: seed a short-day challenge with scripted bots so the whole story runs in minutes.
import BN from "bn.js";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { db } from "../db";
import { canonicalJson, type ChallengeRules } from "../canonical";
import { nextDemoMidnight } from "../time";
import * as chain from "./chain";
import { BOT_NAMES, loadBots } from "./bots";
import { registerChallenge, registerJoin } from "./challenges";
import { sha256 } from "./storage";
import { openWindowFor, settleChallenge, tickChallenge } from "./game";

export type SeedOptions = {
  kind?: "photo" | "duolingo";
  dayLen?: number;
  days?: number;
  leadSecs?: number;
  stakeSol?: number;
  bots?: number;
};

async function fundBots(min = 0.15 * LAMPORTS_PER_SOL, target = 0.3 * LAMPORTS_PER_SOL, count = 4) {
  const conn = chain.connection();
  const crank = chain.crankKeypair();
  const bots = loadBots(count);
  const balances = await Promise.all(bots.map((b) => conn.getBalance(b.publicKey)));
  const tx = new Transaction();
  bots.forEach((b, i) => {
    if (balances[i] < min) tx.add(SystemProgram.transfer({ fromPubkey: crank.publicKey, toPubkey: b.publicKey, lamports: target - balances[i] }));
  });
  if (tx.instructions.length) {
    const sig = await conn.sendTransaction(tx, [crank]);
    await conn.confirmTransaction(sig, "confirmed");
  }
  return bots;
}

export async function seedDemo(opts: SeedOptions = {}) {
  const kind = opts.kind ?? "photo";
  const dayLen = opts.dayLen ?? 120;
  const days = opts.days ?? (kind === "duolingo" ? 1 : 2);
  const leadSecs = opts.leadSecs ?? 75;
  const stake = Math.round((opts.stakeSol ?? 0.05) * LAMPORTS_PER_SOL);
  const botCount = kind === "duolingo" ? 0 : Math.min(opts.bots ?? 4, BOT_NAMES.length);

  const rules: ChallengeRules =
    kind === "photo"
      ? {
          v: 1,
          title: "Hydration Survivor (demo)",
          habit: "Drink a glass of water every day",
          proofType: "photo",
          rule: "The person is holding a glass, cup or bottle of water (or drinking from it) in the photo.",
          strength: "good",
          windowStartHour: 0,
          windowEndHour: 24,
          windowMinutes: Math.round(Math.min(600, dayLen * 0.65) / 60),
        }
      : {
          v: 1,
          title: "Duolingo Daily (demo)",
          habit: "Do at least one Duolingo lesson every day",
          proofType: "duolingo",
          rule: "Gain at least 10 XP since the last snapshot AND extend the streak by exactly 1.",
          strength: "strong",
          windowStartHour: 0,
          windowEndHour: 24,
          windowMinutes: 10,
          minXp: 10,
        };
  // Photo rule tweak: accept any pose-proof photo for a generic demo if DEMO_RULE is set.
  if (kind === "photo" && process.env.DEMO_PHOTO_RULE) rules.rule = process.env.DEMO_PHOTO_RULE;

  const program = chain.crankProgram();
  const crank = chain.crankKeypair();
  const id = new BN(Date.now());
  const now = Math.floor(Date.now() / 1000);
  const startTs = nextDemoMidnight(now, dayLen, leadSecs);
  const challenge = chain.challengePda(crank.publicKey, id);
  const configHash = sha256(canonicalJson(rules));
  const createSig = await program.methods
    .createChallenge({
      id,
      mode: 1,
      demo: true,
      stakeLamports: new BN(stake),
      startTs: new BN(startTs),
      dayLen: new BN(dayLen),
      numDays: days,
      graceSecs: new BN(Math.max(15, Math.round(dayLen / 6))),
      windowSecs: Math.round(Math.min(600, dayLen * 0.65)),
      maxPlayers: 8,
      configHash: Array.from(configHash),
      failDest: 0,
      charityIndex: 0,
    })
    .accountsPartial({
      creator: crank.publicKey,
      config: chain.configPda(),
      challenge,
      vault: chain.vaultPda(challenge),
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  await registerChallenge({
    pubkey: challenge.toBase58(),
    rules,
    description:
      kind === "photo"
        ? "Live demo: 1 day = " + dayLen + " s. Four scripted bots play along — two survive, one gets the pose wrong on day 2, one quits."
        : "Live demo of Duolingo proof: baseline at start, then '+XP, streak +1' within the day.",
    tx: createSig,
  });

  if (botCount > 0) {
    const bots = await fundBots(0.15 * LAMPORTS_PER_SOL, 0.3 * LAMPORTS_PER_SOL, botCount);
    const scripts = [
      { name: "Ada 🤖", days: {} },
      { name: "Kofi 🤖", days: {} },
      { name: "Mei 🤖", days: { "2": "wrong_pose" } },
      { name: "Tunde 🤖", quitDay: 1 },
      { name: "Zara 🤖", days: {} },
    ];
    await Promise.all(
      bots.map(async (b, i) => {
        const sig = await chain.botJoin(b, challenge);
        await registerJoin({
          challengeId: challenge.toBase58(),
          wallet: b.publicKey.toBase58(),
          tz: "Africa/Lagos",
          tx: sig,
          name: scripts[i].name,
          isBot: true,
          botScript: JSON.stringify(scripts[i]),
        });
      }),
    );
  }
  return { challenge: challenge.toBase58(), startTs, dayLen, days, tx: createSig };
}

/** Demo control: open today's window for every active member right now. */
export async function openAllWindows(challengeId: string) {
  const ch = await db.challenge.findUnique({ where: { id: challengeId }, include: { participants: true } });
  if (!ch) throw new Error("Unknown challenge");
  const now = Math.floor(Date.now() / 1000);
  const results: string[] = [];
  for (const p of ch.participants.filter((x) => x.status === "active")) {
    const day = Math.floor((now - p.startTs) / ch.dayLen) + 1;
    if (day < 1 || day > ch.numDays) continue;
    try {
      await openWindowFor(ch, p, day, 0);
      results.push(`${p.name ?? p.wallet.slice(0, 4)}: opened day ${day}`);
    } catch (e) {
      results.push(`${p.name ?? p.wallet.slice(0, 4)}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return results;
}

/** Demo control: run the scheduler for this challenge immediately (eliminations, bots, settle). */
export async function processNow(challengeId: string) {
  const ch = await db.challenge.findUnique({ where: { id: challengeId }, include: { participants: true } });
  if (!ch) throw new Error("Unknown challenge");
  await tickChallenge({ ...ch, lastSync: 0 }, Math.floor(Date.now() / 1000));
}

export async function settleNow(challengeId: string) {
  return settleChallenge(challengeId);
}

export async function donateToPool(sol: number) {
  const program = chain.crankProgram();
  return program.methods
    .donateToPool(new BN(Math.round(sol * LAMPORTS_PER_SOL)))
    .accountsPartial({ donor: chain.crankKeypair().publicKey, pool: chain.poolPda(), systemProgram: SystemProgram.programId })
    .rpc();
}

export { PublicKey };
