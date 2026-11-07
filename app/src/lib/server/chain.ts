// Server-side Solana access: the AI judge key (verdicts + windows only), the crank key
// (permissionless eliminate/settle) and demo bot keys.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import BN from "bn.js";
import bs58 from "bs58";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { keypairWallet, makeConnection, makeProgram, readonlyProgram, type StakeholdProgram } from "../solana/program";
import {
  challengePda,
  checkinPda,
  configPda,
  participantPda,
  poolPda,
  SLOT_HASHES,
  vaultPda,
  windowPda,
} from "../solana/pdas";
import { bytesToHex } from "../pose";

const ROOT = path.resolve(process.cwd(), "..");

function loadKeypair(envSecret: string | undefined, envPath: string | undefined, fallback: string): Keypair {
  if (envSecret) {
    const s = envSecret.trim();
    const bytes = s.startsWith("[") ? Uint8Array.from(JSON.parse(s)) : bs58.decode(s);
    return Keypair.fromSecretKey(bytes);
  }
  const p = (envPath || fallback).replace(/^~/, os.homedir());
  const abs = path.isAbsolute(p) ? p : path.resolve(ROOT, p);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(abs, "utf8"))));
}

let _judge: Keypair | undefined;
let _crank: Keypair | undefined;
export function judgeKeypair() {
  return (_judge ??= loadKeypair(process.env.JUDGE_SECRET_KEY, process.env.JUDGE_KEYPAIR, "keys/judge.json"));
}
export function crankKeypair() {
  return (_crank ??= loadKeypair(process.env.CRANK_SECRET_KEY, process.env.CRANK_KEYPAIR, "~/.config/solana/id.json"));
}

const g = globalThis as unknown as { _conn?: ReturnType<typeof makeConnection> };
export const connection = () => (g._conn ??= makeConnection());

export const judgeProgram = () => makeProgram(connection(), keypairWallet(judgeKeypair()));
export const crankProgram = () => makeProgram(connection(), keypairWallet(crankKeypair()));
export const programFor = (kp: Keypair) => makeProgram(connection(), keypairWallet(kp));
export const readProgram = () => readonlyProgram(connection());

// ---------- reads ----------

export async function fetchChallenge(pubkey: PublicKey, program: StakeholdProgram = readProgram()) {
  return program.account.challenge.fetchNullable(pubkey);
}

export async function fetchParticipants(challenge: PublicKey, program: StakeholdProgram = readProgram()) {
  return program.account.participant.all([{ memcmp: { offset: 8, bytes: challenge.toBase58() } }]);
}

export async function fetchCheckins(challenge: PublicKey, program: StakeholdProgram = readProgram()) {
  return program.account.checkIn.all([{ memcmp: { offset: 8, bytes: challenge.toBase58() } }]);
}

export async function fetchWindows(challenge: PublicKey, program: StakeholdProgram = readProgram()) {
  return program.account.window.all([{ memcmp: { offset: 8, bytes: challenge.toBase58() } }]);
}

export async function fetchConfig(program: StakeholdProgram = readProgram()) {
  return program.account.config.fetchNullable(configPda());
}

export async function poolBalance() {
  const conn = connection();
  const info = await conn.getAccountInfo(poolPda());
  if (!info) return { lamports: 0, totalIn: 0, totalOut: 0, bonusesPaid: 0 };
  const rent = await conn.getMinimumBalanceForRentExemption(info.data.length);
  const pool = await readProgram().account.communityPool.fetch(poolPda());
  return {
    lamports: info.lamports - rent,
    totalIn: pool.totalIn.toNumber(),
    totalOut: pool.totalOut.toNumber(),
    bonusesPaid: pool.bonusesPaid,
  };
}

// ---------- judge (cannot move funds) ----------

