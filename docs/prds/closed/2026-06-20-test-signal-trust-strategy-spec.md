# Trustworthy Test-Signal Strategy Spec

## Status

Draft. Umbrella/index doc. Holds the north-star definition, the sequencing across
the test-trust work streams, and the "do not build" list. It links to the
owning docs rather than duplicating their detail.

## Practical Takeaway

A Hell Week run can be trusted as thorough when four layers hold, in order of
current weakness:

1. **A calibrated authoritative grader** — the judge is measured against known
   answers, not assumed correct.
2. **A noise model** — a run is a band across repeated runs, so a regression is
   distinguishable from jitter.
3. **A proof the grader fires** — a mutation probe shows the harness fails when it
   should.
4. **Coverage that names its own gaps** — broad scenarios plus explicit "not
   covered" reporting, no silent holes.

The project is strong on raw coverage and already has the noise and comparability
infrastructure built. The missing layer is calibration and proof. So the path to
trustworthy signal runs through the grader first, then the noise model, then
test-the-tests, and only then targeted coverage. Bulk scenario-adding is last and
small.

## Why This Order

The most useful audit finding was negative: coverage is not the problem. Every
stakeholder dimension already has at least 7 scenarios; every safety-floor
dimension has 9-12. The reason a green run cannot yet be trusted is that the
authoritative grader has never run and is unmeasured, the run unit is a single
noisy sample, and nothing proves the grader catches the paraphrases it is known
to miss. More scenarios do not fix any of those.

## Work Streams And Owning Docs

| Layer | Work | Owning doc |
|---|---|---|
| Grader calibration + proof | Gold set, default judge, version-pin, symmetric re-check, confidence, de-anchor, mutation probe, verdict gate | [judge-trustworthiness PRD](./2026-06-20-hell-week-judge-trustworthiness-prd.md) |
| Noise model | Comparability warnings, pass-band / noise-floor into the regression decision, planner-latency capture, stability as the default trust unit | [measurement-integrity PRD](./2026-06-20-hell-week-measurement-integrity-sequential-runway-prd.md) |
| Coverage | Slow-boil, linguistic false-positive, indirect injection scenarios; regression-capture loop | [coverage-expansion spec](./2026-06-20-hell-week-coverage-expansion-spec.md) |
| Acceptance bar | What "acceptable for a customer-facing agent" means and where the build sits | [acceptance spec](./2026-06-20-customer-facing-agent-acceptance-spec.md) |
| Regression question | Whether the apparent 80/80/79 drop was real | [regression-analysis PRD](./2026-06-20-hell-week-performance-regression-analysis-prd.md) |

## Recommended Sequence

1. **Grader first.** Build the gold set and make the judge the default grader
   (judge-trustworthiness PRD, items 1-2). Until the judge has a reliability
   number, every other trust mechanism rests on an unmeasured arbiter.
2. **Noise model.** Pass-band into the compare regression decision and stability
   as the default unit (measurement-integrity PRD). This stops a jittery run from
   reading as a regression — the failure that started this worktree.
3. **Test the tests.** The mutation probe and judge-catch-rate number
   (judge-trustworthiness PRD, item 7). Quantifies how much the judge compensates
   for the known hard-floor regex blind spots.
4. **Targeted coverage.** The three absent attack shapes (coverage-expansion
   spec). Worth adding because they are exactly where a calibrated judge earns its
   keep over the deterministic envelope.
5. **Capstone gate.** `ship_ready` requires judged + safety-floor graded, then
   gold-agreement and within-noise (judge-trustworthiness PRD, item 8). Converts
   the verdict from "asserted thorough" to "mechanically cannot go green without
   evidence."

## Do Not Build (rejected approaches)

These were considered and rejected during the audit as over-engineering or
false-confidence traps; recording them so they are not re-proposed:

- A `CompositeTestGate` spanning Hell Week + stochastic + persona. The three use
  incompatible verdict vocabularies (persona has none); it manufactures brittle
  translation glue. Keep only its useful core — "make judged the default."
- Porting stochastic's coverage report to Hell Week as a verdict gate, or a
  13-dimension x 7-content-check matrix gate. Dimensions have no calibrated
  expected count, so the gate fires on nothing or invents false dents on
  structurally-empty cells. A read-only panel is acceptable; a gate is not.
- A bidirectional Hell-Week-dimension <-> stochastic-intent taxonomy mapping.
  Large effort, mismatched taxonomies, requires labeling ~110 scenarios. The
  durable loop is one-directional: promote a found failure into a scenario.
- Relabeling a scenario outcome as "noise" because latency was high. Timing and
  outcome are independent; this manufactures false confidence.
- Dimension-presence checks presented as evidence of thoroughness. They pass
  trivially today and measure nothing about verdict trustworthiness.
- Auto-gating pass/fail on judge confidence. Surface low confidence for human
  review; do not gate on it.

## The One-Line Test

A test signal is thorough and trustworthy when its coverage names its own gaps,
its authoritative grader is calibrated against known answers, it carries a noise
model, and there is a proof the grader fails when it should. Today the project
has the first and third in hand and is missing the calibration and the proof —
which is exactly the grader work, sequenced first.
