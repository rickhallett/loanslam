# Integrated POC Integration Proof 01

Date: 2026-07-01

## Scope

- Epic: ipoc
- Slice: ipoc-integration-proof-01
- Arc: ipoc-arc-003
- Human checkpoint: arc-closeout
- Branch: feature/ipoc-golden-path-01
- Worktree: /Users/mrkai/code/loanslam/.claude/worktrees/ipoc-golden-path-01
- Authorization: batch arc green-light (D037/D038), agenda card
  `docs/prds/2026-07-01-integrated-poc-arc-003-agenda-card.md`

## What this slice adds

`scripts/ipoc-integration-battery.mjs` — a committed integration battery that
drives the REAL ipoc HTTP surface end-to-end with no mocked paths: session
creation, demo lookup (match/no-match/validation), account answers (gated,
sanctioned strings, invalid question), a LIVE OpenAI-backed engine boundary
case, and the full ticket workflow (status transitions, notes, activity).

Hell Week remains the engine-level battery; this battery is the app-surface
counterpart the evidence discipline calls for when the existing battery does
not cover the claim. The engine turn inside it runs through the standard
OpenAI planner config (provider mandate holds).

## Run

- Server: `just secrets-run local -- npm --workspace @loanslam/integrated-poc run dev -- --port 3631`
- Battery: `node scripts/ipoc-integration-battery.mjs` (from the repo root)

## Result

- Report: `artifacts/integrated-poc/ipoc-integration-battery-2026-07-01T22-30-27-793Z.json`
- 16/16 cases passed.

Key case — `engine-boundary-matched-session` (live engine): a session with a
matched demo record asked the engine "What is my outstanding balance?". The
engine returned `finalAction request_handoff_intake` and its reply contained
none of the mock-only values (£1,240.50, 2026-07-28, etc.). The mock store is
invisible to the engine; read-only demo answers exist only on the sanctioned
app path.

## Data-quality note

The first battery run failed this case because the leak assertion scanned the
whole response body, which includes the UI transcript legitimately echoing
earlier sanctioned demo answers. The assertion was corrected to target the
engine's own utterance (`assistant.message`) and the ticket
`assistantPreview`. The failure was a battery bug, not an app leak; the
corrected run is the committed report.

## Boundaries Held

- No engine, validator, routing, or contract changes; the battery observes
  behavior only.
- Battery asserts the mock-store boundary rather than trusting it.
- Static tests are not presented as behavior proof; every case in the battery
  runs against the live server, and the boundary case runs the live engine.

## Checks

- `just gate-slice -- --staged` and `just verify` results recorded in the
  commit that lands this slice.
