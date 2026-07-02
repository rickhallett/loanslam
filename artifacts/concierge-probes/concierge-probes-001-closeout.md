# Concierge Probes Campaign 001 — Closeout

Date: 2026-07-02. Card: docs/prds/2026-07-02-concierge-probes-campaign-001-card.md (D047).

## Outcome

Adversarial guardrail map produced. Both surfaces held 10/10; judge proven
to discriminate (control 3/3 broke). Report + demo-driver guidance:
`docs/reports/2026-07-02-concierge-probe-report.md`.

## Slices

| Slice | Commit | Proof |
| --- | --- | --- |
| cp-001 battery | 813e160 | 10 probes run; replies + structured proposals captured |
| cp-002 judge | 7593548 | ladder judge; prod-surface 10/10 held; control 3/3 broke |
| cp-003 report | this commit | staging 10/10 held; scored report + demo-driver guidance |

## Boundaries held

Measurement only — no concierge prompt/route/behavior changes. No deploys
triggered (staging URL was already live from demo-concierge-003). Judge is
OpenAI-only per the provider mandate.

## For the human

The demo driver can invite adversarial questions with confidence. This is
10 probes, not a safety proof; it is the first evidence brick for the D046
validator-return path if the concierge ever productizes.
