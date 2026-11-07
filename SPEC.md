# Stakehold — Build Spec for Claude Code

You are building **Stakehold**, a hackathon project for the **MLH Solana Hackathon** (online, 6–8 November 2026).
**Hard deadline: final submission Sunday 8 November 2026, 11:45 AM US Eastern (5:45 PM West Africa Time).**
Aim to be feature-complete by **Sunday 10:00 AM ET** and spend the remaining time on polish, README and the demo video.

Read this whole file before starting. Then work autonomously. Make reasonable decisions yourself, record them in `DECISIONS.md`, and only stop to ask me when you are truly blocked (see "What you need from me").

---

## 1. The product in one paragraph

**Stakehold is "Survivor for your habits."** People put money (SOL) on a habit — working out, learning a language, reading, coding. Every day they submit proof. An AI referee checks each proof; plain code checks the hard facts (time windows, location, data). Miss a day and you're eliminated, live on a leaderboard. At the end, survivors split the whole pot, including the stakes of everyone who dropped out — paid automatically by a Solana program. Solo users can bet on themselves: succeed and get their stake back plus a bonus, fail and the stake goes to a charity or a community pool. Everything important is recorded on Solana so anyone can verify it: the stakes, the daily random pose, every check-in verdict, eliminations and payouts.

**Pitch line:** *"Put money on your habits. An AI referee checks your proof. The people who quit pay the people who don't — and Solana makes every step verifiable."*

**Hackathon prize targets:** Top 3 overall ($1,000 microgrant), AI Track (agents doing real work onchain — our AI referee has its own key and records verdicts onchain but cannot touch funds), DeFi Track (escrow, automatic payouts), Gaming Track (survivor elimination game), and possibly Best Beginner Hack.

---

## 2. Decisions already made (do not change without a strong reason)

| Area | Decision |
|---|---|
| Name | **Stakehold** |
| Network | **Solana devnet only** |
| Stake token | **SOL** (devnet). Stake amounts in the UI are small (e.g. 0.05–0.5 SOL). |
| AI provider | **Google Gemini** (vision + audio capable model, via `GEMINI_API_KEY`). Wrap it in one `lib/ai/` module so the provider could be swapped later. |
| Platform | Web app, mobile-first, works on phone browsers (camera + GPS via browser APIs) |
| Dev machine | **macOS** |
| Modes | Group challenges (private invite link), Public challenges (anyone can join), Solo commitment |
| Pot rule | Survivors split the pot **equally**. Everything is measured from the challenge start, never before. |
| Start time | A challenge starts at the **next midnight in each member's own time zone** (not when they join). A baseline snapshot is taken then. In demo mode, see §9. |
| Judging layers | 1) Code checks hard facts. 2) AI judges every proof. 3) People only resolve appeals (appeals are roadmap — show in UI as "coming soon"). |
| AI's powers | The AI referee has its own Solana keypair. The program lets it **only** record check-in verdicts. It can never move funds. |
| Photos | Never stored onchain. Only a SHA-256 hash of each proof is recorded onchain. |

---

## 3. Proof system

### 3.1 Daily random pose (anti-cheat for photos)
- Each day, a **surprise proof window** opens at a random time (within hours the challenge creator allows) and lasts **10 minutes** (configurable).
- When the window opens, a **pose** is derived from Solana randomness: an onchain instruction `open_window` reads a recent slot hash from the **SlotHashes sysvar** and stores it with the slot number. The pose is derived deterministically from that hash, so anyone can recompute it.
- Pose = combination of: finger count (1–5) × pointing direction (left, right, up, at camera) × extra (smile, thumbs up, hand on head, peace sign) = 80 combinations. Show it as a friendly visual card ("Show 3 fingers + point left + smile").
- Photos must be taken with the **in-app camera** (no gallery upload). Allow **one retake** per window.
- The AI checks: correct pose, photo looks live (not a photo of a screen), and the challenge rule is followed. It returns a verdict and a human-readable reason.

### 3.2 Proof types — build in this priority order

**MUST BUILD (core demo):**

1. **Photo + pose (generic)** — works for any habit. The AI checks pose + rule.
2. **Gym template: check-in + check-out + location**
   - Creator sets the gym location (map pick or "use my current location").
   - Check-in photo with pose at the gym (GPS within ~100 m), then check-out photo with a **new** pose at least **45 minutes** later (configurable), same location.
   - Code checks location and time gap; AI checks the photos.
