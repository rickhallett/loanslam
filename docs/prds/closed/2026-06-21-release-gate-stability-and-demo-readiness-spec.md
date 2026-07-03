# Spec: Release-Gate Stability Proof And Demo Readiness (Arc Workstream W4)

## Status

Draft for triage. Implements workstream **W4** of
[`2026-06-21-judge-trust-release-candidate-arc-prd.md`](./2026-06-21-judge-trust-release-candidate-arc-prd.md).

Net-new execution workstream. It operationalises the acceptance spec's
">=3 consecutive judged runs" bar and the trustworthiness PRD's verdict-gate
capstone (item 8) into runnable steps, and adds the live demo smoke and scope
freeze that no existing doc owns. This is the **last** workstream in the arc: it
earns the "safety-cleared" claim, it does not create it.

## Practical Takeaway

The "0 demo-killers" headline is one draw from a high-variance distribution. The
acceptance contract already requires the floor to hold across at least three
consecutive judged runs with no one-off breach — but the verdict tool can emit
`ship_ready` from a single run, and the only x3 stability set predates the fixes.
W4 closes both: teach `aggregate.ts` to refuse `ship_ready` without a clean
stability input, run a fresh post-fix judged x3, then smoke the live demo before
sharing any URL. Sequence this after W1, the W3a floor fixes, and the W2 keystone,
or you spend paid runs reconfirming a known-blocked state.

## Problem Statement

Verified gaps between the current state and a defensible release claim:

1. **The verdict gate has no stability input.** `buildVerdictDecision`
   (`aggregate.ts:342`) returns `ship_ready` (`:393`) from a single judged run
   with zero dents and zero demo-killers. The acceptance spec's repeated-run
   requirement lives only in prose. A future lucky single run could be
   auto-labelled `ship_ready`.
2. **Floor "holding" is a weaker bar than the spec.** `breached =
   floorDemoKillers.length > 0` (`aggregate.ts:234`, `:274`) — dents in floor
   dimensions do not count. (The redefinition itself is W1.4; W4 consumes it in
   the stability verdict.)
3. **No post-fix x3 exists.** The current candidate is a single judged run; the
   only x3 (`hell-week-stability-x3-2026-06-21T0758Z`) is pre-fix and graded
   `blocked`, with a one-off demo-killer. `hell-week-stability` only *aggregates*
   existing runs (`cli.ts:142`, `--runs`/`--from-db`); it does not execute the
   engine or judge, so a fresh x3 means 3 paid full runs + 3 judge passes.
4. **The live demo path is built but never exercised end-to-end with the real
   engine.** The display boundary, sealed state token, access gate, and Vercel
   wiring are committed and unit-tested with a fake planner; no test or smoke runs
   the real OpenAI engine through the display boundary. A deploy/env/token
   regression would pass CI and fail live in front of stakeholders.
5. **Effort is leaking into out-of-Phase-0 surfaces.** ~29k lines of
   site/apply/login/marketing work landed on 2026-06-20 while the gate stalled.
   `CONTEXT.md` defers these; the demo-safe PRD lists them out of scope. The team
   has already pivoted back, so this is a cheap freeze to make the pivot explicit.

## Work Items

### W4.1 Encode the stability bar into the verdict

- Add a stability-level verdict that consumes a >=3-run judged stability set and
  refuses `ship_ready` (downgrade to `needs_work`) unless: zero demo-killers in
  **all** runs, and no safety-floor one-off or recurring failure (using W1.4's
  dent-aware floor definition).
- Keep `demo_killer => blocked` immovable; add the stability conditions only as
  `ship_ready -> needs_work` downgrades so the gate never weakens.
- Read the actual threshold numbers from the acceptance spec once ratified; do
  **not** hard-code unratified numbers. Until ratification, the gate enforces the
  *shape* (>=3 clean runs, dent-aware floor) and treats the counts as
  configuration.
- Mirror the reason-listing structure stochastic uses (`buildVerdictReasons`) so
  each downgrade prints why.
- This is trustworthiness PRD item 8's second half, gated behind its W1/W2
  prerequisites.
- Acceptance: a unit test proves a single clean judged run can no longer reach
  `ship_ready`; a >=3-run clean stability input can; any one-off floor failure in
  the set downgrades it.

### W4.2 Run a fresh post-fix judged x3 and gate on it

- After W1, the W3a floor fixes, and the W2 keystone land, capture 3 fresh judged
  full runs on the current build and aggregate them with `hell-week-stability`.
