# Phase 0 Static Routing Restraint Audit - 2026-06-15

Practical takeaway: keep static restraints/tests only where they guard a tiny non-negotiable safety/schema/determinism invariant. Burn or demote everything that adjudicates natural-language **routing** quality via regex phrase matching, lexical cue sets, score boosts, or wording-specific test assertions; that behaviour must be proven by live lab API simulation sessions, not static fixtures.

Historical status: this is a dated 2026-06-15 decision note, not current code
authority. The durable rule still applies, but the file paths, line numbers, and
KEEP/BURN classifications below were verified against the code as it existed on
2026-06-15. Re-check current code and live evidence before using any specific
line reference or deletion recommendation.

Definitions:
- KEEP: leave as a static invariant or code backstop.
- BURN: delete, or demote to report-only / signal-evidence, and prove the behaviour with live API sessions before treating it as verified.

## What changed vs the first draft (verification corrections)

Classifications flipped after reading the real code:

- `prompt.ts:45` (item 39) BURN -> **KEEP**. These are natural-language instructions to the planner model, not static matchers. They are the routing policy live sessions test; deleting them removes the behaviour, it does not defer it to evidence. (The whole of `prompt.ts` is LLM directive text + scaffolding, with no static routing restraints.)
- `engine.ts:452` (item 27) KEEP -> **BURN**. The pending-handoff interruption dispatch routes every branch on lexical cue regexes (emergency/refusal/hostility/why). This is the exact machinery recent runs kept expanding.
- `validator.ts:469`-adjacent and `routeAudit.ts:462` (item 41) BURN -> **KEEP**: `classifyAuditRow` is report-only, never gates runtime routing.
- `evaluate.ts:269` (item 46, `isMissedVulnerability`) BURN -> **KEEP**: it asserts an enum-level safe-action boundary off structured serving_mode + safety flags, not phrase matching.
- `validator.test.ts:210` (53) and `:628` (60) BURN -> **KEEP**: both drive on structured retrieval serving_mode / explicit planner-supplied safety flags, guarding vulnerability-safety precedence, not message phrasing.
- `simulation` vulnerability-accounting (item 92) BURN -> **KEEP**: driven by corpus serving_mode + the validator's hard override; the assertions guard candidate-set-bleed accounting, not wording quality.
- `stochastic/templates.test.ts` vocabulary tests (item 94) BURN -> **KEEP**: enum/marker set-equality (schema-compat), not routing confidence.
- `validator.test.ts:581` (59), `:650` (61); `engine.test.ts:978/1032` (72), `:1341` (76); `retriever.test.ts:343` (88) KEEP -> **BURN**: each proves its boundary through wording-specific regex / lexical cues on free text rather than structured schema.

Line-number drift corrected: item 32 keep-part is the sort tiebreak at `retriever.ts:342` (not `:15`); item 36 real logic at `retriever.ts:458/503` (not `:452`); item 41 body starts at `routeAudit.ts:462`; simulation/stochastic citations drifted (real anchors recorded below).

## KEEP - the safety / schema / determinism core (stays as-is)

Code restraints:
- `policy.ts`: schema enums + handoff field list (14,17); `uiPrimitivesByAction` (40); forbidden-credential patterns (50,53,56); account value/change/mutation/approval-promise patterns (59,62,65,68); `sensitiveOvershare` (71); `internalDataExposure` (107); deterministic safe-copy builders (206,225,244,265,286); SafetyFlag enum subsets + helpers (26,35,120,127).
- `validator.ts`: overrides for internal-data exposure (107), forbidden-credential request (150), forbidden-credential collected-facts (177), account-promise/outcome (204), selected non-answer serving-mode (257), answer-grounding (265), UI/action mismatch (287); credential portion of `inferSafetyFlagsFromMessage` (356); `currentTurnInvariantSafetyFlags` whitelist (436); the refuse+safe_fallback schema half of the excluded branch (682).
- `engine.ts`: `deriveEffectiveServingMode` (320); handoff completion gate (413); `extractHandoffFacts` sim-only extractor (841); malformed-plan fallback (1004); `nextHandoffPending` + `mergeTraceSafetyFlags` (1117,1141).
- `retriever.ts`: deterministic tied-score sort (342); model-derived `SignalBundle` gating (458,503); `vulnerabilitySignalFlags` (485).
- `prompt.ts`: all of it - grounding (30), schema enums (28), credential block (41), account-promise block (39), UI consistency (40), routing-policy instructions (45-48).
- `routeAudit.ts`: audit-row assembly + route counting (189,245); `classifyAuditRow` report heuristics (462,138,143) - report-only; serving-mode validation set (131).
- `evaluate.ts`: replayability/schema hard fail (43); forbidden-credential output (88); structured account-specific answer fail (234); ungrounded-answer fail (223); `isMissedVulnerability` enum boundary (269); malformed/ui-action allowed-action fail (100); `isExcludedAdviceAnswered` (215).

Tests:
- `lab/server.test.ts` (all); `cli.test.ts` (all, incl. route-audit fixture, shadow-default 99, STS determinism 259); `corpus.test.ts` (all).
- `validator.test.ts`: 135,153,183,192,202,235,343,374,398,418,443,474,564,573,712,732,757,786,806,831.
- `engine.test.ts`: 164,256,443,475,513,572,682,720,792,850,922,1386,1437,1492,1599,1643,1721,1766,1824.
- `retriever.test.ts`: 322 (deterministic tied-score ordering).
- `openaiPlanner.test.ts`: 110,117,214,256,282,326 (config/schema/normalization).
- `simulation/*.test.ts`: artifact-shape, route-accounting, vulnerability-accounting, credential-block (182), coverage (108,148), malformed (133,435).
- `stochastic/*.test.ts`: determinism/artifact/coverage/credential/grounding; scenario counts (30,38); generator (41,62,87); report promotion gates (10).

