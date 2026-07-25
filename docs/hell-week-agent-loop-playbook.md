# Hell Week Agent Loop Playbook

## Practical Takeaway

Use this loop when Phase 0 needs sustained engine tuning: capture Hell Week
evidence, judge the real customer-visible behavior, choose one failure cluster,
patch one bounded slice, rerun the same battery, compare before/after reports, and
repeat only while the evidence is improving. The outer controller owns the loop;
subagents may code or verify bounded slices, but they do not independently decide
what counts as progress.

This is offline evaluation and tuning. It is not production self-learning, online
model adaptation, or an agent changing customer behavior without review.

## Control Surface

Primary commands:

```bash
just hell-week -- --profile smoke --store-db
just hell-week -- --store-db
just hell-week-compare -- <baseline-run-dir-or-report.json> <candidate-run-dir-or-report.json>
```

Live Hell Week captures must have `HELL_WEEK_DATABASE_URL`,
`DEMO_INTERACTION_DATABASE_URL`, or `DATABASE_URL` set and reachable; the CLI
checks Postgres before any model calls start.

Primary artifacts:

- `report.json`: aggregate verdict, safety floor, pass rate, category/dimension
  stats, verdict reasons, top risks, grades, and evidence references.
- `evidence.json`: captured turns and traces from the live model-backed engine.
- `scenarios/<id>.json`: per-scenario packets for the LLM judge.
- `judge-verdicts.json`: independent LLM scenario verdicts when available.
- `report.html`: stakeholder dashboard.

Judging is the release-grade default. A deterministic-only run is still useful
for fast local iteration, but it is capped at `needs_work`; `ship_ready` requires
judge verdicts and safety-floor coverage. The flow is:

```bash
just hell-week -- --store-db
just hell-week-judge -- <run-dir>
just hell-week -- --from <run-dir> --judge-verdicts <run-dir>/judge-verdicts.json
```

After a candidate slice:

```bash
just hell-week-compare -- <baseline-run-dir> <candidate-run-dir>
```

Use the compare output as the loop receipt. A slice is not "better" just because a
single scenario improved. It is better when the compared report shows fewer
demo-killers, no new safety-floor breach, stable or improved pass count, and no
new failure that matters more than the fix.

## Loop Shape

```text
for each outer iteration up to the agreed bound:
  1. choose the canonical baseline report
  2. inspect top risks, triage labels, traces, and judge rationales
  3. cluster failures by likely owner: retrieval, planner prompt, validator, state, corpus, or scenario spec
  4. form one falsifiable hypothesis
  5. assign one or more bounded subagent jobs with disjoint write scopes
  6. review and integrate only coherent patches
  7. run focused local tests
  8. rerun the chosen Hell Week profile
  9. judge if needed and compare baseline to candidate
  10. commit, discard, or stop based on the comparison
```

The outer iteration must have an upper bound before it starts. Use a count of
cycles, a maximum number of candidate patches, or an explicit stop condition. Do
not run open-ended "keep trying" loops against live model APIs.

## Choosing The Battery

Use the smallest battery that can answer the current question:

- `smoke`: quick gate. Run before broader work and after risky changes.
- `full`: canonical stakeholder evidence. Use before claiming overall progress.
- Direct lab API sessions: strongest evidence for user-visible routing behavior
  when a failure depends on session state, topic switching, or visible copy.

Do not treat static tests as enough for routing quality. Unit tests are useful for
small invariants, but live model-backed traces are the evidence layer for behavior.

## Hypothesis Template

Each slice starts with one hypothesis:

```text
Failure cluster:
Evidence:
Likely owner:
Change:
Expected movement:
Regression risk:
Acceptance check:
Stop condition:
```

Example:

```text
Failure cluster: credential screenshot/upload copy
Evidence: full Hell Week shows cred-screenshot as demo_killer with credential_copy_gap
Likely owner: validator/policy copy, not retrieval
Change: force explicit credential-upload refusal when credential safety marker appears
Expected movement: cred-screenshot demo_killer -> pass or dent; no new account-boundary failures
Regression risk: over-refusing normal handoff intake
Acceptance check: focused unit tests, smoke, then full report compare
Stop condition: any new credential/account/prompt-injection demo_killer
```

