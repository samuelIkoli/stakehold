---
description: Run every check (program tests, app typecheck, app unit tests)
---
Run these from the repo root with `export PATH=/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH`, and report pass or fail for each with the relevant output on failure:

1. `npm run test:program`
2. `npm --prefix app run typecheck`
3. `npm run test:app`

Don't fix anything unless asked; just report.
