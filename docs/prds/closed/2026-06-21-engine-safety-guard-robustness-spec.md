# Spec: Engine Safety-Guard Robustness (Arc Workstream W3)

## Status

Draft for triage. Implements workstream **W3** of
[`2026-06-21-judge-trust-release-candidate-arc-prd.md`](./2026-06-21-judge-trust-release-candidate-arc-prd.md).

Net-new: the existing judge/coverage/measurement docs are about the grader and the
scenarios. This spec is about the **engine's deterministic safety guards** added
after the judge (`757e5e9`, `6e77453`, `62d2353`) — whether they generalise or
overfit, and the one confirmed regression they introduced.

## Practical Takeaway

The post-judge guards cleared the verified demo-killers, but two are worth fixing
and one claim about them is wrong. The confirmed problems are small and cheap: a
false-positive escalation on negated crisis language, and no regression lock for
the guards. Fix those now. The larger "replace crisis regex with an LLM
classifier" idea is real but must wait for a labelled set (W2), because you cannot
prove a classifier beats the regex without one. Do **not** rewrite the
credential/payment/borrowing guards — they are already verb-agnostic intent
predicates; only add fixtures.

## Problem Statement

Findings, with the over-claims from the raw review corrected:

1. **Confirmed false positive: negated crisis language force-escalates.**
   `detectUrgentRisk` (`engine.ts:802`) fires `self_harm` on "I am not suicidal but
   I am stressed," and `negatesSelfHarm` (`engine.ts:824`) only covers
   "(not|never) ... kill/harm/hurt myself" — it does not cover "not suicidal."
   `buildUrgentSafetyFragment` (`engine.ts:613`, called at `:389`) then overrides
   to an irreversible "contact emergency services" escalation. A customer
   *reassuring* the bot they are not at risk gets crisis copy. This is a real,
   jarring regression and is cheap to fix.

2. **Crisis paraphrases get weaker copy, not zero escalation (claim corrected).**
   The raw review claimed paraphrased crises "the engine never escalates." That is
   false. The LLM signal extractor and planner already route emotional distress to
   a human handoff upstream of the regex, and the validator routes any
   vulnerability flag to handoff. The regex's *unique* contribution is the stronger
   emergency-services signposting copy (`engine.ts:613-620`). So the real gap is
   **weaker copy on paraphrased crises**, not a missed handoff. `detectUrgentRisk`
   is keyword-bound and the medical arm encodes the literal Hell Week string
   ("chest pain ... hospital", `categoryA.ts`), so paraphrases like "I feel like I
   am dying" get handoff-without-emergency-signposting.

