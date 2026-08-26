# Validator Layer Quality Review and Hardening Plan - 2026-06-29

## Practical Takeaway

The validator (hard-coded checks) layer is functionally healthy and its
safety-critical choices are deliberate: the guard pipeline order is enforced by a
real test the runtime iterates, the model is clean and conservative (ordered
guards, first-non-null-wins, each guard a pure `(context) => fragment | null`),
and intrinsic complexity is low (validator MI 92.7, policy MI 96.3, package grade
A). The quality problems are concentrated in two themes, **neither a correctness
or safety defect**: (1) duplication / change-amplification, and (2) organisation
plus a thin, undocumented audit-trail / taxonomy surface.

A `validator/rules` registry refactor has since been planned. This document is now
the **combined plan of record**: it merges the code-quality review with that
registry slice and with the structural findings (P1-P3) raised against it.

The organising decision is that **the registry is the spine**, and two of its
fields are keystones:

- `code` (a typed override-code union) absorbs the untyped-override-code findings
  and becomes the registry's primary key.
- `authority` turns the dated static-routing-restraint doctrine into an enforced,
  testable invariant, and lets the deterministic-contract vs judge-backed-semantic
  boundary be stated honestly rather than blurred.

Almost every other item is either metadata that belongs on a registry field or a
detector-internal fix the registry deliberately leaves in place. The highest-value
single change remains collapsing the duplicated credential-term vocabulary into one
source of truth.

**Do not change the `safetyGuardPipeline` order or guard names, and do not loosen
conservative guard semantics. Every step here is order- and behaviour-preserving.**

### Relationship to existing authority docs

- `docs/llm-turn-planner-architecture.md` — the architecture contract ("the LLM
  may reason; it does not own compliance"; the validator is a policy/contract
  backstop, not a UX critic). Finding P1 is a gap between this doc and the code.
- `docs/phase-0-static-routing-restraint-audit-2026-06-15.md` — the static-restraint
  doctrine (keep static restraints only for tiny non-negotiable
  safety/schema/determinism invariants; demote NL-routing regex to judge/live-session
  evidence). The registry's `authority` field is where this doctrine becomes
  enforceable rather than a dated note.
- Complements, does not supersede,
  `docs/prds/2026-06-21-engine-safety-guard-robustness-spec.md` and
  `docs/prds/2026-06-20-static-runtime-code-health-audit-prd.md`.

## Scope

The layer is two tightly-coupled files in `packages/core/src`:

- `validator.ts` — the ordered `safetyGuardPipeline` of `TurnGuard` functions,
  `validateTurnPlan`, and the override / grounding / safety-flag plumbing.
- `policy.ts` — the hard-coded primitives: single-line regex `detect*` checks, the
  `build*Copy` customer-message catalogue, and the action / UI / field constants.

In scope as **index targets** (metadata only, no relocation): the engine-side
checks that also emit `validatorOverrides` — `applyHandoffStateRules`
(`engine.ts:103`) and the urgent-risk path (`engine.ts:660`) — and the override-code
contract in `packages/contracts/src/schemas.runtime.ts:282`.

Method: each file read in full; a multi-lens review (consistency, organisation,
coherence, maintainability, plus a fallow-backed structural pass and a test-surface
pass) where each finding was adversarially re-checked against the code before
counting; tooling `fallow` (`find_dupes`, `check_health`, `analyze`, `trace_export`)
and ripgrep. The registry/taxonomy findings (P1-P3) were raised separately against
the planned refactor and are incorporated here.

## Evidence Caveat (important)

`validator.ts` and `policy.ts` were being **edited by a concurrent process during
this review** (Hell Week tuning on this worktree). `validator.ts` grew 1197 ->
~1266 -> 1395 lines (18 -> 20 -> 21 guards), `policy.ts` 539 -> 601 lines, with new
patterns and guards appearing mid-run.

Consequence: **all line numbers in this document are approximate and drift.**
Reference symbol names first. Headline claims were re-verified against the live
files on 2026-06-29 and hold:

- `forbiddenCredentialRefusalSentence` has zero usages anywhere (dead).
- `handoffFamilyActions` and `allowedUiPrimitivesForAction` have zero external
  importers (exported but used only file-locally).
