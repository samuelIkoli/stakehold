"use client";
// Client-side transactions signed by the user's wallet.
import BN from "bn.js";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import { makeProgram } from "../solana/program";
import { challengePda, configPda, participantPda, poolPda, vaultPda } from "../solana/pdas";

export type CreateParams = {
  mode: 0 | 1 | 2;
  demo: boolean;
  stakeLamports: number;
  startTs: number;
  dayLen: number;
  numDays: number;
  graceSecs: number;
  windowSecs: number;
  maxPlayers: number;
  configHashHex: string;
  failDest: 0 | 1;
  charityIndex: number;
  /** Also join in the same transaction (creator plays). */
  joinOffsetMin?: number | null;
};

const hexToArr = (h: string) => Array.from({ length: h.length / 2 }, (_, i) => parseInt(h.slice(i * 2, i * 2 + 2), 16));

export async function createChallengeTx(connection: Connection, wallet: AnchorWallet, p: CreateParams) {
  const program = makeProgram(connection, wallet);
  const id = new BN(Date.now());
  const challenge = challengePda(wallet.publicKey, id);
  const builder = program.methods
    .createChallenge({
      id,
      mode: p.mode,
      demo: p.demo,
      stakeLamports: new BN(p.stakeLamports),
      startTs: new BN(p.startTs),
      dayLen: new BN(p.dayLen),
      numDays: p.numDays,
      graceSecs: new BN(p.graceSecs),
      windowSecs: p.windowSecs,
      maxPlayers: p.maxPlayers,
      configHash: hexToArr(p.configHashHex),
      failDest: p.failDest,
      charityIndex: p.charityIndex,
    })
    .accountsPartial({
      creator: wallet.publicKey,
      config: configPda(),
      challenge,
      vault: vaultPda(challenge),
      systemProgram: SystemProgram.programId,
    });
  if (p.joinOffsetMin != null) {
    const joinIx = await program.methods
      .joinChallenge(p.joinOffsetMin)
      .accountsPartial({
        player: wallet.publicKey,
        challenge,
        vault: vaultPda(challenge),
        participant: participantPda(challenge, wallet.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    builder.postInstructions([joinIx]);
  }
  const sig = await builder.rpc();
  return { sig, challenge: challenge.toBase58() };
}

export async function joinTx(connection: Connection, wallet: AnchorWallet, challenge: string, offsetMin: number) {
  const program = makeProgram(connection, wallet);
  const ch = new PublicKey(challenge);
  return program.methods
    .joinChallenge(offsetMin)
    .accountsPartial({
      player: wallet.publicKey,
      challenge: ch,
      vault: vaultPda(ch),
      participant: participantPda(ch, wallet.publicKey),
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function claimTx(connection: Connection, wallet: AnchorWallet, challenge: string) {
  const program = makeProgram(connection, wallet);
  const ch = new PublicKey(challenge);
  return program.methods
    .claim()
    .accountsPartial({ player: wallet.publicKey, challenge: ch, vault: vaultPda(ch), participant: participantPda(ch, wallet.publicKey) })
    .rpc();
}

export async function forfeitTx(connection: Connection, wallet: AnchorWallet, challenge: string) {
  const program = makeProgram(connection, wallet);
  const ch = new PublicKey(challenge);
  return program.methods.forfeit().accountsPartial({ player: wallet.publicKey, challenge: ch, participant: participantPda(ch, wallet.publicKey) }).rpc();
}

export async function settleTx(connection: Connection, wallet: AnchorWallet, challenge: string, participants: string[], charity: string | null) {
  const program = makeProgram(connection, wallet);
  const ch = new PublicKey(challenge);
  return program.methods
    .settle()
    .accountsPartial({ challenge: ch, vault: vaultPda(ch), config: configPda(), pool: poolPda(), charity: charity ? new PublicKey(charity) : null })
    .remainingAccounts(participants.map((p) => ({ pubkey: new PublicKey(p), isSigner: false, isWritable: true })))
    .rpc();
}

export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  const anchor = m.match(/Error Message: ([^.]+)\./);
  if (anchor) return anchor[1];
  if (/User rejected/i.test(m)) return "You cancelled in your wallet";
  if (/insufficient|0x1\b/i.test(m)) return "Not enough devnet SOL in your wallet";
  if (/Attempt to debit an account but found no record of a prior credit/i.test(m)) return "Your wallet has no devnet SOL yet — get some at faucet.solana.com";
  return m.length > 200 ? m.slice(0, 200) + "…" : m;
}
