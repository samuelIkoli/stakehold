# Progress

_Updated after each milestone. Times in WAT._

## Done
- **M1 Toolchain + scaffold** (Sat 15:20–16:00): Rust 1.99, Solana CLI 4.4.1 (Agave), Anchor 1.2.2, cargo-build-sbf 4.6 via Homebrew/crates.io. Monorepo with `programs/stakehold` (Anchor) + `app/` (Next.js 16).
- **M2 Anchor program + tests** (Sat 16:00–16:45): every instruction from the spec, plus `forfeit` and `donate_to_pool`. 4 LiteSVM tests pass (group loop, nobody survives → pool, solo bonus + charity, join-after-start rejected). **Devnet deploy is blocked until the deploy wallet is funded.**
- **M3–M11 code written** (Sat 16:45–): app shell, wallet connect + sign-in sessions, Home, Explore, Create (AI plan + manual), Challenge page (leaderboard, Verify panel, activity with Explorer links, join/claim/quit/settle), Prove page (photo + pose camera, gym check-in/out + GPS, Duolingo "I'm done", honor), Solo + community pool, Profile, Stake/Sponsor coming-soon pages, `/demo` control panel, seed script, background scheduler (windows, Duolingo snapshots, bots, eliminations, settlement).

## Next
- Finish npm install → typecheck → run the app locally.
- Deploy program to devnet once funded → `npm run init:devnet` → end-to-end demo run on devnet.

## Blockers
- Deploy wallet `9yBFyRrxJFrmvi22nsJc9h6Ux4ob8fmLNepbpxWVDBkf` has 0 SOL (CLI airdrop rate-limited). Needs ~5 SOL from https://faucet.solana.com.
- `GEMINI_API_KEY` placeholder in `.env.local`.
