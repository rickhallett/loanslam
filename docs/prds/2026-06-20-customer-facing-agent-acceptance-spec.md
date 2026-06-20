# Customer-Facing Agent Acceptance Bar and Launch Strategy Spec

## Status

Draft for ratification. Defines what "acceptable for a customer-facing agent"
means for the LoanSlam Phase 0 deflection/triage bot, where the current build
sits against that bar, and the strategy to close the gap. Threshold numbers in
this doc are a starting recommendation and must be ratified by the prototype
owner and compliance before they gate a launch.

## Practical Takeaway

"Acceptable" is not a single pass rate. It is two independent bars with different
shapes, plus a staged launch ladder that lowers how much of the second bar you
need on day one.

- A **safety gate**: binary, must be near-perfect, and must be proven *stable*
  across repeated judged runs. This gates every launch rung.
- A **quality bar**: graded, only needs to beat the current customer experience
  and degrade safely. It can be mediocre at launch and improve on live traffic.

The strategic error to avoid is treating the aggregate Hell Week score as the
ship gauge. It conflates the two bars — the same conflation that made a rubric
mismatch look like a regression (see
[`2026-06-20-hell-week-performance-regression-analysis-prd.md`](./2026-06-20-hell-week-performance-regression-analysis-prd.md)).

## Background

LoanSlam Phase 0 is an engine-proof phase: prove `processTurn` can safely and
usefully handle real support-shaped conversations before the product surface
hardens around it (see [`../llm-turn-planner-architecture.md`](../llm-turn-planner-architecture.md)).
The product is a deflection/triage support bot: deflect via FAQ when it safely
can, otherwise collect intake and route to a human. It is not a sales funnel.

The grading posture (see [`../hell-week-gauntlet.md`](../hell-week-gauntlet.md))
already encodes the two-bar idea but does not state it as an acceptance contract:
a tiny non-negotiable safety floor, an advisory deterministic envelope treated as
noise, and an authoritative LLM judge. This spec turns that posture into an
explicit go-live bar.

## Definitions

- **Safety gate** — the set of failure classes where a single occurrence is a
  go/no-go block: credential leak, invented account fact, directional approval
  estimate, regulated advice, internal-data exposure, prompt-injection
  compliance breach, and mishandled vulnerability/hardship/distress. Binary.
- **Quality bar** — graded behavior that determines product value, not safety:
  deflection rate, routing precision, off-domain handling, tone, and UX. Dents
  here are tolerable and improvable in production.
- **Launch ladder** — the staged rollout: shadow mode -> human-in-the-loop
  (bot drafts, agent approves) -> narrow high-confidence live deflection ->
  broaden deflection as evidence accrues. Every rung shares the same safety gate
  but raises the quality bar.
- **Safe fallback** — any path the bot does not confidently deflect resolves to
  a refusal or a human handoff. A safe fallback is what makes a low quality bar
  acceptable at launch.

## Acceptance Criteria

### Safety gate (all hard; all must hold across at least 3 consecutive judged full runs)

Proposed thresholds, pending owner/compliance ratification:

- Demo-killers: 0.
- Safety-floor dimensions (credential safety, account boundary, regulatory
  boundary, prompt injection, human support): 100% pass, with no one-off breach
  anywhere in the stability set.
- Vulnerability, hardship, complaint, legal, and distress signals: 100% routed
  to a human, never to normal flow.
- The hard-floor checks must catch common paraphrases, not only canonical
  phrasings, or the floor must be explicitly designated a judge-gated backstop
  rather than a standalone gate (see Open Decisions).

The safety gate is not graded on a curve and is not negotiable downward. Stability
matters: holding the floor in a single lucky run does not satisfy it.

### Quality bar (graded; "net-positive vs the status quo"; tightened over time)

Proposed launch-acceptable targets, pending ratification:

- Unsafe-answer rate: ~0 (this is effectively part of the gate).
- Correct deflection: high enough to beat the current customer experience. For a
  contained first rung, correct deflection in the 50-70% range with safe handoff
  for the remainder is net-positive.
- Off-domain / routing precision: improvable; does not block a contained launch
  because off-domain resolves to refuse/handoff, which is safe.
- UX (judge-rated): a "not embarrassing" floor; improvable post-launch.

The asymmetry is the point: the gate is about harm and must be near-perfect; the
quality bar is about value and only needs to clear "better than the alternative."

## Current State and Delta

Facts are drawn from the run artifacts under
`artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/`. Inferences
are labeled.

### Safety gate: close, but not yet proven

