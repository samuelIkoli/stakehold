---
description: Run the full end-to-end loop against a local validator
---
1. Start a validator with the built program (in the background):
   `solana-test-validator --reset --quiet --ledger <scratchpad>/test-ledger --bpf-program 87upMZXfZad7wuReP9LeoKW3HpFGfhgyF5nEhVSZx5ec target/deploy/stakehold.so`
2. Start the app on :3100 against it:
   `cd app && AI_MOCK=1 DATABASE_URL=file:./local.db NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 npx next dev -p 3100`
   (`AI_MOCK=1` is for this local run only.)
3. Init and seed: `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 DATABASE_URL=file:./local.db npm run init:devnet`, then trigger seeding from `/demo`.
4. Run `APP_URL=http://localhost:3100 NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 npx tsx scripts/e2e-user.ts` and `scripts/e2e-photo-gym.ts` from `app/`.
5. Report every ✓/✗ line. Stop the validator and the dev server when done.