3. **No regression lock for the guards.** `policy.test.ts` does not exist. There is
   no adversarial paraphrase suite asserting current guard behaviour, so any future
   edit to the guards (including this spec's) can silently regress them.

4. **Credential/payment/borrowing guards are NOT verbatim overfit (claim
   corrected).** These live in `policy.ts` as verb-agnostic intent predicates with
   proximity windows and negation suppression
   (`detectCredentialBoundaryRequest`/`detectPaymentLinkRequest`/
   `detectSecondaryBorrowingAdviceRequest`). The `categoryG`/`categoryH` strings
   the raw review cited are *scenario definitions*, not production matchers. These
   guards are ~80% done; rewriting them risks regressing a working surface. They
   need fixtures, not a rewrite.

## Work Items

### W3a (do now, cheap, no dependencies)

#### W3a.1 Fix the negated-crisis false positive

- Extend `negatesSelfHarm` (`engine.ts:824`) to cover "not/never suicidal" and
  "not going to (self-harm|hurt myself|end it)" forms so reassurance does not force
  an emergency escalation.
- Keep the guard conservative: a genuine ambiguous statement should still
  escalate. Only clearly-negated reassurance should suppress.
- Acceptance: a focused `engine.test.ts` case asserts "I am not suicidal but I am
  stressed" no longer returns `finalAction: escalate` with emergency copy, while a
  genuine self-harm statement still does.

#### W3a.2 Add `policy.test.ts` adversarial paraphrase fixtures

- Create `packages/core/src/policy.test.ts` (or co-located) with an adversarial
  paraphrase fixture set spanning crisis (self-harm, medical), credential offers,
  payment-link requests, and secondary-borrowing advice.
- Assert **current** behaviour, including the known misses, so the file is an
  honest map of guard coverage, not a green rubber stamp. Where a paraphrase is a
  known miss, assert the miss and label it `// known gap: covered by judge` — do
  not tighten the regex just to make the fixture pass (the anti-pattern the
  measurement runway warned about).
- This file is the regression lock W3a.1, W3b, and the W2 mutation probe all build
  on.
- Acceptance: the suite runs in `npm test`; each fixture states whether the guard
  catches it and which layer (regex vs judge) is expected to carry it.

### W3b (do after W2's labelled set exists)

#### W3b.1 Decide and (if chosen) build a crisis-detection classifier

- Evaluate moving urgent self-harm/medical detection from the keyword regex to a
  cheap `gpt-5.4-nano` classifier, with the regex retained as a **never-downgrade**
  backstop (the classifier may only *add* escalations; on timeout/error it must not
  suppress the regex).
- Gate the decision on the W2 labelled paraphrase set: only adopt the classifier
  if it measurably beats the regex on the missed-paraphrase arm and its
  false-positive rate is bounded (an over-firing classifier produces spurious
  emergency copy).
- Honest dependency: this puts a blocking LLM call on the crisis path; keep it
  bounded and OpenAI-only per the provider mandate. If the measured win is small,
  the correct outcome is to keep the regex + handoff and improve only the
  paraphrased-crisis copy.
- Acceptance: a documented decision (adopt / reject) backed by the labelled-set
  numbers; if adopted, the classifier never downgrades the regex and a judged run
  shows improved emergency signposting on paraphrased crises with no new
  over-escalation.

## Testing Decisions

- W3a is provable by focused unit tests plus the new paraphrase suite; that is
  enough to land it.
- W3b's claim ("classifier beats regex") is only provable against the W2 labelled
  set plus a judged run, per repo evidence discipline. Do not adopt the classifier
  on unit evidence alone.
- Do not rewrite the credential/payment/borrowing predicates; add fixtures only.

## Acceptance Criteria

- "I am not suicidal but I am stressed" no longer triggers emergency escalation; a
  genuine self-harm statement still does (unit-pinned).
- `policy.test.ts` exists, runs in `npm test`, and honestly records guard coverage
  including known misses by layer.
- The crisis-classifier decision is documented and, if adopted, is a
  never-downgrade backstop validated against the W2 labelled set and a judged run.
- The credential/payment/borrowing predicates are unchanged except for added
  fixtures.

## Out Of Scope

- The judge gold set, de-anchoring, and mutation probe — W2.
- Encoding the stability gate / running the x3 — W4.
- New scenarios for slow-boil / linguistic / injection shapes —
  [`2026-06-20-hell-week-coverage-expansion-spec.md`](./2026-06-20-hell-week-coverage-expansion-spec.md).
- Refactoring `validateTurnPlan` / `handleRequest` god-functions (stable, cooling,
  off the critical path).

## References

- [`2026-06-21-judge-trust-release-candidate-arc-prd.md`](./2026-06-21-judge-trust-release-candidate-arc-prd.md)
  — the arc; W3a runs in parallel with W1 now.
- [`2026-06-21T090837Z-hell-week-openai-judge-and-safety-runway.md`](./2026-06-21T090837Z-hell-week-openai-judge-and-safety-runway.md)
  — the guards this spec hardens were added under that runway.
- [`2026-06-20-customer-facing-agent-acceptance-spec.md`](./2026-06-20-customer-facing-agent-acceptance-spec.md)
  — the safety-floor definitions the guards serve.
