# Stakehold — Survivor for your habits

**Put money on your habits. An AI referee checks your proof. The people who quit pay the people who don't — and Solana makes every step verifiable.**

## Inspiration
Everyone has a graveyard of abandoned habits: the gym membership, the language app, the reading list. Research on commitment devices is clear: putting something at stake works. But existing "bet on yourself" apps are black boxes. You trust them with your money *and* with deciding whether you succeeded. We wanted the stakes to be real and the referee to be accountable, and we wanted it to be *fun*. So we turned it into a survivor game.

## What it does
- **Group, public or solo challenges.** Players stake SOL on a habit for 3–30 days.
- **Daily proof, three layers deep.** ① Code checks the hard facts (time windows, GPS geofence, check-in/check-out gap, Duolingo XP numbers). ② An AI referee (Gemini vision) judges each photo: the right random pose, a live photo, the rule followed, no prompt-injection tricks. ③ Human appeals (roadmap).
- **Surprise windows with onchain randomness.** When a 10-minute window opens, the Solana program reads the **SlotHashes sysvar** and derives a pose ("show 3 fingers + point left + smile"). Nobody can know it in advance, and anyone can recompute it in our Verify panel.
- **Survivor mechanics.** Miss a day and you're eliminated, live on the leaderboard, with the day and the reason. Survivors split the whole pot equally, quitters' stakes included.
- **Solo commitments.** Bet on yourself. Finish → stake back plus a bonus from the community pool. Fail → your stake goes to a (clearly labelled demo) charity or the community pool.
- **Proof types:** photo + pose (any habit), gym check-in/check-out with GPS and a new pose, Duolingo (ownership via a bio code; XP earned ≥ the minimum each day or round, counted from a recorded starting point), and an honest "honor system" tier.
- **AI proof-plan helper:** describe a habit in plain English and get a proof plan with a strength rating. For "no sugar" it honestly says it can't be photographed and suggests a positive reframe.
- **Coming soon:** *Stake* (skill games with onchain pots) and *Sponsor* (brands fund pots for everyone who completes a challenge).

## How we built it
- **Solana program (Anchor 1.2, Rust):** `Config`, `Challenge`, `Vault`, `Participant`, `Window`, `CheckIn` and `CommunityPool` accounts. Instructions: create/join (exact stake, before your own local-midnight start), `open_window` (SlotHashes), `record_checkin` (judge-only), `eliminate_missed` and `settle` (permissionless), `claim` (pull payouts), `forfeit`, solo charity/pool settlement and the pool bonus. Tested with LiteSVM, including clock warping across day boundaries.
- **AI agent with limited powers:** the referee has its own keypair. The program accepts its signature only for opening windows and recording verdicts; it can never move funds. Each verdict stores a SHA-256 proof hash, a reason code and metrics onchain, while photos stay offchain.
- **App:** Next.js 16 (App Router, TypeScript, Tailwind v4), Solana wallet adapter (Phantom), the `@anchor-lang/core` client, Prisma + SQLite and a background scheduler (surprise windows, Duolingo midnight snapshots, eliminations, settlement). Mobile-first, with dark and light modes and original SVG illustrations.
- **Demo mode:** 1 day = 2 minutes, a seed script with scripted bots and a hidden `/demo` control panel, so the full story runs live in about 5 minutes.

## Challenges we ran into
- **Time zones.** "Starts at *your* midnight" means members of one challenge start at different instants. We store a per-member start onchain (`reference − UTC offset`) and made the offchain logic use exactly the same boundaries, with unit tests including DST.
- **Randomness without an oracle.** SlotHashes is too large to deserialise onchain, so we parse the newest entry by hand. A gym check-out must also never repeat the check-in pose, so a deterministic fallback reads different hash bytes.
- **Making the AI safe to trust with money.** We never let the model's own "pass" decide. The final verdict is computed in code from individual checks, and text in images is treated as data (prompt-injection guard).
- **Duolingo's unofficial API.** We found the endpoint that still works, discovered that a `fields=` parameter silently breaks it, and settled on an XP-only rule measured from a recorded starting point. A streak rule failed real users who had already kept their streak that day.

## Accomplishments that we're proud of
- An end-to-end loop on devnet: create → join → daily proof → elimination → settle → claim, every step with an Explorer link.
- An AI agent that does real onchain work but is *provably* unable to touch the funds.
- A Verify panel that lets anyone recompute the day's pose from the onchain slot hash.

## What we learned
Separating "who decides" from "who holds the money" makes AI agents far easier to trust. Onchain randomness from SlotHashes is good enough for anti-cheat when combined with short windows. And a hackathon product needs a demo mode built in from day one.

## What's next for Stakehold
Appeals voting by fellow players, completion badges as tokens, GitHub/Strava/reading proofs, sudden-death finals, yield on idle pots, **Sponsor** pots for brands and employers (service-fee revenue), **Stake** skill games, and a native mobile app with Apple App Attest / Google Play Integrity for stronger live-capture guarantees, then a security audit and mainnet.
