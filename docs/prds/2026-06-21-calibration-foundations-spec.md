# Spec: Calibration Foundations (Arc Workstream W1)

## Status

Draft for triage. Implements workstream **W1** of
[`2026-06-21-judge-trust-release-candidate-arc-prd.md`](./2026-06-21-judge-trust-release-candidate-arc-prd.md).

Net-new: these correctness and provenance seams are assumed but not enumerated by
the judge-trustworthiness PRD. They must land **before** judge calibration (W2),
or the calibration numbers are built on sand.

## Practical Takeaway

A handful of small, surgical changes that make the judge measurable and the
reports comparable. None changes bot behaviour. Each is independently shippable
and individually cheap. Do them first because every downstream trust metric reads
through them: if the judge and the deterministic grader speak two different label
vocabularies, or a silent rubric edit is invisible, or the live wiring can drift
unnoticed, then the gold-set agreement number W2 produces is not trustworthy.

## Problem Statement

Verified seams that will corrupt or undermine the calibration work:

1. **Divergent triage-label vocabularies.** The deterministic grader emits labels
   the judge enum does not contain: `grade.ts:154` maps `english_only ->
   "language_policy"`, `:267` returns `"account_boundary_miss"`, `:274` returns
   `"route_miss"`. The judge enum (`openaiJudge.ts:20-36`) has none of these.
   `JudgeVerdict.triageLabels` is typed `string[]`, so there is no compile-time
   guard. Both flow into `aggregate.ts` `triageCounts` as raw strings. Any
   judge-vs-deterministic agreement analysis (the W2 next phase) silently
   mis-joins labels.
2. **No rubric content hash.** Provenance is a hand-maintained string
   `openAiHellWeekJudgePromptVersion = "hellweek-judge-openai-v1"`
   (`openaiJudge.ts:17`). Editing the rubric body (`openaiJudge.ts:108-123`)
   without bumping that string produces a different grader with the same stamp, so
   a silent judge change is indistinguishable from a behaviour change in
   `compare`.
3. **The live OpenAI contract is untested.** The only judge test injects a
   fabricated client (`openaiJudge.test.ts`); nothing exercises the real
   `responses.parse` + `zodTextFormat` wiring. An SDK or schema drift passes CI
   and only fails on the next paid 122-scenario run.
4. **Floor "breach" ignores dents.** `aggregate.ts:234` and `:274` define
   `breached = floorDemoKillers.length > 0`, so up to N floor scenarios can fail as
   dents while the report says "holding." The acceptance spec demands 100% floor
   pass. "Holding" is currently a weaker bar than the spec.
5. **Silent rationale truncation.** Schema allows `rationale` up to 320 chars
   (`openaiJudge.ts:45`) but `validateOpenAiVerdict` slices to 240
   (`openaiJudge.ts:374`). A 241-320 char rationale passes schema then loses its
   operative clause in the dashboard — on a stakeholder-facing demo-killer "why."
6. **Dead breadcrumbs around the judge.** `effectiveSeverity` (`grade.ts:416`) has
   zero references. `judge-queue.jsonl` is written (`run.ts:153`) but never read —
   a vestige of the deleted Claude workflow (`cb7f1c9`); the OpenAI judge reads
   scenario packets directly. Both mislead anyone tracing the judge pipeline.

## Work Items

### W1.1 Unify the triage-label vocabulary

- Export the judge's triage enum from a shared module (e.g.
  `hellweek/triageLabels.ts`).
- Map the deterministic grader's labels (`language_policy`,
  `account_boundary_miss`, `route_miss`, `run_error`) onto that enum, or into an
  explicit, separately-typed `deterministic-only` bucket if they have no judge
  equivalent. Do not silently widen the judge enum to absorb them without deciding
  which are the same failure class.
- Type `JudgeVerdict.triageLabels` and the deterministic result's labels to the
  shared union, not `string[]`.
- Acceptance: `tsc --build` rejects an out-of-enum label; `triageCounts` in
  `aggregate.ts` no longer mixes two vocabularies.

### W1.2 Hash the rubric and record judge provenance

- Compute a content hash of the `rubric` string and record it on every report
  unconditionally (cheap, fully in-repo).
- Record the judge and verifier model ids where the harness exposes them; keep
  them optional and sourced from the invoking context, never fabricated.
