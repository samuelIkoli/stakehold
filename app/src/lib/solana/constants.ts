import { PublicKey } from "@solana/web3.js";
import idl from "./idl/stakehold.json";

export const PROGRAM_ID = new PublicKey(idl.address);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const CLUSTER = "devnet";
export const LAMPORTS = 1_000_000_000;

export const MODE = { group: 0, public: 1, solo: 2 } as const;
export const MODE_NAME = ["group", "public", "solo"] as const;
export type ModeName = (typeof MODE_NAME)[number];

export const FAIL_TO_POOL = 0;
export const FAIL_TO_CHARITY = 1;

export const PLAYER_STATUS = ["active", "eliminated", "survived", "claimed"] as const;
export type PlayerStatus = (typeof PLAYER_STATUS)[number];
export const CHALLENGE_STATUS = ["active", "settled"] as const;

export const VERDICT = { fail: 0, pass: 1, baseline: 2 } as const;

/** Short reason codes stored onchain next to each verdict. Full reasons live offchain. */
export const REASON_CODES: Record<number, string> = {
  0: "ok",
  1: "wrong pose",
  2: "rule not met",
  3: "not a live photo",
  4: "outside location",
  5: "too soon (time gap)",
  6: "window expired",
  7: "xp below minimum",
  8: "streak not extended",
  9: "suspicious / injection attempt",
  10: "profile unavailable",
  11: "honor-system self report",
  12: "scripted demo bot",
  13: "benefit of the doubt (missed snapshot)",
  14: "baseline snapshot",
  15: "unclear photo",
};

export function explorerTx(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
}
export function explorerAddress(addr: string) {
  return `https://explorer.solana.com/address/${addr}?cluster=${CLUSTER}`;
}

export function sol(lamports: number | bigint, digits = 3): string {
  const v = Number(lamports) / LAMPORTS;
  return `${parseFloat(v.toFixed(digits))} SOL`;
}

export function shortKey(k: string, n = 4) {
  return k.length > 2 * n + 1 ? `${k.slice(0, n)}…${k.slice(-n)}` : k;
}