## Subagent Protocol

Subagents are useful inside the loop, but only as bounded workers.

Outer controller responsibilities:

- choose the baseline and candidate reports;
- decide the active failure cluster;
- assign disjoint write scopes;
- review patches before integration;
- run or request the canonical comparison;
- decide whether the slice is commit-worthy.

Worker responsibilities:

- own a narrow file/module set;
- assume other agents may be editing nearby code;
- never revert unrelated edits;
- implement one hypothesis, not a general cleanup;
- run focused tests for the owned slice;
- report changed files, commands run, and remaining risk.

Verifier responsibilities:

- inspect `report.json`, `evidence.json`, and scenario packets;
- compare customer-visible behavior, not only route labels;
- flag stale runs, missing judge verdicts, or scenario-set mismatches.

Avoid overlapping writes. Good worker boundaries are usually:

- retrieval scoring and serving-mode selection;
- validator hard rules and fallback copy;
- planner prompt/schema behavior;
- conversation state and handoff/sticky-state handling;
- corpus item policy data;
- Hell Week scenario encoding and grading.

## Progress Rules

Treat these as progress:

- demo-killers decrease with no new demo-killer;
- the safety floor moves from breached to holding;
- named high-risk scenarios resolve without worse failures elsewhere;
- routing/deflection improves while credential, account, regulatory, and prompt
  injection boundaries remain stable;
- judge rationales and customer-visible copy improve, not just route labels.

Treat these as regression:

- any new credential, account-invention, approval-estimate, regulatory-advice, or
  prompt-injection demo-killer;
- safety floor changes from holding to breached;
- full report pass count rises by sacrificing hard safety;
- trace labels improve while customer-visible copy gets worse;
- scenario set changes without being called out in the comparison.

Treat these as inconclusive:

- only unjudged deterministic dents moved;
- scenario sets differ and the changed scenarios are the main evidence;
- the run used a stale lab API server or old trace schema;
- a fix passes static tests but has no live model-backed evidence.

## Stop Conditions

Stop the loop and reassess when any of these happen:

- a new safety-floor demo-killer appears;
- two consecutive candidate slices show no material comparison improvement;
- the likely fix crosses a product, compliance, or owner-language decision;
- workers need overlapping write scopes to proceed;
- the patch becomes broad enough that attribution is unclear;
- model/API cost or run budget reaches the bound set for the loop;
- evidence is stale, structurally incompatible, or missing key traces.

Stopping is not failure. It is the point where the next move needs human judgment,
a better scenario, or a smaller hypothesis.

## Commit Rule

Commit only coherent slices:

1. narrow diff;
2. focused tests pass;
3. Hell Week smoke or targeted evidence captured when relevant;
4. full Hell Week comparison captured before claiming broad progress;
5. commit message names the behavior fixed and includes the required
   co-authorship trailer.

Do not commit generated run artifacts by default. Keep them under
`artifacts/phase0/` for local review unless the user asks for an evidence bundle.

## First Safe Pilot

Use this as the first bounded run:

```text
Bound: 2 outer iterations.
Battery: smoke before each full run; full only after a focused fix passes.
Primary metric: reduce full-run demo-killers without adding any new one.
Workers: one coding worker per disjoint owner, one verifier if needed.
Human gate: required before changing corpus policy meaning or scenario rubric.
```

Choose the baseline from a fresh run folder or from a database-backed run
(`just hell-week-stability` to classify what's already persisted).

For an imported database-backed run, regenerate a report artifact first:

```bash
just hell-week -- --from-db <run-id>
```

Expected first clusters to inspect:

- emergency/self-harm/medical routing and copy;
- credential screenshot/upload copy;
- prompt injection and other-customer data refusal;
- sticky ticket/intake state;
- signal-route mismatch on hostile-but-answerable public FAQs.

Run the comparison after each candidate:

```bash
just hell-week-compare -- \
  <baseline-run-dir-or-report.json> \
  <candidate-run-dir>
```

That comparison, plus the focused test output, is the proof receipt for the slice.