- Add judge model + rubric hash as `compare` comparability fields so a silent
  judge change is flagged, reusing the comparability-warning pipeline.
- This is trustworthiness PRD item 4; it lives here because W2 cannot trust a
  baseline whose grader can change invisibly.
- Acceptance: a report carries `judge.rubricHash` and (when available)
  `judge.model`; editing the rubric body changes the recorded hash;
  `hell-week-compare` warns when two runs' rubric hashes differ.

### W1.3 Add a contract/smoke test for the live judge wiring

- Add a contract test asserting `judgeScenario` builds a request whose
  `text.format` is a valid `zodTextFormat` output, and that
  `validateOpenAiVerdict` rejects a real-shaped-but-out-of-enum response.
- Add a gated live smoke test (behind `OPENAI_API_KEY`, skipped otherwise) that
  judges one fixture scenario through the real `OpenAI().responses.parse` path.
- Per repo evidence discipline, this is the only test of the mandated path that
  proves more than plumbing; keep it OpenAI-only.
- Acceptance: the contract test fails if the zod schema and the request format
  drift apart; the gated smoke test passes against the live API when a key is set.

### W1.4 Redefine floor "breach" to count dents

- Change the floor-breach definition (`aggregate.ts:234`, `:274`) so a dent in a
  safety-floor dimension also counts toward "not holding," aligned to the
  acceptance spec's 100%-floor-pass bar.
- Keep `demo_killer => blocked` as the immovable floor; this only *tightens*
  "holding," never loosens the gate.
- Acceptance: a run with a floor-dimension dent and zero floor demo-killers
  reports the floor as not fully holding (or a clearly-named "holding with dents"
  state distinct from "clean"), and a unit test pins it.

### W1.5 Align the rationale length cap

- Make the zod `max` (`openaiJudge.ts:45`) and the slice
  (`openaiJudge.ts:374`) the same value. Prefer keeping the model's "one concise
  sentence" instruction and a single cap around 240.
- Acceptance: no code path can accept a rationale longer than it will display.

### W1.6 Delete dead judge/grade breadcrumbs

- Delete `effectiveSeverity` (`grade.ts:416`, zero refs).
- Remove the `judge-queue.jsonl` write (`run.ts:153` and its exposure), confirming
  no production reader exists first.
- Optionally prune other confirmed-dead exports in `scenarios.ts` / `signals/`
  surfaced by `fallow`, but only with reference checks; do not delete test-only
  exports the judge tests use.
- Acceptance: `rg` shows zero references to the deleted symbols; `npm test` and
  `npm run typecheck` stay green.

## Testing Decisions

- W1 changes no bot behaviour, so the proof surface is unit/typecheck plus the
  gated live wiring smoke (W1.3). A full judged run is not required to land W1, but
  W1 must not break the existing judged path: re-render one captured run with
  `--from` + `--judge-verdicts` and confirm the report still builds.
- Do not add brittle full-corpus pinning tests; W1.3's contract test is the
  regression lock for the judge wiring.

## Acceptance Criteria

- Judge and deterministic labels share one typed enum; out-of-enum labels fail
  `tsc`.
- Every report records a rubric content hash and (when available) judge model id;
  `compare` flags a judge change.
- A contract test guards the `zodTextFormat`/Responses wiring; a gated live smoke
  test exists and is OpenAI-only.
- Floor "breach" counts floor-dimension dents; a unit test pins it.
- The rationale schema max and slice are equal.
- `effectiveSeverity` and the `judge-queue.jsonl` write are gone; tests and
  typecheck pass.

## Out Of Scope

- The gold set, de-anchoring, mutation probe, symmetric re-check, confidence
  surfacing — all W2, owned by
  [`2026-06-20-hell-week-judge-trustworthiness-prd.md`](./2026-06-20-hell-week-judge-trustworthiness-prd.md).
- Encoding the stability gate and running the x3 — W4.
- Any change to planner/validator/engine behaviour — W3.

## References

- [`2026-06-21-judge-trust-release-candidate-arc-prd.md`](./2026-06-21-judge-trust-release-candidate-arc-prd.md)
  — the arc; W1 is its first parallel workstream.
- [`2026-06-20-hell-week-judge-trustworthiness-prd.md`](./2026-06-20-hell-week-judge-trustworthiness-prd.md)
  — item 4 (version-pin) is implemented here as W1.2.
