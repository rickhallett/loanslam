# PRD: Phase 0 Cheap Model Quality Probe

## Problem Statement

The post-Iteration-1 Hell Week trifecta produced a richer stability dataset without
justifying a full 3x3 model matrix yet. A full matrix across planner and signal
models would be expensive relative to the current uncertainty because many dents
are nondeterministic at the scenario level.

The next agent needs a cheaper procedure that gives directionality on model quality
at the signal and planner layers without treating one-off Hell Week dents as stable
truth.

## Goal

Identify whether model size is likely to matter for:

- signal extraction quality
- planner quality on stable dents
- signal/planner interaction

Do this before running any full Hell Week trifecta matrix.

## Baseline Artifacts

Confirm these artifacts exist before starting:

- `artifacts/phase0/hell-week-full-2026-06-16T06-25-23-998Z`
- `artifacts/phase0/hell-week-full-2026-06-16T07-29-14-032Z`
- `artifacts/phase0/hell-week-full-2026-06-16T07-47-56-459Z`
- `artifacts/phase0/hell-week-iteration-1-stability-2026-06-16.html`

## Stable Dent Set

Use these 10 failed-3/3 scenarios from the Iteration 1 trifecta:

- `vague-angry`
- `faq-apply-online-hostile`
- `vuln-direct-threat`
- `intake-one-field-at-time`
- `neg-correction-public`
- `neg-ticket-cant`
- `inj-intake-field`
- `signal-outdomain-null`
- `ux-angry-customer`
- `ux-ticket-reference`

## Procedure

### 1. Confirm The Evidence Boundary

- Treat existing full Hell Week artifacts as evidence inputs.
- Do not start a full 3x3 planner/signal trifecta matrix.
- Do not tune prompts, retrieval, validator rules, or scenarios during this probe.
- Keep model comparison separate from behavior fixes.

### 2. Build A Signal-Only Replay Probe

Use one existing full Hell Week artifact as the fixed input source.

For each turn context, run only the `SignalExtractor`; do not call the planner.
Test these signal models:

- `gpt-5.4-nano`
- `gpt-5.4-mini`
- `gpt-5.4`

Score each model against expected serving mode and safety flags where the scenario
contract provides them.

Report per signal model:

- agreement count
- route miss count
- safety miss count
- top changed scenario IDs
- examples where mini/full fixes nano
- examples where mini/full regresses nano

### 3. Decide Whether Signal Model Size Matters

Keep signal at nano if mini/full does not materially improve agreement on hard
cases.

Mark a signal candidate only when it clearly improves stable dents or safety flags
without adding obvious regressions.

Do not promote a signal model from aggregate movement alone. Inspect scenario IDs.

### 4. Build A Planner-Only Stable-Dent Probe

Use only the 10 stable-dent scenarios.

Hold the signal model constant, preferably current `gpt-5.4-nano`.

Run each scenario once through the normal `processTurn` path with these planner
models:

- `gpt-5.4-nano`
- `gpt-5.4-mini`
- `gpt-5.4`

Write one run folder per planner model.

### 5. Score The Planner Probe

For each planner model, report:

- pass count out of 10
- dents remaining
- demo-killers
- safety floor status for applicable scenarios
- stable dents fixed
- stable dents remaining
- any new worse behavior inside those scenarios

### 6. Decide Whether Planner Model Size Matters

If mini/full fixes several failed-3/3 dents without introducing safety issues,
planner model quality is likely a bottleneck.

If all three planner models fail roughly the same scenarios, the issue is likely
prompt, policy, retrieval, or state design rather than model size.

If full helps only marginally over mini, prefer mini for follow-up testing.

### 7. Run Interaction Probes Only If Needed

Only run interaction probes if the signal-only or planner-only probes identify a
plausible candidate.

Pick the best planner candidate from the planner probe and run the same 10 stable
dents with:

- best planner + nano signal
- best planner + mini signal
- best planner + full signal

Add 8 recurring failed-2/3 dents only if the 10 stable dents show meaningful
movement.

## Stop Rules

- Stop immediately on any demo-killer.
- Stop expanding the matrix if signal-only differences are small and planner-only
  differences are small.
- Do not run full Hell Week trifectas until a cheap probe identifies a plausible
  winning configuration.
- Do not treat one-off dents as tuning targets.

## Final Report Format

Start with the recommended next model config, confidence, and reason.

Include three tables:

- signal-only model comparison
- planner-only stable-dent comparison
- scenario-level fixed/remained/regressed matrix

Separate:

- stable evidence
- directional evidence
- speculation

End with one clear next action:

- keep nano
- test mini planner
- test full planner
- test a specific signal/planner pair
- stop model-sweep work and tune prompts/retrieval/state handling

## Out Of Scope

- Full 3x3 Hell Week trifecta matrix.
- LLM judge pass.
- Prompt, validator, retrieval, or scenario tuning.
- Production widget, production API, persistence, ticket webhook, or real PII
  handling.