- The credential-term regex alternation is duplicated 8x verbatim (distinctive
  substring `banking\s+app\s+screenshot` occurs 8 times in `policy.ts`).

Any implementation must re-locate symbols against the then-current file state.

## Lens Ratings

| Lens | Rating | One-line basis |
| --- | --- | --- |
| Consistency | Adequate | Many small inconsistencies, most defensible and the load-bearing ones test-pinned; the one realized failure is credential-term regex drift. Naming (`*Pattern` / `detect*` / `build*Copy`) is otherwise uniform. |
| Organisation | Adequate | Both files are cohesive single domains, but each staples unrelated concerns together (policy.ts: config + regexes + ~58% customer copy; validator.ts: pipeline + flag inference + override engine, no section headers). The rules have no taxonomy. Cost is navigation and governance, not merge blast radius. |
| Coherence | Adequate | Model is sound and the entry path is clear; gaps are undocumented conventions, one dead-by-ordering branch, a doc/code grounding overclaim, and "validator" behaviour split across validator and engine — none affecting customer output today. |
| Maintainability | Adequate | Dragged down on one axis only: change-amplification from duplication (credential vocabulary, handoff copy) and untyped override codes. Offset by low complexity, the order-pin test, centralised `standardHandoffFields`, and a single `applyOverride`. |

## Findings

Severity reflects the adversarially-verified value. Verdict is the verification
outcome: `confirmed` (held as stated) or `partial` (real but the original framing
was overstated / mislocated and corrected). The P-findings are the
registry-motivating structural items.

### Theme 1: Duplication / change-amplification

1. **[high leverage] Credential-term regex alternation duplicated 8x and already
   drifted.** Verdict: confirmed. The ~15-term noun list is hand-copied across
   `forbiddenCredentialTermPattern`, `credentialCollectionPattern`,
   `credentialWarningPattern`, `credentialBoundaryQuestionPattern`, and three inline
   copies in `sensitiveOversharePattern`. The overshare copy has already diverged
   (dropped `payment_credentials`, added `dob`), so `containsForbiddenCredentialTerm`
   and the overshare path now disagree about what counts as a credential. A routine
   vocabulary edit can silently weaken a safety boundary in only some guards.
   -> Slice 5 (R1).
2. **[medium] Standard-handoff sentence + credential enumeration duplicated,
   double-encoded vs `standardHandoffFields`.** Verdict: partial. 5x verbatim
   handoff sentence, 3-4 reworded credential warnings, field list encoded twice
   (prose + data) with no compiler link. -> Slice 6 (R2).
3. **[medium] Seven near-identical handoff builders with inconsistent, undocumented
   reason-append.** Verdict: confirmed. Same shape, differ only in
   `customerMessage`; some append `route_reason` to `ui.message`, some omit it, no
   stated rule. -> Slice 6 (R2).
4. **[medium-low] Multi-clause detection regexes are single-line and unreviewable.**
   Verdict: confirmed. 3-5 OR-clauses (some 700-1000+ chars) per physical line, no
   delimiters; a diff can't show which clause changed. -> Slice 5 (R5).

### Theme 2: Conventions / audit trail

5. **[medium] Override audit trail: coherent intent, weak machinery.** Verdict:
   partial. `OverrideInput.code` typed plain `string`, shared across distinct
   decisions (`non_answer_citation_blocked` x4, `forbidden_credential_request_blocked`
   x2), no documented rule for when a guard records a `ValidatorOverride` vs silently
   mutates the fragment. -> Slices 1-2 (folds into the typed code union + registry).
6. **[low] `dispatchNonAnswerServingMode` vulnerability branch is dead-by-ordering.**
   Verdict: partial. `guardVulnerabilityRoute` always handles a `route_vulnerability`
   match first, so dispatch's final branch is unreachable and re-expresses
   `applyVulnerabilityOverride`. -> Slice 2 (made explicit when the branch is indexed;
   resolve with a switch + `assertNever`).
7. **[low] Pipeline-order comment and order test over-state what is protected.**
   Verdict: partial. Comment justifies only the credential/internal prefix; order
   test pins names but not why middle pairs are ordered. -> Slice 2 (registry `order`
   + governance test carry the rationale).

### Theme 3: Test surface

