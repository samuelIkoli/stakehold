// One-time devnet setup: create the global Config (judge key + demo charities) and the
// community pool, fund the judge with fee SOL, and seed the pool with a small donation.
//   npm run init:devnet
import BN from "bn.js";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import * as chain from "../src/lib/server/chain";
import { DEMO_CHARITIES, SOLO_BONUS_BPS, SOLO_BONUS_CAP_SOL } from "../src/lib/charities";

async function main() {
  const conn = chain.connection();
  const crank = chain.crankKeypair();
  const judge = chain.judgeKeypair();
  console.log("admin/crank:", crank.publicKey.toBase58(), (await conn.getBalance(crank.publicKey)) / LAMPORTS_PER_SOL, "SOL");
  console.log("judge      :", judge.publicKey.toBase58(), (await conn.getBalance(judge.publicKey)) / LAMPORTS_PER_SOL, "SOL");

  const program = chain.crankProgram();
  const args = {
    judge: judge.publicKey,
    charities: DEMO_CHARITIES.map((c) => new PublicKey(c.address)) as [PublicKey, PublicKey, PublicKey],
    bonusBps: SOLO_BONUS_BPS,
    bonusCap: new BN(SOLO_BONUS_CAP_SOL * LAMPORTS_PER_SOL),
  };
  const existing = await chain.fetchConfig();
  if (!existing) {
    const sig = await program.methods
      .initConfig(args)
      .accountsPartial({ admin: crank.publicKey, config: chain.configPda(), pool: chain.poolPda(), systemProgram: SystemProgram.programId })
      .rpc();
    console.log("init_config:", sig);
  } else if (!existing.judge.equals(judge.publicKey)) {
    const sig = await program.methods.updateConfig(args).accountsPartial({ admin: crank.publicKey, config: chain.configPda() }).rpc();
    console.log("update_config:", sig);
  } else {
    console.log("config already initialised");
  }

  // Judge needs SOL for fees + rent of the records it writes.
  const jb = await conn.getBalance(judge.publicKey);
  if (jb < 0.3 * LAMPORTS_PER_SOL) {
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: crank.publicKey, toPubkey: judge.publicKey, lamports: 0.5 * LAMPORTS_PER_SOL - jb }),
    );
    const sig = await conn.sendTransaction(tx, [crank]);
    await conn.confirmTransaction(sig, "confirmed");
    console.log("funded judge:", sig);
  }

  const pool = await chain.poolBalance();
  if (pool.lamports < 0.05 * LAMPORTS_PER_SOL && process.env.SKIP_POOL_SEED !== "1") {
    const sig = await program.methods
      .donateToPool(new BN(0.1 * LAMPORTS_PER_SOL))
      .accountsPartial({ donor: crank.publicKey, pool: chain.poolPda(), systemProgram: SystemProgram.programId })
      .rpc();
    console.log("seeded community pool with 0.1 SOL:", sig);
  }
  console.log("done ✔");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
