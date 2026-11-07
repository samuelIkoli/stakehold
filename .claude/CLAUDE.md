# Stakehold — notes for Claude

Habit challenges with SOL stakes on Solana **devnet**. Players stake, prove the habit daily (photo + random pose, gym check-in/out + GPS, Duolingo data, or honor), get eliminated on a missed day, and survivors split the pot. The product spec is `docs/SPEC.md`; decisions go in `docs/DECISIONS.md`, milestone status in `docs/PROGRESS.md`.

## Layout
- `programs/stakehold/` — Anchor 1.2.2 program (escrow vault, SlotHashes pose windows, verdicts, elimination, settle, claim). LiteSVM tests live in `programs/stakehold/tests/test_flow.rs`.
- `app/` — Next.js 16 (App Router, Turbopack) + Tailwind v4 + Prisma/SQLite.
  - `src/lib/ai/` — the only place that calls an AI model (Gemini REST). Keep vendor code behind this module.
  - `src/lib/server/` — chain writes (`chain.ts`), game logic (`game.ts`), scheduler, demo seeding.
  - `src/lib/client/tx.ts` — wallet-signed transactions.
  - `src/lib/solana/idl/` — generated; refresh with `npm run sync-idl` after `anchor build`.
  - `scripts/` — `init-devnet`, `seed-demo`, and the localnet e2e scripts.

## Commands (run from the repo root)
- Toolchain PATH: `export PATH=/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH`
- `npm run build:program` (anchor build + sync IDL) · `npm run test:program` (LiteSVM)
- `npm run test:app` (vitest) · `npm --prefix app run typecheck`
- `npm run dev` — app on :3000; the scheduler starts from `src/instrumentation.ts` (`SCHEDULER=off` disables it)
- `npm run init:devnet` · `npm run seed:demo`

## Invariants — don't break these
- The judge key can only open windows and record verdicts. It must never be able to move funds.
- Only a SHA-256 proof hash goes onchain; photos and raw data stay offchain.
- The final AI verdict is computed in code from individual checks, never taken from the model. Keep the prompt-injection guard in every prompt.
- Never commit secrets: `.env.local`, `keys/`, and `*.keypair.json` are git-ignored. Don't read or print keypairs or the Gemini key.
- `AI_MOCK=1` approves every photo and is for local testing only. Never enable it for a demo or deploy.

## Gotchas
- npm to the registry is very slow here (~35 KB/s). Use `--prefer-offline`. `.npmrc` sets a custom cache (root-owned `~/.npm`) and `legacy-peer-deps=true`.
- `@anchor-lang/core`'s browser bundle imports `fs`; `next.config.ts` aliases it to `src/lib/empty.ts`.
- Next dev runs instrumentation twice; the scheduler uses a file lease so only one copy ticks.
- Devnet CLI airdrops are rate-limited; fund the deployer (`~/.config/solana/id.json`) via https://faucet.solana.com.
- Time: a challenge day starts at 00:00 UTC minus the member's UTC offset. Day 0 is the baseline. Demo mode uses 1 day = 2 min.

## Slash commands
`/check` (all tests + typecheck), `/deploy-devnet`, `/local-e2e` — see `.claude/commands/`.
