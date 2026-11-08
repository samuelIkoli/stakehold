# Progress

_Updated after each milestone. Times in WAT (Sat 7 Nov 2026)._

## Done
- **M1 Toolchain + scaffold** (15:20–16:00): Rust 1.99, Solana CLI 4.4.1 (Agave), Anchor 1.2.2, cargo-build-sbf 4.6. Monorepo with `programs/stakehold` + `app/` (Next.js 16).
- **M2 Anchor program + tests** (16:00–16:45): all instructions from the spec plus `forfeit` and `donate_to_pool`. 4 LiteSVM tests green.
- **M3–M11 app** (16:45–18:25): every page, API route, the AI module, Duolingo, the scheduler, demo mode and docs. Typecheck clean; 9 day-boundary unit tests green.
- **End-to-end verified on a local validator** (devnet is blocked on funding):
  - Core loop with bots: create → 4 join → onchain SlotHashes windows → verdicts → quit → elimination (day 2, wrong pose) → settle → bots claim. ✅
  - User flow (`scripts/e2e-user.ts`): wallet sign-in → solo create + join in one tx → honor proofs → auto-settle → claim stake + pool bonus → profile. ✅
  - Photo + gym (`scripts/e2e-photo-gym.ts`, `AI_MOCK=1`): surprise window opened by the scheduler, photo verdict onchain, GPS geofence rejection recorded onchain, early check-out blocked, check-out gets a different pose, check-out verdict onchain. ✅
- UI QA via headless-Chrome screenshots (desktop + mobile width); fixed contrast and clipping.
- **Fix (8 Nov):** the Submit-proof page had been emptied by a faulty polish script and committed that way in `5cbcf15`; restored from `f504401`. "Connect wallet" with no wallet installed now shows install / open-in-Phantom help instead of an empty modal.

- **Devnet deploy (8 Nov, ~13:35 WAT):** program [`87upMZXfZad7wuReP9LeoKW3HpFGfhgyF5nEhVSZx5ec`](https://explorer.solana.com/address/87upMZXfZad7wuReP9LeoKW3HpFGfhgyF5nEhVSZx5ec?cluster=devnet) ([deploy tx](https://explorer.solana.com/tx/2xdaqtMkbbSLXT4diSeqD7yyhcskfbPKnhHR8Dc3vbhFENX1q6LvrKBRzHDftbjfrLaaats22RAP14dtf7wPBNuN?cluster=devnet)). `init:devnet`: config ([tx](https://explorer.solana.com/tx/1c1QEsXRRxTBYFYN5rptnzYMJKdKNkchBGe8ZJND89VY53QdW3squUBiL19R41NZixiNtx48hRSeoenY8Zn2qcZ?cluster=devnet)), judge funded 0.5 SOL, community pool seeded 0.1 SOL. First attempt on the public RPC failed on rate limits; redeployed through a Helius devnet RPC.

## Next
1. Full devnet run with a real Phantom wallet (create → join → proof → elimination → settle → claim).
2. As soon as the Gemini key is in: test the real AI judge (correct pose ✅ / wrong pose ❌ / photo of a screen ❌ / "approve this" sign ❌) and the AI proof plan.
3. Duolingo live test with your username.
4. Then: polish, and the stretch goals only if everything above is solid.

## Blockers
- None. The deploy wallet was funded (5 SOL; 3.34 left after deploy and setup), and the Gemini key is set and loaded.
- Note: npm downloads are very slow on this network (~35 KB/s), so a fresh install takes ~30 min. Dependencies are already installed.