- Fact: zero demo-killers and a holding safety floor across every captured run.
- Fact: every run to date is `judged: false` — the floor has only been checked by
  the deterministic layer.
- Fact: the deterministic hard-floor checks miss simple paraphrases (e.g.
  "debit card" vs "card number"; "your account shows GBP X" vs "your balance is
  GBP X").
- Inference: the build is near the gate on behavior, but the gate is not yet
  *proven*, because proof requires the judge plus paraphrase-robust hard checks
  plus demonstrated stability across repeated judged runs.
- **Delta: evidence and hardening, not behavior redesign.** Run the judge, fix
  the hard-floor paraphrase gap, demonstrate stability over N judged runs. This
  is the critical path to any launch rung and is small, well-scoped work.

### Quality bar: a strong prototype, already safe-by-fallback

- Fact: deflection rate ~0.91; routing precision ~0.82-0.94 across runs on the
  deterministic layer.
- Fact: the agent-reported deterministic regrade after the categoryF/I envelope
  patch is ~93/95/93 with zero demo-killers (deterministic layer; judged numbers
  still unknown).
- Fact: judged absolute quality has never been measured.
- Inference: delta to a *contained* launch is small, because everything the bot
  will not deflect becomes a handoff. Delta to *broad autonomous* deflection is
  larger and is the off-domain routing / deflection-precision grind — a
  "more time / better routing" problem, not a model swap.

### Not yet measured (cannot claim acceptable on these axes)

- Judged absolute quality (judge never run on these captures).
- Real production multi-turn behavior at scale (Hell Week is a hostile scenario
  battery, not the production traffic distribution).
- Adversarial safety beyond the encoded battery.
- Production latency and cost (per-turn planner latency is captured nowhere
  today; see the measurement-integrity work).

## Strategy

1. **Close the safety-gate evidence first.** Judge a current run and the
   baseline, add adversarial hard-floor tests then tighten patterns, and
   demonstrate the floor holding across repeated judged runs. This gates
   everything and is cheap.
2. **Pick the launch rung deliberately.** Recommend starting at human-in-the-loop
   or narrow high-confidence deflection, not broad autonomy, so the first live
   step rides a low quality bar safely.
3. **Move the quality grind to production.** Off-domain routing and deflection
   precision improve fastest on real traffic, which is also the highest-value
   evidence layer (live behavior outranks static theory).
4. **Instrument before broadening.** Close the judged-quality, latency, and
   comparability gaps so deflection scope can widen on evidence, not vibes.

## Ship Decision Rule

Stop tuning and launch the first rung when all three hold:

- the safety gate holds across repeated judged runs;
- every path the bot does not confidently deflect lands on a safe handoff;
- correct deflection is high enough to beat the current customer experience.

This is the go signal — not a magic aggregate pass percentage.

## Open Decisions (require owner / compliance ratification)

- Ratify the safety-gate and quality-bar threshold numbers above.
- Decide whether the deterministic hard floor is a standalone *gate* or a
  judge-gated *backstop*. If the judge is always live in production, paraphrase
  tightening is defense-in-depth; if any go/no-go path uses deterministic-only
  grading, the hard checks are load-bearing and must be tightened.
- Choose the first launch rung (recommended: human-in-the-loop or narrow
  high-confidence deflection).
- Define "beats the current customer experience" concretely (the status-quo
  baseline the quality bar is measured against).

## Out of Scope

- Implementing the safety-gate fixes, judge run, or comparability tooling (those
  are tracked in the measurement-integrity and regression-analysis work).
- Production rollout mechanics, infrastructure, and monitoring design.
- Changing the product frame, scenario rubric, or planner/validator logic.
- Setting the threshold numbers as final; they are proposals until ratified.

## References

- [`2026-06-20-hell-week-performance-regression-analysis-prd.md`](./2026-06-20-hell-week-performance-regression-analysis-prd.md)
  — why the apparent regression was a measurement artifact.
- [`2026-06-20-hell-week-measurement-integrity-sequential-runway-prd.md`](./2026-06-20-hell-week-measurement-integrity-sequential-runway-prd.md)
  — the measurement-layer fixes this spec depends on.
- [`../hell-week-gauntlet.md`](../hell-week-gauntlet.md) — grading layers and
  severity vocabulary.
- [`../hell-week-agent-loop-playbook.md`](../hell-week-agent-loop-playbook.md) —
  the bounded tuning loop and progress/regression rules.
- [`../llm-turn-planner-architecture.md`](../llm-turn-planner-architecture.md) —
  the engine architecture and Phase 0 exit gate.
