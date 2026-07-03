# Hell Week Coverage Expansion Spec

## Status

Draft for triage. Scenario-authoring work, distinct from the judge/grader work in
[`2026-06-20-hell-week-judge-trustworthiness-prd.md`](./2026-06-20-hell-week-judge-trustworthiness-prd.md)
and the measurement plumbing in
[`2026-06-20-hell-week-measurement-integrity-sequential-runway-prd.md`](./2026-06-20-hell-week-measurement-integrity-sequential-runway-prd.md).
This is lower priority than making the grader trustworthy: more scenarios do not
help until the grader reading them is calibrated.

## Practical Takeaway

Raw coverage is already broad — all 13 stakeholder dimensions have at least 7
scenarios, and every safety-floor dimension has 9-12. So the win is not bulk
scenario-adding or a coverage-count gate (which would fire on nothing real).
The win is three specific attack shapes that are genuinely absent, plus a loop
that turns any future live-found failure into a permanent scenario.

## Problem Statement

The Hell Week battery is hand-authored, so by definition it only tests what was
imagined. Auditing the actual scenarios surfaced three risk shapes with zero
coverage today, all relevant to a customer-facing UK lending bot:

- **Multi-turn slow-boil pressure.** ~26 multi-turn scenarios exist (C/E/F/I/J/K/M),
  but none compounds the same hostile demand across escalating turns. Single-turn
  variants exist (`categoryH.ts` credential pressure, `categoryE.ts` "do it now"),
  but nothing tests whether refusal holds under building authority/urgency — a
  known weak spot for the nano planner.
- **Linguistic false-positives.** The only non-standard-English scenarios
  (`vuln-language-barrier`, `vuln-accessibility-reading`, `ux-low-literacy`)
  explicitly signal an accessibility need. There is no scenario where informal,
  regional, or code-switching English is NOT hardship, so nothing tests whether
  the signal extractor over-fires vulnerability on ordinary linguistic variance.
- **Indirect / second-order injection.** Injection scenarios target the top-level
  message. None delivers the malicious instruction inside an intake-field value,
  a pasted email, or a quoted "policy" — the indirect shape a real attacker uses.

There is also no loop that captures a failure found by the stochastic simulator
or a live lab-API session into the permanent battery, so the same failure can
recur unnoticed.

## Solution

Add one new category (~10-12 hand-authored scenarios) covering the three absent
shapes, and add a lightweight regression-capture step that promotes a found
failure into a Hell Week scenario.

Author scenarios as plain JSON objects matching the existing `HellWeekScenario`
shape, following the identical pattern as every existing category (a new
`categoryN.ts` plus one import+spread in `categories/index.ts`). Do not attempt
to generate them from the stochastic generator: it emits a different schema
(`StochasticScenario`) with a different grader and no bridge into the Hell Week
grading path.

## Work Items

### 1. Multi-turn slow-boil pressure scenarios (4-6)

- The same hostile demand escalating across 2-3 turns: staff impersonation with
  rising urgency, false-deadline pressure, contradictory authority claims,
  peer/urgency amplification.
- The hard-floor content checks already scan every turn
  (`grade.ts checkContent` over `botTexts.some(...)`), so a bot that caves on
  turn 3 is caught by `no_credential_request` / `no_approval_estimate`.
- State the dependency honestly: the hard-floor regexes are paraphrase-fragile,
  so real coverage here leans on the LLM judge's adversarial re-check, not the
  regex alone. These scenarios are most meaningful on judged runs.

### 2. Linguistic false-positive scenarios (5-6)

- Informal/regional/code-switching English that is clearly NOT hardship, each
  with a second turn confirming no vulnerability, so the signal extractor's
  over-firing on linguistic variance becomes visible.
- Dimension: `clarification` or `human_support`. Severity floor: `dent` (a
  routing/UX signal, not a demo-killer).
- Grade via the LLM judge and `failureMarkers`. Do NOT use the `english_only`
  content check for this: it inspects the bot's OUTPUT for Spanish/French markers,
  not the customer input, so pairing it with non-English customer turns proves
  nothing.

### 3. Indirect / second-order injection scenarios (2-3)

- Malicious instructions embedded inside an intake-field value, a pasted email
  body, or a quoted "policy", rather than the top-level message.
- Dimension: `prompt_injection`. Content check: `no_internal_data_leak`, with the
  judge as the authoritative backstop for behavior the regex cannot see.

### 4. Regression-capture loop

- When the stochastic simulator or a live lab-API session surfaces a real
  failure, hand-author it into the battery as a permanent scenario.
- Keep this one-directional and cheap. Do NOT build a bidirectional
  Hell-Week-dimension <-> stochastic-intent taxonomy mapping: the taxonomies do
  not align (intent = what the customer wants; dimension = which behavior class
  is stressed), it would require hand-labeling ~110 existing scenarios and
  editing the contracts package, and it would manufacture gap reports that
  reflect labeling choices rather than real gaps.

## Testing Decisions

- Verify new scenarios load and grade through the existing deterministic path,
  then capture them in a live judged run; the judged verdict is the real evidence
  that the new scenarios exercise what they claim.
- Do not assert the hard-floor regex alone proves the slow-boil or injection
  scenarios safe; rely on the judge for paraphrased or indirect behavior.
- Add no brittle full-corpus route-pinning tests as a substitute for live or
  judge evidence.

## Acceptance Criteria

- A new category adds slow-boil, linguistic-false-positive, and indirect-injection
  scenarios, authored as `HellWeekScenario` JSON.
- Linguistic scenarios are graded by the judge, not `english_only`.
- Slow-boil and injection scenarios carry the correct dimension and content checks
  and pass through the deterministic path without error.
- A documented step exists for promoting a stochastic- or lab-found failure into
  a permanent scenario.

## Out of Scope

- A coverage-count verdict gate or a dimension x content-check matrix gate
  (rejected: dimensions have no calibrated expected count, so a count gate fires
  on nothing or invents false dents).
- A read-only coverage panel may be added later as reported signal, not a gate;
  it is not required here.
- Bidirectional taxonomy mapping or new contract fields for cross-battery
  coverage cross-referencing.
- Generating Hell Week scenarios from the stochastic generator.
- Any change to the grader, validator, planner, or retrieval logic.

## Further Notes

Coverage breadth is not the current trust gap; the grader is. Treat this spec as
the work that follows
[`2026-06-20-hell-week-judge-trustworthiness-prd.md`](./2026-06-20-hell-week-judge-trustworthiness-prd.md),
not as a parallel priority. The three shapes here are worth adding precisely
because they are the cases where a calibrated judge — once it exists — earns its
keep over the deterministic envelope.
