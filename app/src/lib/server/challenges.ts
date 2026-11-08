import { PublicKey } from "@solana/web3.js";
import { db } from "../db";
import { canonicalJson, type ChallengeRules } from "../canonical";
import { MODE_NAME } from "../solana/constants";
import { bytesToHex } from "../pose";
import * as chain from "./chain";
import { HttpError } from "./auth";
import { sha256 } from "./storage";
import { logEvent, syncChallenge } from "./game";

export type RegisterInput = {
  pubkey: string;
  rules: ChallengeRules;
  description?: string;
  tx: string;
};

/** Store offchain metadata for a challenge created onchain; the rules must hash to config_hash. */
export async function registerChallenge(input: RegisterInput) {
  const key = new PublicKey(input.pubkey);
  let onchain = await chain.fetchChallenge(key);
  for (let i = 0; !onchain && i < 5; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    onchain = await chain.fetchChallenge(key);
  }
  if (!onchain) throw new HttpError(404, "Challenge not found onchain (yet)");
  const planHash = sha256(canonicalJson(input.rules)).toString("hex");
  if (planHash !== bytesToHex(onchain.configHash)) throw new HttpError(400, "Rules do not match the onchain config hash");
  const r = input.rules;
  const existing = await db.challenge.findUnique({ where: { id: input.pubkey } });
  if (existing) return existing;
  const ch = await db.challenge.create({
    data: {
      id: input.pubkey,
      onchainId: onchain.id.toString(),
      creator: onchain.creator.toBase58(),
      title: r.title,
      habit: r.habit,
      description: input.description ?? "",
      proofType: r.proofType,
      plan: JSON.stringify(r),
      planHash,
      strength: r.strength,
      mode: MODE_NAME[onchain.mode],
      stakeLamports: onchain.stakeLamports.toNumber(),
      demo: onchain.demo,
      refStartTs: onchain.startTs.toNumber(),
      dayLen: onchain.dayLen.toNumber(),
      numDays: onchain.numDays,
      graceSecs: onchain.graceSecs.toNumber(),
      windowSecs: onchain.windowSecs,
      windowStartHr: r.windowStartHour,
      windowEndHr: r.windowEndHour,
      maxPlayers: onchain.maxPlayers,
      failDest: onchain.failDest === 1 ? "charity" : "pool",
      charity: onchain.failDest === 1 ? onchain.charity.toBase58() : null,
      gymLat: r.gym?.lat,
      gymLng: r.gym?.lng,
      gymRadiusM: r.gym?.radiusM,
      gymLabel: r.gym?.label,
      minGapSecs: r.minGapSecs,
      minXp: r.minXp,
      createTx: input.tx,
    },
  });
  await logEvent(ch.id, "created", `Challenge created with a ${(ch.stakeLamports / 1e9).toFixed(3)} SOL stake`, { tx: input.tx });
  return ch;
}

export async function registerJoin(input: {
  challengeId: string;
  wallet: string;
  tz: string;
  tx: string;
  name?: string;
  duolingoUsername?: string | null;
  githubUsername?: string | null;
  isBot?: boolean;
  botScript?: string;
}) {
  const challenge = new PublicKey(input.challengeId);
  const pda = chain.participantPda(challenge, new PublicKey(input.wallet));
  let acc = await chain.readProgram().account.participant.fetchNullable(pda);
  for (let i = 0; !acc && i < 5; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    acc = await chain.readProgram().account.participant.fetchNullable(pda);
  }
  if (!acc) throw new HttpError(404, "Join not found onchain (yet)");
  const data = {
    tz: input.tz,
    utcOffsetMin: acc.utcOffsetMin,
    startTs: acc.startTs.toNumber(),
    joinTx: input.tx,
    name: input.name,
    duolingoUsername: input.duolingoUsername ?? null,
    ...(input.githubUsername ? { githubUsername: input.githubUsername } : {}),
    isBot: !!input.isBot,
    botScript: input.botScript,
  };
  const p = await db.participant.upsert({
    where: { id: pda.toBase58() },
    create: { id: pda.toBase58(), challengeId: input.challengeId, wallet: input.wallet, ...data },
    update: data,
  });
  await logEvent(input.challengeId, "joined", `${input.name || `${input.wallet.slice(0, 4)}…${input.wallet.slice(-4)}`} joined and staked`, {
    participantId: p.id,
    tx: input.tx,
  });
  return p;
}

/** Everything the challenge page needs, in one JSON payload. */
export async function challengeView(id: string, viewer?: string | null) {
  let ch = await db.challenge.findUnique({ where: { id } });
  if (!ch) return null;
  const now = Math.floor(Date.now() / 1000);
  if (now - ch.lastSync > 20) {
    await syncChallenge(id).catch(() => {});
    ch = (await db.challenge.findUnique({ where: { id } }))!;
  }
  const [participants, windows, proofs, events, vaultInfo] = await Promise.all([
    db.participant.findMany({ where: { challengeId: id }, orderBy: { createdAt: "asc" } }),
    db.proofWindow.findMany({ where: { challengeId: id, status: "open" }, orderBy: [{ day: "asc" }, { index: "asc" }] }),
    db.proof.findMany({ where: { challengeId: id }, orderBy: { createdAt: "asc" } }),
    db.event.findMany({ where: { challengeId: id }, orderBy: { createdAt: "desc" }, take: 60 }),
    chain.connection().getAccountInfo(chain.vaultPda(new PublicKey(id))).catch(() => null),
  ]);
  const onchain = ch.status === "settled" ? await chain.fetchChallenge(new PublicKey(id)).catch(() => null) : null;
  const verifiedDuo =
    ch.proofType === "duolingo"
      ? new Set((await db.duoLink.findMany({ where: { wallet: { in: participants.map((p) => p.wallet) }, verified: true } })).map((l) => `${l.wallet}:${l.username}`))
      : new Set<string>();
  return {
    challenge: { ...ch, plan: JSON.parse(ch.plan) },
    settlement: onchain
      ? {
          survivors: onchain.survivorCount,
          share: onchain.shareLamports.toNumber(),
          bonus: onchain.bonusLamports.toNumber(),
          pot: onchain.potLamports.toNumber(),
          claimed: onchain.claimedCount,
        }
      : null,
    vault: { address: chain.vaultPda(new PublicKey(id)).toBase58(), lamports: vaultInfo?.lamports ?? 0 },
    participants: participants.map((p) => ({
      ...p,
      botScript: undefined,
      duolingoVerified: !!p.duolingoUsername && verifiedDuo.has(`${p.wallet}:${p.duolingoUsername}`),
      proofs: proofs
        .filter((x) => x.participantId === p.id)
        .map((x) => ({ ...x, files: undefined, checks: JSON.parse(x.checks) })),
    })),
    windows: windows.map((w) => ({ ...w, pose: w.pose ? JSON.parse(w.pose) : null })),
    events,
    viewer: viewer ?? null,
    now,
  };
}