8. **[medium] `answerGroundingFailure` ships two of four branches untested.**
   Verdict: confirmed. `answer_grounding_unsupported` and
   `answer_grounding_not_retrieved` (the answer -> fallback downgrade) are never hit
   by a unit test; only `answer_grounding_missing` is. -> Slice 0 (QW4), paired with
   P1 in Slice 4.
9. **[low] Test-surface consistency.** Verdict: partial. One flat 40+ `it` block, no
   per-guard mapping; several broad-regex guards have only positive-trigger tests, no
   false-positive control. -> Slice 5 (alongside R5 / detector tests).

### Confirmed dead / loose surface

10. `forbiddenCredentialRefusalSentence` (policy.ts) is dead. Verdict: confirmed.
    -> Slice 0 (QW1).
11. `handoffFamilyActions` and `allowedUiPrimitivesForAction` exported but used only
    file-locally. Verdict: confirmed. -> Slice 0 (QW2).

### Theme 4: Taxonomy / structure (registry-motivating)

- **[P1] Validator responsibility overclaims semantic grounding.**
  `docs/llm-turn-planner-architecture.md:151` says the validator rejects answers that
  "add unsupported facts beyond the cited source," but `answerGroundingFailure`
  (`validator.ts`) only checks citation presence, serving mode, confidence, and
  retrieved IDs. Deterministic validation proves the grounding **contract**, not
  semantic grounding. -> Slice 4 (doc fix + `authority`/`proofSurface` make the
  boundary explicit; QW4 pins the contract).
- **[P2a] The hard-check layer has no rule taxonomy.** `policy.ts` mixes credential
  safety, account promises, regulated-advice heuristics, payment-link routing,
  internal-data attacks, parsing helpers, and copy builders; `validator.ts` wires
  guards manually. No rule carries explicit metadata (category, authority, code,
  flags, action, proof owner, deterministic-safety vs judge-backed-heuristic).
  -> Slice 2 (the registry itself).
- **[P2b] "Validator" behaviour is split across validator and engine.**
  `validateTurnPlan` runs first; then `applyHandoffStateRules` (`engine.ts:103`) also
  emits `validatorOverrides`, and urgent-risk regexes live at `engine.ts:660`. Some
  hard checks are policy validation, some are stateful post-validation, and both
  surface as validator overrides. -> Slice 2 (index engine rules as `owner: 'engine'`;
  move nothing).
- **[P2c] Override codes operationally important but untyped.**
  `schemas.runtime.ts:282` accepts any non-empty string while runtime/report/gold/test
  code depends on exact names; stale fixture vocabulary (`account_specific_answer_blocked`
  in `schemas.test.ts:161` and lab tests) coexists with current codes
  (`non_answer_citation_blocked`, `approval_status_handoff_required`,
  `account_specific_promise_blocked`). -> Slice 1 (typed union + schema + fixture
  cleanup).
- **[P3] Regex tests are honest but hard to govern.** `policy.test.ts:141` labels
  known regex gaps as judge-covered (good), but nothing stops future additions
  becoming new brittle route restraints, against the static-restraint doctrine.
  -> Slice 3 (governance test over `authority`/`proofSurface`).

## The Registry as Spine

The registry indexes what hard checks exist and why. It owns **metadata only**;
detector functions stay where they are (referenced by name). It is keyed by the
typed override code, and its `authority`/`proofSurface` fields encode the
static-restraint doctrine and the deterministic-vs-judge boundary.

Proposed entry shape (a superset of the originally-planned fields):

```text
RuleEntry {
  code:        ValidatorOverrideCode            // typed union — primary key (R3 + P2c)
  family:      'credential' | 'account' | 'regulated_advice' | 'internal_data'
             | 'routing' | 'grounding' | 'ui_contract' | 'handoff_state'
  authority:   'deterministic_safety' | 'schema_contract'        // KEEP-class
             | 'judge_backed_heuristic' | 'report_only'          // BURN/demote-class
  owner:       'validator' | 'engine'           // makes P2b explicit, relocates nothing
  order:       number                           // mirrors the pinned pipeline index
  fromSignals: SafetyFlag[]
  toAction:    TurnAction
  proofSurface:'unit' | 'hell_week_battery' | 'live_lab_session' | 'judge'
  detectorRef: string                           // names the detect fn; behaviour stays put
}
```

Field-to-finding map (the coherence contract of this plan):

