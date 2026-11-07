---
description: Build, deploy the program to devnet, and initialise config + pool
---
1. Check the deployer balance with `solana balance -u devnet`. A deploy needs about 3 SOL; if there's less, stop and ask the user to fund `solana address` via https://faucet.solana.com.
2. `npm run build:program`, then `anchor deploy --provider.cluster devnet`. The program ID must stay `87upMZXfZad7wuReP9LeoKW3HpFGfhgyF5nEhVSZx5ec` (keypair in `keys/stakehold-program.json`).
3. `npm run init:devnet` (config, judge funding, pool seed). It's idempotent, so re-running is safe.
4. Print Explorer links (`https://explorer.solana.com/address/<id>?cluster=devnet`) for the program, config and pool, and record the deploy in `PROGRESS.md`.
