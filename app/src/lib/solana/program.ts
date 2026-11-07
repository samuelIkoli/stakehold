import { AnchorProvider, Program } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import idl from "./idl/stakehold.json";
import type { Stakehold } from "./idl/stakehold";
import { RPC_URL } from "./constants";

export type StakeholdProgram = Program<Stakehold>;

export type WalletLike = {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
};

export function makeConnection() {
  return new Connection(RPC_URL, { commitment: "confirmed" });
}

export function makeProgram(connection: Connection, wallet: WalletLike): StakeholdProgram {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program<Stakehold>(idl as Stakehold, provider);
}

/** Wallet backed by a local keypair (server-side judge / crank / bots). */
export function keypairWallet(kp: Keypair): WalletLike {
  return {
    publicKey: kp.publicKey,
    async signTransaction(tx) {
      if (tx instanceof VersionedTransaction) tx.sign([kp]);
      else tx.partialSign(kp);
      return tx;
    },
    async signAllTransactions(txs) {
      for (const tx of txs) {
        if (tx instanceof VersionedTransaction) tx.sign([kp]);
        else tx.partialSign(kp);
      }
      return txs;
    },
  };
}

/** Read-only program (never signs). */
export function readonlyProgram(connection = makeConnection()): StakeholdProgram {
  return makeProgram(connection, keypairWallet(Keypair.generate()));
}