## BURN - clustered clear-out checklist (approve by cluster)

Each cluster is one decision. Underneath are the file:line sites. "Replace with" is the evidence that should own this behaviour instead.

**B1. Pending-handoff interruption machinery (engine.ts) + its phrase tests.**
The why/refusal/hostile/emergency/complaint regex handlers and referential/completed follow-up patterns - the exact code recent runs kept growing.
- Code: `engine.ts` 430, 452, 946, 953, 960, 970/972, 979, 986.
- Tests: `engine.test.ts` 1081, 1120, 1170, 1260.
- Replace with: 2+ live lab API sessions covering refusal / hostility / "why?" / complaint pivot. CAVEAT: tests 1170/1260 also exercise real intake state transitions - migrate that coverage to a journey suite, do not just delete it.

**B2. Vulnerability/complaint/hardship/distress lexical routing (policy.ts + validator.ts) + tests.**
Cue-set detectors, negation scrubs, the aggregator, the merge into enforced flags, and `suppressNegatedCurrentSafetyFlags`.
- Code: `policy.ts` 74,77,80,83,86,89,92,95,98,101,104,189; `validator.ts` 78,237,372,469,519.
- Tests: `validator.test.ts` 252,288,306,315,324,334,672,695; `engine.test.ts` 304,362,1685.
- Replace with: live API sessions for vulnerability/complaint/hardship routing; keep the corpus `route_vulnerability` serving_mode + structured SignalBundle path as the real driver.

**B3. Retriever lexical routing scoring (retriever.ts) + route-selection tests.**
Cue sets, magic-number score boosts, weak-term gates, the routing regex block, normalize synonyms, domain stop words.
- Code: `retriever.ts` 23, 107-162, 163-198, 199, 284-313, 353-366, 394-450, 519-530.
- Tests: `retriever.test.ts` 35-320, 343, 152,159,172,187,202,239,261.
- Replace with: live API route battery + the deterministic-ordering / SignalBundle KEEPs. This is the single biggest tuning-pain source.

**B4. Excluded / regulated-advice prose checks (validator.ts) + tests.**
`isSafeExcludedRefusal` refusal-language / regulated-advice regex on the customer message. The refuse+safe_fallback schema half stays (KEEP, 682); only the prose check burns.
- Code: `validator.ts` 698, 711, 714.
- Tests: `validator.test.ts` 581, 604.
- Replace with: live API sessions on excluded-topic refusals.

**B5. Prompt-string-as-proof tests (openaiPlanner.test.ts).**
Substring assertions pinning exact prompt phrasing as a proxy for behaviour. (The prompt text itself is KEEP; asserting its wording statically is not.)
- Tests: `openaiPlanner.test.ts` 143, 155, 176, 192, 203.
- Replace with: live API sessions showing the planner acts on the policy, not that the string is present.

**B6. STS routing-verdict pass/fail (stochastic).**
Treating natural-language routing outcomes as hard pass/fail truth.
- Code: `evaluate.ts` 116 (clarification_loop hard fail), 498-505 (`detectsAccountSpecificContent` regex fallback inside the KEEP account check - narrow burn).
- Tests: `evaluate.test.ts` 170-291 (missed-vulnerability/complaint/legal verdicts); `templates.test.ts` 110-124 (clarification-resolution behaviour).
- Replace with: demote to report-only STS findings; CLAUDE.md already says clarification/UX quality belongs in journey reports, not the validator backstop.

**B7. Engine post-ticket / topic-switch NL routing tests.**
Load-bearing assertions are NL routing outcomes triggered by customer wording.
- Tests: `engine.test.ts` 978/1032 (item 72), 1341 (item 76), 1553 (item 80).
- Replace with: live API sessions. CAVEAT: preserve the underlying completed-handoff state-transition coverage in a journey suite.

**B8. (Optional) Thin the account-promise wording-variant tests.**
The account-promise/outcome blocking invariant is KEEP; the brittle wording-variant cluster is heavy.
- Tests: `validator.test.ts` 454 (promise-vs-safe-copy via wording); consider thinning the 474-562 variant cluster to one or two representative cases (keep the override behaviour).
- Replace with: keep one representative structured case; prove edge wording via live sessions.

## Notes that affect the clear-out

- **Some BURN tests also cover real state machinery** (intake completion, pending-handoff preservation, completed-handoff transitions). When you burn B1/B7, migrate that state coverage to live journey/API suites - do not drop it silently.
- **Overshare is a genuine fault line.** Credential-collection blocking is non-negotiable (KEEP, structured guards stay), but the *lexical* overshare flagging (`validator.test.ts:650`, item 61) is phrase-driven; demote to signal, keep the structured credential block.
- **The route-signal regex source** (`validator.ts:372`) only fires when no SignalBundle is present. Burning it means committing to the structured-signal path - confirm the SignalBundle path is wired before deleting.

## Recommended order

1. **Demo today: freeze, don't rip.** Two live API sessions already showed acceptable behaviour with current code; do not delete working routing code hours before showing Sam. The discipline is: stop *adding* static restraints, and rely on live evidence.
2. After the demo, burn B3 (retriever lexical scoring) and B2 (vulnerability cue sets) first - biggest tuning-pain, and the SignalBundle/corpus path can carry the behaviour - validated by a live API battery delta.
3. Then B1/B7, migrating state coverage to journey suites as you go.
4. Then B4/B5/B6/B8 (test-side demotions), which are low-risk.
5. Keep the safety/schema/determinism core untouched throughout.
