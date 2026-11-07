# Stakehold — Build Plan

All times **West Africa Time (WAT, UTC+1)**. ET = WAT − 6 h (US is on EST after 1 Nov).

- Start: **Sat 7 Nov, 15:20 WAT**
- Feature-complete target: **Sun 8 Nov, 16:00 WAT (10:00 AM ET)**
- Hard submission deadline: **Sun 8 Nov, 17:45 WAT (11:45 AM ET)**

Rule: the core loop (create → join → daily proof → elimination → settle → claim) must work end-to-end on devnet before anything else. If behind: cut stretch goals → gym template. Never cut the core loop.

| # | Milestone | Window (WAT) | Exit criteria |
|---|---|---|---|
| 1 | Toolchain + monorepo scaffold (`programs/`, `app/`) | Sat 15:20 – 16:30 | `anchor build` works, Next.js app boots |
| 2 | Anchor program + LiteSVM tests → **devnet deploy** | Sat 16:30 – 20:00 | all tests green; program ID on devnet (needs funded wallet) |
| 3 | App shell, nav, wallet connect, Home, Explore, Create (no AI) | Sat 20:00 – 22:30 | create a challenge onchain from the browser |
| 4 | Join/stake, Challenge page, leaderboard, settle/claim | Sat 22:30 – Sun 01:00 | full money loop on devnet with short demo days |
| 5 | Photo + pose proof, Gemini judge, `open_window` randomness, Verify panel | Sun 01:00 – 03:30 | pass + fail verdicts recorded onchain |
| 6 | Duolingo proof (ownership code, baseline, snapshots, "I'm done") | Sun 03:30 – 05:00 | real profile reading, verdict onchain |
| 7 | Gym template (check-in/out + GPS + time gap) | Sun 05:00 – 06:30 | code + AI checks |
| 8 | Solo mode + community pool | Sun 06:30 – 08:00 | solo success bonus, solo fail → charity/pool |
| 9 | AI proof-plan help on Create | Sun 08:00 – 09:00 | plain-English habit → plan + strength |
| 10 | Coming-soon pages (Stake, Sponsor) | Sun 09:00 – 10:00 | polished pages + Notify me |
| 11 | Demo mode: seed script + `/demo` panel | Sun 10:00 – 12:30 | 5-minute live story works twice in a row |
| 12 | Polish, README, DEMO_SCRIPT, SUBMISSION | Sun 12:30 – 16:00 | **feature-complete** |
| — | Buffer: bug fixes, video recording (you), submit | Sun 16:00 – 17:45 | submitted |
| S | Stretch (reading → GitHub → Strava) | only if all above done | — |

Notes
- Demo-length days (1 day = 2 min) are built into the program from the start (`day_len` is a challenge parameter), so milestones 4–8 are tested end-to-end on devnet with short days, not just at milestone 11.
- Devnet deploy depends on the deploy wallet being funded (`9yBFyRrxJFrmvi22nsJc9h6Ux4ob8fmLNepbpxWVDBkf`). Until then, all program work is tested on LiteSVM / local validator.
