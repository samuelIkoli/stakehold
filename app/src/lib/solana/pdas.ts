import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { PROGRAM_ID } from "./constants";

const enc = (s: string) => Buffer.from(s);
const pda = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

export const configPda = () => pda([enc("config")]);
export const poolPda = () => pda([enc("pool")]);
export const challengePda = (creator: PublicKey, id: BN | number) =>
  pda([enc("challenge"), creator.toBuffer(), new BN(id).toArrayLike(Buffer, "le", 8)]);
export const vaultPda = (challenge: PublicKey) => pda([enc("vault"), challenge.toBuffer()]);
export const participantPda = (challenge: PublicKey, player: PublicKey) =>
  pda([enc("participant"), challenge.toBuffer(), player.toBuffer()]);
export const windowPda = (participant: PublicKey, day: number, index: number) =>
  pda([enc("window"), participant.toBuffer(), new BN(day).toArrayLike(Buffer, "le", 2), Buffer.from([index])]);
export const checkinPda = (participant: PublicKey, day: number, attempt: number) =>
  pda([enc("checkin"), participant.toBuffer(), new BN(day).toArrayLike(Buffer, "le", 2), Buffer.from([attempt])]);

export const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");
