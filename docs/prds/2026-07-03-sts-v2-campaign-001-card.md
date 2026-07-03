# STS v2 Campaign 001 Card - Reactive Battery - 2026-07-03

Status: green. Authorized 2026-07-03 by D050. Mechanics per
`docs/campaign-workflow-protocol.md`. Keel invariants in
`docs/prds/2026-07-03-sts-v2-keel-spec.md` (frozen at authorization; dated
amendments only). Single human checkpoint: campaign closeout.

## Authorization line

D050, accepted 2026-07-03. Endpoint: the human reviews the closeout report
and decides whether the reactive battery joins the arc-close/promotion
proof bar alongside Hell Week, and rules on the follow-up priority
(distribution grounding vs. concierge-surface trajectories under the
validator-return path).

Arc-open re-grounding (sts2-arc-001, 2026-07-03): decision log tail
re-read at dev c6c6528. D048 (demo-killbeat, choreography only) and D049
(audit-log turn log on the site-nuxt surface) were accepted after this
card was drafted; neither contradicts the premise or overlaps the write
scope beyond disjoint additions to `scripts/` and `justfile`. D049's
judge-compatible turn log strengthens the deferred distribution-grounding
follow-up by giving it a harvestable data source. The card's gpt-5.5
customer role for graded runs knowingly deviates from the Provider
Mandate's default ladder (5.5 reserved for adjudication); D050 records
that authorization with its cost ceilings. Premise holds.

## Outcome

A reactive customer simulator (STS v2) that plays goal-driven, persona-bound
customers against the live processTurn engine turn-by-turn, judged at the
trajectory level against the frozen keel, calibrated against a frozen gold
set, with evidence artifacts compatible with the existing Hell Week tooling.
It closes the batteries' shared structural gap: today every customer turn is
predetermined, so the suite samples what customers say first and almost none
of how they react to what the bot said. Measurement infrastructure only.

## Arc Chain

Campaign label: `sts-v2-001`. Roadmap:
`docs/roadmaps/2026-07-03-sts-v2-001-roadmap.yaml` (authored at arc-001
open). Branch: `feature/sts-v2-01` off dev, worktree per worktree
discipline.

| Chain id | Slice label | Arc | Summary |
| --- | --- | --- | --- |
| sv2-001 | sim-harness-01 | sts2-arc-001 | Initialization sampler (extends STS v1 generator) + customer-agent loop against live engine + transcript capture + run artifacts per keel section 5; smoke profile (12 trajectories) runs end to end with both replay levels working |
| sv2-002 | trajectory-judge-01 | sts2-arc-002 | Frozen grading questions T1-T6 implemented on the OpenAI ladder; gold set built from arc-001 trajectories (human-labelled/ratified); calibration battery green at the recorded threshold; judged smoke run + dashboard |
| sv2-003 | coverage-01 | sts2-arc-003 | Persona/goal template library incl. the persistent (benign repetition) persona; resurrection-seam scenarios (mid-conversation session loss + resume, exercising demo-resilience machinery); review profile (60 trajectories) with axis-coverage report and triaged findings |
| sv2-004 | closeout-01 | sts2-arc-004 | Full review-tier judged run; closeout report (findings, coverage, judge stability, cost per run); drafted decisions delivered; consistency check green |

Commit labels: `Epic: sts-v2 / Slice: <label> / Arc: <arc> /
Campaign: sts-v2-001 / Human checkpoint: campaign-closeout`.

## Contract defaults (vetoable at authorization)

- Customer role model, tiered by run purpose: `gpt-5.4-mini` for
  iteration-pool runs (helm tuning, no receipts); `gpt-5.5` for graded,
  receipt-producing runs. Arc-001 A/B (one smoke run per model,
  persona-holding judged) may downgrade the graded default to mini only if
  empirically indistinguishable; selection recorded as a dated line here.
  Judge ladder unchanged (`gpt-5.4-nano` / `gpt-5.4-mini` / `gpt-5.5`).
  OpenAI only, per mandate.
- Cost ceilings (machine-checked from run usage receipts, not estimated):
  per-review-run customer+judge spend <= $10; whole-campaign customer+judge
  spend <= $40. Exceeding either is a stop condition. Estimates behind the
  ceilings use the repo price table (checked against OpenAI pricing docs
  2026-06-15); the receipts record actuals.
- Graded-run budget: one judged smoke (arc-002), two review runs
  (arc-003, arc-004), one stability repeat (arc-004). Judge stability is
  reported as a single-repeat observation, labelled as such.
- Default turn cap 12; profiles: smoke 12 trajectories, review 60. The
  soak profile (180) on `gpt-5.5` is out of scope; at most one mini-only
  soak sweep, and only if the campaign ceiling accommodates it.
- Customer-agent prompts structure the persona brief and conversation
  prefix for input-cache reuse.
- Customer-agent prompts, persona wording, patience calibration, and
  sampling weights are helm territory within the keel (iterated freely,
  committed as code, no card amendment needed).

## Write scope

`packages/core/src/stochastic/` (v2 additions), new simulator/judge modules
under `packages/core/src/`, `scripts/`, `justfile` recipes, `docs/roadmaps/`,
`docs/prds/` (this card's amendments), `artifacts/`. No changes to the
engine, planner, validator, prompts, Hell Week scenarios, or the
deterministic floor checks.

## Non-Goals / Preserved Human Gates

- No engine or prompt changes. Findings feed the bounded tuning loop as
  input; acting on them is separate, gated work.
- No concierge-surface trajectories (D045/D047 measurement posture stands;
  a concierge extension is a closeout follow-up question, not scope).
- No multilingual scenarios. The non-English posture is a genuine product
  decision; a drafted D-entry (language posture: graceful English-only
  handoff vs. in-scope support) is delivered during arc-003, and only
  slices depending on it block.
- No distribution grounding from live transcripts (pre-demo data too thin;
  named follow-up campaign candidate at closeout, with the D049 turn-log
  harvest as its expected data source).
- No changes to the hard floor's five dimensions (keel section 4).
- All campaign-protocol irreducible human gates in force.

## Proof Bar

- sts2-arc-001: smoke run against the live engine completes with full keel
  section 5 artifacts; `regenerate` and `regrade` both demonstrated;
  customer-model A/B run (one smoke per model) archived with per-run usage
  receipts confirming the ceilings are realistic; `just verify`;
  consistency check green.
- sts2-arc-002: calibration green at the recorded threshold for every
  grading question before any judged result is reported; judged smoke run
  archived with receipts.
- sts2-arc-003: review run covers every axis value at least once and every
  v2 persona (incl. persistent) and the resurrection seam; findings triaged
  into the STS finding-category pattern.
- Campaign close: review-tier judged run archived; closeout report claims
  only receipt-backed results; judge stability across a repeat run reported
  (not asserted); consistency check green.

## Stop Conditions

Campaign-protocol stop conditions, plus:

- The customer simulator cannot hold persona at an acceptable rate
  (role inversion, incoherence, leaking its instructions) after bounded
  prompt iteration - report the instability rather than shipping a battery
  that measures the simulator instead of the engine.
- Judge calibration cannot reach the recorded threshold after gold-set
  review - stop and surface; the bar is not lowered to pass.
- Measured customer+judge spend exceeds $10 on any review run, or $40
  cumulative across the campaign (from usage receipts, not estimates).
- Any pressure to amend the keel mid-arc without a dated card amendment.

## Amendments

(dated lines added here by the human or with their ruling; none yet)