export async function openWindow(challenge: PublicKey, participant: PublicKey, day: number, index: number) {
  const program = judgeProgram();
  const window = windowPda(participant, day, index);
  const prevWindow = index > 0 ? windowPda(participant, day, index - 1) : null;
  const sig = await program.methods
    .openWindow(day, index)
    .accountsPartial({
      judge: judgeKeypair().publicKey,
      challenge,
      participant,
      window,
      prevWindow,
      slotHashes: SLOT_HASHES,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  const w = await program.account.window.fetch(window);
  return {
    sig,
    pda: window.toBase58(),
    slot: w.slot.toString(),
    slotHash: bytesToHex(w.slotHash),
    pose: Array.from(w.pose),
    openedAt: w.openedAt.toNumber(),
    expiresAt: w.expiresAt.toNumber(),
  };
}

export type CheckinInput = {
  challenge: PublicKey;
  participant: PublicKey;
  day: number;
  attempt: number;
  verdict: 0 | 1 | 2;
  reasonCode: number;
  proofHash: Uint8Array;
  metricA?: number;
  metricB?: number;
  window?: PublicKey | null;
};

export async function recordCheckin(input: CheckinInput) {
  const program = judgeProgram();
  const checkin = checkinPda(input.participant, input.day, input.attempt);
  const sig = await program.methods
    .recordCheckin({
      day: input.day,
      attempt: input.attempt,
      verdict: input.verdict,
      reasonCode: input.reasonCode,
      proofHash: Array.from(input.proofHash),
      metricA: new BN(Math.max(0, Math.floor(input.metricA ?? 0))),
      metricB: new BN(Math.max(0, Math.floor(input.metricB ?? 0))),
    })
    .accountsPartial({
      judge: judgeKeypair().publicKey,
      challenge: input.challenge,
      participant: input.participant,
      checkin,
      window: input.window ?? null,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  return { sig, pda: checkin.toBase58() };
}

/** Next unused attempt number for a participant/day (reads chain). */
export async function nextAttempt(participant: PublicKey, day: number): Promise<number> {
  const conn = connection();
  const keys = Array.from({ length: 8 }, (_, i) => checkinPda(participant, day, i));
  const infos = await conn.getMultipleAccountsInfo(keys);
  const idx = infos.findIndex((x) => x === null);
  return idx === -1 ? 8 : idx;
}

// ---------- crank (permissionless) ----------

export async function eliminateMissed(challenge: PublicKey, participant: PublicKey, day: number) {
  return crankProgram().methods.eliminateMissed(day).accountsPartial({ challenge, participant }).rpc();
}

export async function settle(challenge: PublicKey) {
  const program = crankProgram();
  const ch = await program.account.challenge.fetch(challenge);
  const parts = await fetchParticipants(challenge, program);
  const charity = ch.failDest === 1 ? ch.charity : null;
  return program.methods
    .settle()
    .accountsPartial({
      challenge,
      vault: vaultPda(challenge),
      config: configPda(),
      pool: poolPda(),
      charity,
    })
    .remainingAccounts(parts.map((p) => ({ pubkey: p.publicKey, isSigner: false, isWritable: true })))
    .rpc();
}

// ---------- bots (demo only) ----------

export async function botJoin(bot: Keypair, challenge: PublicKey, offsetMin = 60) {
  return programFor(bot)
    .methods.joinChallenge(offsetMin)
    .accountsPartial({
      player: bot.publicKey,
      challenge,
      vault: vaultPda(challenge),
      participant: participantPda(challenge, bot.publicKey),
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function botForfeit(bot: Keypair, challenge: PublicKey) {
  return programFor(bot)
    .methods.forfeit()
    .accountsPartial({ player: bot.publicKey, challenge, participant: participantPda(challenge, bot.publicKey) })
    .rpc();
}

export async function botClaim(bot: Keypair, challenge: PublicKey) {
  return programFor(bot)
    .methods.claim()
    .accountsPartial({
      player: bot.publicKey,
      challenge,
      vault: vaultPda(challenge),
      participant: participantPda(challenge, bot.publicKey),
    })
    .rpc();
}

export { challengePda, participantPda, windowPda, checkinPda, configPda, poolPda, vaultPda };