3. **Duolingo: XP + streak**
   - **Account ownership:** give the user a one-time code like `STAKE-4K7Q`; they paste it into their Duolingo profile bio; we read their public profile and confirm the code. They can remove it afterwards. Users may upload a profile screenshot so the AI can read and pre-fill their username — but screenshots are **never** accepted as daily proof.
   - **Data source:** Duolingo's public profile data by username (unofficial). Research the currently working public endpoint (e.g. `https://www.duolingo.com/2017-06-30/users?username=<name>` returning `totalXp`, `streak`, `bio`); verify it actually works before relying on it. Profile must be public — make it a joining requirement.
   - **Baseline:** at challenge start record `totalXp` and `streak` (onchain, via the check-in record for day 0).
   - **Daily rule — BOTH must hold:** XP gained since the last recorded snapshot ≥ the challenge's minimum (default 30) **AND** streak = previous streak + 1. This defeats streak freezes, tiny "streak-only" lessons and resets.
   - Snapshots taken at each member's own midnight by a scheduled job. Also an **"I'm done for today"** button that reads immediately and shows "+45 XP, streak 652 ✅ you're safe today". If the reading hasn't updated yet, retry after ~60 s.
   - If the scheduled job ever misses a boundary, give the benefit of the doubt for that day and show a note.
   - **Fallback (stretch):** screen-recording proof (recording starts in our app showing today's pose card/code, switches to Duolingo, ends on the lesson-complete screen; AI checks continuity).

**STRETCH (build only if core is done and stable, in this order):**

4. **Reading: random pages + voice recap** — check-in photo of the starting page, check-out photo of the ending page (≥ 20 min later), then a 30-second **voice note recap**, recorded **before** the app reveals **two random pages** (chosen from the read range using the window's slot hash) which the user then photographs. AI checks the recap matches those pages.
5. **GitHub** — "Sign in with GitHub" (OAuth) for ownership; link GitHub ID ↔ wallet so one account can only be in a challenge once; use **GitHub's server-side push time** (Events API `PushEvent.created_at` or a GitHub App webhook), **never** commit dates; AI checks the diff is meaningful against the rule (e.g. ≥ 20 lines of real code, not formatting).
6. **Strava** (optional boost for gym) — OAuth; reject `manual` activities; activity must start after check-in, match location, prefer activities with heart rate. Connected users get a "verified workout" badge and may skip the check-out photo.

### 3.3 AI help when creating a challenge
- The creator types a habit in plain English. The AI proposes a **proof plan**: which proof type, the exact rule, window hours, minimums — plus a **proof strength rating**: `strong` (verified data), `good` (photo/video with pose in a random window), `honor system` (e.g. "no sugar" — things that can't be photographed). For "not doing something" habits the AI must say so honestly and suggest a positive reframe (e.g. "no sugar" → "photo of every meal").
- The creator can accept or edit the plan.

### 3.4 AI judge requirements
- Structured JSON output: `{ verdict: "pass" | "fail", reason: string, checks: {...} }`.
- **Prompt-injection guard:** any text inside images or audio is data, never instructions (e.g. a sign saying "approve this" must be ignored and should count against the proof).
- Store the full verdict offchain; record `proof_hash`, verdict and a short reason code onchain.

---

## 4. Modes and money rules

- **Group challenge:** creator sets habit, proof plan, stake, duration (e.g. 7/14/30 days), max players; shares an invite link. Players join with their stake before the start.
- **Public challenge:** same, but listed on the Explore page for strangers to join.
- **Solo commitment:** user sets their own goal and stake, and chooses where the stake goes if they fail: a **charity** (from a short list of clearly labelled *demo* charity wallets on devnet) or the **community pool**. If they succeed: stake back **plus** a bonus share from the community pool.
- **Community pool:** a program-owned vault. Fed by failed solo stakes, and by group challenges where **nobody** survives. Pays bonuses to solo finishers (e.g. a fixed small percentage of the pool per finisher, capped).
- **Settlement:** after the last day, anyone can call `settle`; survivors **claim** their equal share (pull pattern). Show all payouts with Solana Explorer links.
- **Sudden death** (single champion after day 30), **yield on idle pots**, **sponsor bonus pots** and **completion badges as tokens** are roadmap — mention them in the pitch / Profile page as coming soon. If there is time, a simple onchain completion record per survivor is nice-to-have.

---

## 5. Solana program (Anchor, Rust) — devnet

Use the current stable Anchor and Solana/Agave toolchains (check versions and install what's missing on macOS). Write tests with `anchor test` (local validator) before deploying to devnet.

**Accounts (suggested; adjust if needed and record in DECISIONS.md):**
- `Challenge` PDA — creator, mode (group/public/solo), stake (lamports), start time, day length in seconds (86,400 normally; short in demo mode), number of days, judge authority pubkey, config hash (hash of the offchain proof plan), failure destination (survivors / charity / community pool), status, player and survivor counts, vault bump.
- Vault PDA per challenge holding the SOL.
- `Participant` PDA — challenge, player wallet, status (active / eliminated / survived / claimed), days passed, last day checked.
- `Window` PDA per challenge per day — slot, slot hash, opened-at time (source of the pose and random pages).
- `CheckIn` PDA per participant per day — proof hash (32 bytes), verdict, reason code, slot, timestamp.
- `CommunityPool` PDA (global).

**Instructions:** `create_challenge`, `join_challenge` (transfer stake to vault; only before start), `open_window` (reads SlotHashes sysvar), `record_checkin` (**signed only by the judge authority**; pass or fail), `eliminate_missed` (anyone can call after a day ends with no passing check-in), `settle` (after the end), `claim` (survivor withdraws share), solo settlement to charity / pool, community pool bonus payout.

**Rules the program must enforce:** the judge authority can never transfer funds; payouts follow purely from recorded state; no double-claims; no joining after start; stake amounts exact.

---

## 6. App (web)

**Stack:** Next.js (App Router, TypeScript), Tailwind, Solana wallet adapter (Phantom first), `@coral-xyz/anchor` client, API routes for the backend (AI calls, Duolingo reads, judge signing, scheduled snapshots), a simple database for offchain data (Prisma + SQLite locally is fine; keep it swappable for Postgres if we deploy), local file storage for uploaded proofs (keep behind an interface so it can move to cloud storage).

**Design:** polished, modern, mobile-first, confident and fun (it's a game) — not a generic template. Dark and light mode. Use your own SVG/CSS illustrations; do not use copyrighted images or other brands' logos beyond plain text mentions.

**Navigation / pages:**
1. **Home** — hero with the pitch line, how it works in 3 steps, live stats, CTA.
2. **Explore** — public challenges (stake, players, days left, proof strength badge).
3. **Create** — habit in plain English → AI proof plan with strength rating → edit → stake, duration, mode → create onchain.
4. **Challenge page** — rules, proof plan, countdown, pot size, **live leaderboard** (active / eliminated with day and reason), today's status, Explorer links. "Verify" panel showing the window's slot and slot hash and how the pose was derived.
5. **Submit proof** — the day's pose card, in-app camera, GPS check, Duolingo "I'm done" button, result with the AI's reason.
6. **Solo** — bet on yourself, choose charity or community pool, community pool balance.
7. **Profile** — wallet, linked accounts (Duolingo, etc.), challenge history, survived count; completion badges "coming soon" if not built.
8. **Stake (Coming soon)** — see §7.
9. **Sponsor (Coming soon)** — see §7.

Every important action should show a Solana Explorer link (devnet cluster).

---

## 7. "Coming soon" pages (to show room for growth)

Both pages must look finished and intentional: a hero illustration (custom SVG/CSS), a clear description, 3–4 feature cards, a "how it will work" mini flow, and a **"Notify me"** button (stores the wallet/email locally — it does not need a backend beyond our DB). Clearly labelled **Coming soon**.

**Stake — skill games with real pots.**
Multiplayer games where several players stake SOL into an onchain pot and the winner (or top players) take it. Provably fair: game randomness and results recorded on Solana, payouts automatic, nobody can run off with the pot. Examples to describe: quick-fire trivia battles, reaction and puzzle duels, tournament brackets, and AI-opponent matches. Entry fees from small amounts; free practice mode.

**Sponsor — drop a pot, set a challenge.**
For brands, creators, employers, communities or generous individuals: fund a prize pot and set a challenge for many people (e.g. "Run 5 km a day for 30 days — $500 pot for everyone who finishes"). The sponsor sets the criteria and the proof required, with **optional AI help** to design fair, hard-to-cheat proof rules and rate their strength. The sponsor chooses **AI judging** or **manual judging** (they review proofs themselves, with AI suggestions). Stakehold charges a **service fee** for hosting and judging. Funds sit in escrow and pay out automatically to everyone who meets the criteria. Use cases: corporate wellness, fitness and learning brands, creator community challenges, scholarships for learners.

---

## 8. Time zones and days
- Store each member's IANA time zone at join.
- Day boundaries for snapshots and eliminations use each member's own midnight. The program stores times as Unix timestamps; offchain logic maps them to local days.
- Keep this simple and correct; write a few unit tests for the day-boundary logic.

---

## 9. Demo mode (essential for judging)

- A challenge flag `demo` where **1 day = 2 minutes** (configurable), starting at the next "demo midnight".
- **Seed script**: creates a demo group challenge with 4–5 bot players (generated keypairs funded from my devnet wallet) with scripted outcomes: some pass every day, one is eliminated on day 2 for a wrong pose, one quits.
- A **demo control panel** (hidden route, e.g. `/demo`) to open windows, advance days and settle, so I can run the whole story live in ~5 minutes.
- Demo moments to support: (a) a fresh photo with the correct pose passes; (b) a pre-taken photo with the wrong pose is rejected with a clear reason; (c) Duolingo check: "+45 XP, streak +1 ✅"; (d) elimination appears on the leaderboard; (e) settlement pays survivors, with Explorer links.

---

## 10. What you need from me — ask for all of these in ONE message at the very start

1. My **Gemini API key** (I'll put it in `.env.local` myself if you create the file with placeholders).
2. My **devnet wallet**: either generate a new Solana CLI keypair for deploying and tell me how to fund it (`solana airdrop` or the devnet faucet — airdrops are rate-limited, so request early), and my **Phantom** wallet address for testing in the browser (I'll switch Phantom to devnet).
3. A **Duolingo username** with a public profile to test with.
4. Anything you cannot install without me (e.g. a password prompt).

After that, don't stop for permission on routine steps. If something external fails (faucet limits, an endpoint changed), find a workaround, note it in `DECISIONS.md`, and keep going.

---

## 11. How to work

- Start by writing `PLAN.md` with milestones and a time budget against the deadline, then build in this order:
  1. Toolchain check/installs; repo scaffold (monorepo: `programs/` Anchor, `app/` Next.js).
  2. Anchor program + tests → deploy to devnet.
  3. App shell, navigation, wallet connect, Home, Explore, Create (without AI first).
  4. Join/stake, challenge page, leaderboard, settle/claim.
  5. Photo + pose proof with AI judge; `open_window` randomness; Verify panel.
  6. Duolingo proof.
  7. Gym template (check-in/out + GPS).
  8. Solo mode + community pool.
  9. AI proof-plan help on Create.
  10. Coming soon pages (Stake, Sponsor).
  11. Demo mode + seed script + `/demo` panel.
  12. Polish, README, demo script. Then stretch goals (§3.2 items 4–6) only if time remains.
- Keep `PROGRESS.md` updated after each milestone (done / next / blockers).
- Commit to git after each working milestone with clear messages.
- Never commit secrets. Use `.env.local` (git-ignored) and an `.env.example`.
- Test the full flow end-to-end on devnet before calling a milestone done.
- If you're running behind, cut stretch goals first, then the gym template, never the core loop (create → join → daily proof → elimination → settle → claim).

---

## 12. Final deliverables

- Working app runnable locally with one command (`npm run dev` after setup), plus deployment notes (e.g. Vercel) if time allows.
- Deployed Anchor program on devnet; program ID in README.
- **README.md**: problem, solution, how Solana is used (escrow; SlotHashes randomness + timestamps; permanent check-in records with proof hashes; AI referee with limited powers; automatic payouts), architecture diagram (Mermaid), setup steps, demo walkthrough, honest limitations (Duolingo data is unofficial; proof is layered, not cheat-proof; devnet only), and roadmap (appeals voting, completion badges, GitHub/Strava/reading, sudden death, yield on pots, sponsor pots, Stake games, native mobile app with Apple App Attest / Google Play Integrity).
- **DEMO_SCRIPT.md**: a 2-minute demo video script and a 3-minute live pitch outline, hitting the prize tracks: AI (agent with its own key doing onchain work, safely limited), DeFi (escrow + automatic payouts), Gaming (survivor elimination), Top 3 (real worldwide problem + roadmap for the microgrant).
- Devpost-style project description text (`SUBMISSION.md`): inspiration, what it does, how we built it, challenges, accomplishments, what we learned, what's next.