- `code` <- R3 (typed codes) + P2c (schema + stale fixtures) + finding 5 (audit key)
  + QW5 (`OverrideInput.toAction` removal).
- `authority` <- P3 (governance) + the static-restraint doctrine + P1
  (deterministic contract vs judge-backed semantic).
- `owner` <- P2b (validator/engine split made visible).
- `proofSurface` <- the architecture doc ("live lab API is the highest-value
  signal") + P1.
- `order` <- the existing pinned-order invariant (registry mirrors it; see Decision 1).
- `detectorRef` <- R1 / R5 / R2 leave detector bodies in place behind a name.

## Combined Implementation Plan

Slices, no time estimates. Each is behaviour- and order-preserving. The registry is
the spine; my QW/R items and the P-findings attach to it.

**Slice 0 — Prep cleanups** (independent, do while files settle)
- QW1: delete dead `forbiddenCredentialRefusalSentence`.
- QW2: drop the unnecessary `export` on `handoffFamilyActions` and
  `allowedUiPrimitivesForAction` (consumed only by `isHandoffFamilyAction` /
  `uiMatchesAction`).
- QW4: add two `answerGroundingFailure` unit fixtures (`confidence !== "supported"`;
  cite a non-retrieved item id). Additive.
- Drop QW3 and QW7 as standalone items — subsumed by R2 (copy module) and the
  registry index; doing them now is throwaway churn.
- Verify: `@loanslam/core` unit suites + `tsc`.

**Slice 1 — Override-code union** (keystone: R3 + P2c + QW5 + finding 5)
- Define `ValidatorOverrideCode` as a string-literal union covering both validator-
  and engine-emitted codes (so `owner` is honest in Slice 2).
- Type `OverrideInput.code`; tighten `schemas.runtime.ts:282` against the union.
- Fix stale fixture vocabulary (`account_specific_answer_blocked` -> current codes)
  in `schemas.test.ts` and lab tests.
- Fold QW5 here (remove redundant `OverrideInput.toAction`, derive action from
  `replacement.finalAction`) since this slice already touches the override-input type
  and every call site. Do not do QW5 standalone — that double-sweeps ~20 sites.
- Verify: `tsc` (the union surfaces every drifted code), full core + contracts suites.

**Slice 2 — Registry as index** (the planned slice, expanded)
- `validator/rules/registry.ts`: one metadata entry per rule keyed by the typed code.
  Detectors stay in place.
- Make the order-pin test assert `registry order === safetyGuardPipeline names`, so
  the registry and the pinned order cannot drift (mirror, not drive — Decision 1).
- Add `owner: 'engine'` entries for `applyHandoffStateRules` and the urgent-risk path
  (resolves P2b coherence without relocating engine code).
- While indexing, resolve finding 6: make `dispatchNonAnswerServingMode`'s unreachable
  vulnerability branch an explicit switch over the two reachable modes with an
  `assertNever` (no behaviour change).
- Verify: order-pin + registry-consistency tests; full core suite.

**Slice 3 — Governance test** (P3 + restraint doctrine)
- Test over the registry: every `deterministic_safety` / `schema_contract` rule must
  operate on structured inputs (enums, `serving_mode`, safety flags, schema), never
  free-text NL routing; any new regex-on-customer-message rule must be
  `judge_backed_heuristic` with `proofSurface: live_lab_session`. This is the
  enforceable form of the static-restraint doctrine.
- Verify: the governance test fails loudly on a deliberately mis-classified fixture
  rule.

**Slice 4 — Doc coherence** (P1)
- Correct `docs/llm-turn-planner-architecture.md:151`: the validator enforces the
  grounding **contract** (citation presence, serving-mode, confidence, retrieved
  IDs), not semantic "adds unsupported facts." Note semantic grounding is
  judge-backed. The registry's `authority: schema_contract` + `proofSurface: judge`
  for the grounding rule is the source of truth the doc points to. QW4's tests pin the
  contract — QW4 and P1 are two halves of one fix.

**Slice 5 — Detector-internal refactors** (R1, R5; orthogonal, registry untouched)
- R1: extract a single `CREDENTIAL_TERMS` source of truth and compose all credential
  patterns from it; converge the `dob` / `payment_credentials` divergence
  deliberately. Top safety leverage. All `deterministic_safety` KEEP-class — this
  hardens a KEEP detector, it does not resurrect BURN-class lexical routing.
- R5: recompose multi-clause single-line regexes from named sub-fragments (or one
  regex per clause ORed in the `detect*` wrapper) for diff-reviewability and
  per-clause tests. Add the missing false-positive/decline controls (finding 9).
- Verify: before/after behaviour tests on the affected detectors; full core suite;
  Hell Week battery delta (these touch safety regexes).

**Slice 6 — Copy + module split** (R2, R4; last, largest)
- R2: copy catalogue — one shared handoff-instruction sentence derived from
  `standardHandoffFields`, one canonical credential-warning sentence,
  `makeHandoffIntake` / `makeRefuse` assemblers, shared named return types
  (`HandoffCopy` / `RefuseCopy` / `AnswerCopy`) removing the ~14 inline literals and
  the runtime `"requestedFields" in copy` probe. Absorbs QW3.
- R4: module split — `policy/{config,patterns,detectors,copy}` + `validator/rules`,
  barrel re-export to avoid churning import sites; group `validator.ts` into labelled
  sections or extract `safetyFlags.ts` and a fragment/override engine module. Preserve
  `safetyGuardPipeline`, guard names, and pinned order.
- Verify: full core + contracts + lab suites; import-site `tsc`.

## Decisions

1. **Registry drives order, or mirrors it?** Recommend **mirror first**: registry
   carries an `order` field and a test asserts it equals the pinned
   `safetyGuardPipeline`. Keeps the safety invariant untouched; switch to
   registry-driven wiring later once trusted. Driving now changes runtime wiring for
   no immediate gain.
2. **Index engine rules now, or defer?** Recommend **index now** as `owner: 'engine'`
   metadata, relocate nothing. Cheap, and the actual fix for P2b's coherence
   complaint. Physically moving `applyHandoffStateRules` is a separate, larger call.
3. **P1: correct the doc, or build semantic grounding?** Recommend **correct the
   doc**. Semantic grounding is a judge concern; building it into the deterministic
   validator would contradict "the LLM may reason; it does not own compliance." Label
   the boundary, do not blur it.

## What Is Good (do not over-correct)

- The pinned pipeline order is a real, meaningful invariant: `validateTurnPlan`
  iterates `safetyGuardPipeline` directly and the order test asserts the exact name
  list. Reorder or drop fails the test.
- Conservative, legible decision model: ordered guards, first-non-null-wins, each
  guard a pure `(context) => fragment | null`.
- The one genuinely dangerous data case (credentials surviving into `collectedFacts`)
  is explicitly wiped and pinned by a test.
- Low intrinsic complexity for safety code; only 3 of ~47 functions above CRAP-25;
  package health grade A. Fallow showed no serious production duplication in the
  validator layer — the issue is organisation/taxonomy, not copy-paste volume.
- `standardHandoffFields` is centralised, so the data that matters cannot drift; only
  the prose restating it drifts.
- Audit writes are centralised in one `applyOverride`; safety flags normalised
  through an idempotent `uniqueSafetyFlags`; `ServingMode` / `SafetyFlag` are typed
  unions.
- `policy.test.ts` already documents its layering intent with explicit "known gap:
  covered by judge" annotations — the registry's `authority`/`proofSurface` makes that
  intent machine-checkable.

## Constraints

- Do not change the `safetyGuardPipeline` order or guard names (breaks the order-pin
  test and the safety invariant).
- Do not loosen conservative guard semantics.
- Registry owns metadata only in this plan; detector behaviour stays put (the planned
  "small registry, not a big rewrite" constraint).
- Honour the static-restraint doctrine: new `deterministic_safety` rules must be
  structured, not NL-routing regex. The Slice 3 governance test enforces this.
- Re-locate every symbol against the current file state before editing; line numbers
  here are stale by construction.

## Implementation Status

Pending. This plan is the agreed sequence. Slices 0-4 are approved in principle and
behaviour-preserving; Slices 5-6 are the larger refactors. Implementation is gated on
(a) explicit go, and (b) `validator.ts` / `policy.ts` becoming quiescent (no longer
edited by the concurrent Hell Week tuning process). No source changes have been made
as part of this review. Decisions 1-3 above carry recommended defaults; absent
objection they will be taken as decided when implementation begins.
