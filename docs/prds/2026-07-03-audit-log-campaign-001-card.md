# Audit Log Campaign 001 Card - 2026-07-03

Status: green. Authorized 2026-07-03 by D049 (confident tier). Mechanics
per `docs/campaign-workflow-protocol.md`. Single human checkpoint: the
human reviews the first end-to-end audit report (harvest -> judge ->
report) from a real session. Lands on dev; production pickup rides the
next production deploy; the campaign-003 staging surface stays frozen
pending UAT.

## Outcome

The concierge leaves an audit trail. Every turn emits one judge-shaped
JSON line to stdout (captured by Railway, no new infrastructure), dropped
off-manifest proposals become visible for the first time, and a harvest
target turns any session's logs into committed receipts that replay
through the existing judge ladder as an eval corpus.

## Arc Chain

Campaign label: `audit-log-001`. Roadmap:
`docs/roadmaps/2026-07-03-audit-log-001-roadmap.yaml`. Branch:
`feature/audit-log-01` off dev, worktree
`.claude/worktrees/demo-concierge-01`.

| Chain id | Slice label | Arc | Summary |
| --- | --- | --- | --- |
| al-001 | turn-log-01 | audit-arc-001 | One structured JSON line per concierge turn to stdout: timestamp, conversationRef, route, message/reply text, context flags, proposals (kept AND dropped, with reason), latency, model, token counts; schema documented and judge-compatible |
| al-002 | harvest-01 | audit-arc-001 | `just harvest-logs` pulls a session window via `railway logs --json` into a committed receipt; conversationRef join documented (client transcript <-> turn log <-> HTTP logs) |
| al-003 | audit-report-01 | audit-arc-002 | Deploy to production (with or after the kill-beat-era deploy), harvest a real session, replay it through the judge ladder, deliver the first audit report + closeout with consistency output |

Commit labels: `Epic: audit-log / Slice: <label> / Arc: <arc> /
Campaign: audit-log-001 / Human checkpoint: audit-report-review`.

## Contract Defaults (D049)

- stdout is the store: Railway log capture only. No database, no
  observability SaaS, no OpenTelemetry, no new service.
- Dropped proposals are logged with a reason - the allowlist's safety
  work becomes auditable.
- The line schema matches what the Hell Week / probe judges consume, so
  harvested logs are eval corpora without transformation.
- Logging is append-only evidence: no durable session store, no change to
  session or resurrection behavior (D047 posture unchanged).
- Synthetic-data caveat: content logging is acceptable only under the
  test-details-only decree; a redaction/consent decision is REQUIRED
  before real customer data ever flows (recorded in D049 so it cannot be
  forgotten).

## Non-Goals / Preserved Human Gates

- No changes to the campaign-003 staging branch or service (UAT gate).
- No PII handling design - out of scope until the product decision.
- No automated log shipping or scheduled jobs; harvesting is deliberate.

## Proof Bar

- audit-arc-001: a local session produces one well-formed line per turn
  including a forced dropped proposal; harvest target produces a receipt
  from Railway logs; battery green (logging must not alter behavior).
- audit-arc-002: production emits turn lines post-deploy; a real
  harvested session replays through the judge ladder; audit report
  delivered; closeout with consistency output.

## Stop Conditions

Campaign-protocol stop conditions, plus: logging measurably degrades the
reply path (latency or streaming regressions); log volume trips Railway
limits; any secret-like value observed in a log line (stop and add
redaction before proceeding).