- Treat the **stability report**, not any single run, as the candidate verdict.
  Inspect every `one_off_failure`/`recurring_failure` that touches a safety-floor
  dimension.
- Honest expectation: the prior x3 had recurring/one-off floor dents across
  multiple floor dimensions; under W1.4's dent-aware floor this may grade short of
  clean even with zero demo-killers. That is the correct, informative outcome — it
  tells you whether the floor genuinely holds or just lacked a demo-killer by luck.
- Record the run as a progress receipt with the exact reproducing command list, per
  house discipline.
- Acceptance: a captured x3 stability artifact exists for the post-fix build, its
  verdict is read through W4.1's stability gate, and the receipt names the runs and
  commands.

### W4.3 Live demo smoke before any URL share

- Add a documented (and where feasible scripted) live smoke of the five critical
  paths through the **deployed** demo, with the post-fix engine and the real
  display boundary: a public-FAQ deflection, an account-specific handoff, a
  vulnerability/distress route, a credential refusal, and a topic reset.
- This catches deploy/env/token/display-boundary issues the fake-planner unit
  tests cannot. It is the demo-safe PRD's already-stated pre-share criterion, made
  enforceable.
- Run it **only after** W4.1/W4.2 show the engine clears the gate; smoking an
  un-gated engine manufactures false demo-safe confidence.
- Acceptance: a smoke checklist/script exists; a passing run is recorded against a
  specific deploy before any external URL is shared; required secrets
  (`OPENAI_API_KEY`, demo state-token secret, access token) are rendered from
  encrypted secrets, never a stale `.env`.

### W4.4 Freeze the demo surface

- Record an explicit owner decision to park further site/apply/login/marketing
  work until the gate is proven, consistent with `CONTEXT.md` and the demo-safe
  PRD scope. The demo delivery path is already built and tested; further polish
  does not move release-readiness.
- This is prose, not engineering — a cheap guard against runway leakage.
- Acceptance: the freeze is recorded (here or in the decision log) with the
  rationale; new site/apply work is treated as out of arc scope.

## Testing Decisions

- W4.1 is unit-provable; do it before spending on W4.2.
- W4.2 is the integration proof surface for the whole arc; a single run is not
  acceptable as the release verdict per the acceptance spec.
- W4.3 is live-only by design; mocked tests cannot prove the deployed boundary.
- Do not present a single green run, or unit/mock tests, as the gate. The gate is
  the stability report read through W4.1.

## Acceptance Criteria

- `aggregate.ts` cannot emit `ship_ready` without a clean >=3-run judged stability
  input; a single clean run downgrades to `needs_work` (unit-pinned).
- Floor "holding" counts dents (via W1.4) in the stability verdict.
- A fresh post-fix judged x3 is captured and read through the stability gate, with
  a reproducing-command receipt.
- A live demo smoke of the five critical paths passes against a specific deploy
  before any URL share, with secrets rendered from the encrypted store.
- The site/apply/login scope freeze is recorded as an owner decision.

## Out Of Scope

- Building the gold set / de-anchoring / mutation probe / symmetric re-check — W2,
  owned by
  [`2026-06-20-hell-week-judge-trustworthiness-prd.md`](./2026-06-20-hell-week-judge-trustworthiness-prd.md).
- The correctness/provenance seams (rubric hash, label unification, floor-dent
  *definition*) — W1.
- Engine guard fixes — W3.
- Ratifying the threshold numbers and choosing the launch rung — owner/compliance,
  per
  [`2026-06-20-customer-facing-agent-acceptance-spec.md`](./2026-06-20-customer-facing-agent-acceptance-spec.md).
- Production rollout mechanics, infrastructure, and monitoring.

## References

- [`2026-06-21-judge-trust-release-candidate-arc-prd.md`](./2026-06-21-judge-trust-release-candidate-arc-prd.md)
  — the arc; W4 is its final, gating workstream.
- [`2026-06-20-customer-facing-agent-acceptance-spec.md`](./2026-06-20-customer-facing-agent-acceptance-spec.md)
  — the >=3-run stability bar and two-bar model this spec enforces.
- [`2026-06-20-hell-week-judge-trustworthiness-prd.md`](./2026-06-20-hell-week-judge-trustworthiness-prd.md)
  — item 8 (verdict gate) whose stability half lands here.
- [`2026-06-16-stakeholder-demo-safe-display-boundary-prd.md`](./2026-06-16-stakeholder-demo-safe-display-boundary-prd.md)
  — the built demo delivery path W4.3 smokes.
