# Stakehold — Demo script

## Before recording (10 min of prep)

1. `npm run dev`, then open `http://localhost:3000/demo` and check that all four health chips are green (program, config, AI, judge balance).
2. Phantom is on **devnet** with ≥ 0.2 SOL (faucet.solana.com).
3. **Have a Duolingo lesson ready** for the demo, so the XP jump happens live.
4. On `/demo`: **Seed photo challenge + bots** (day length 120 s, 2 days, lobby ~90 s). Open the challenge in a second tab and **join with Phantom**.
5. Have a glass of water nearby: the demo rule is "holding a glass/bottle of water". Also have a *pre-taken* photo printed or open on a second phone (for the rejection beat).

---

## 2-minute video script

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:12 | Home hero | "Most of us quit our habits within weeks. Stakehold is **Survivor for your habits**: put money on it, an AI referee checks your proof, and the people who quit pay the people who don't." |
| 0:12–0:30 | Create → type "Go to the gym 4x a week" → ✨ Draft proof plan | "Describe a habit in plain English. The AI drafts a proof plan and **rates its strength** honestly. For 'no sugar' it even tells you it can't be photographed and suggests a provable reframe." |
| 0:30–0:50 | Challenge page: lobby countdown, leaderboard with 4 bots + me, Explorer link to the vault | "Stakes go into a **program-owned vault on Solana**. Nobody, not even us, can touch it." |
| 0:50–1:15 | Window opens → pose card "Show 3 fingers + point left + smile" → in-app camera → ✅ | "Each day a surprise window opens. The pose is derived from Solana's **SlotHashes sysvar** at that moment, so a pre-taken photo can't match. Code checks the timing, the AI checks the pose and that it's a live photo, and the verdict lands **onchain** with a proof hash." |
| 1:15–1:30 | Day 2: hold up the pre-taken photo → ❌ "wrong pose / not a live photo" → retake ✅ | "Try to cheat with an old photo and the referee rejects it with a clear reason. One retake allowed." |
| 1:30–1:42 | Leaderboard: Mei 🔥 eliminated day 2, Tunde quit | "Miss a day or fail and you're out, live on the leaderboard. Anyone can trigger the elimination onchain." |
| 1:42–1:55 | Settle → Claim → Explorer showing the payout | "When it ends, survivors split the whole pot, quitters' stakes included, paid by the program. Every step has an Explorer link." |
| 1:55–2:00 | Verify panel + logo | "The AI referee has its own key and can only record verdicts, never move money. Stakehold: put your money where your habits are." |

---

## 3-minute live pitch outline

1. **Hook (20 s):** "Raise your hand if you've quit a New Year's resolution." Loss aversion works, but today's money-on-the-line apps ask you to trust a company with the pot *and* the judging.
2. **Product (40 s):** group, public and solo modes. Survivors split the pot equally; solo players bet on themselves (finish → stake + bonus from the community pool; fail → charity or pool).
3. **Live demo (75 s):** the seeded challenge on `/demo`: pose window → fresh photo ✅ → old photo ❌ → elimination on the leaderboard → settle + claim, with Explorer links. Show the **Verify panel**: slot, slot hash, bytes → pose.
4. **Prize tracks (30 s):**
   - **AI track:** an agent doing real onchain work. The AI referee signs verdicts with its own key and writes permanent `CheckIn` records, but the program **cannot let it move funds**. Prompt-injection guard: text in photos is data; "approve this" signs fail the proof.
   - **DeFi:** program-owned escrow vaults, exact stakes, permissionless settle, pull-pattern claims, community pool with capped bonuses.
   - **Gaming:** a survivor elimination game with live leaderboards, surprise windows and onchain randomness.
   - **Top 3:** a real, worldwide problem (habit change) with a clear path to revenue (Sponsor pots with a service fee; Stake skill games).
5. **Roadmap and ask (15 s):** appeals voting, completion badges, GitHub/Strava/reading proofs, sponsor pots, native app with device attestation. The microgrant funds a mainnet audit and the mobile app.
