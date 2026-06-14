# StochasticTestSimulator PRD

## Problem Statement

The Phase 0 TurnPlanner engine has fixed journey and persona simulations, but those
fixtures mostly test scenarios the team already knew to write down. That leaves a
gap before productisation: stakeholders need broader behavioral exploration across
customer styles, phrasing, risk signals, ambiguity, and journey shapes, while still
being able to replay any surprising case exactly.

The tool must not become chaos engineering yet. The v1 outcome bar is behavioral
exploration, not system fault injection. If v1 proves useful, v2 should move into
planning, further grill-me sessions, and then agentic development.

## Solution

Build a StochasticTestSimulator, abbreviated STS, that generates seed-replayable
customer scenarios and runs them through the real Phase 0 `processTurn` boundary with
the real configured `TurnPlanner`. STS v1 should vary customer behavior and journey
content while keeping expected safety envelopes deterministic.

STS should produce replayable evidence artifacts, not just conventional pass/fail
test output. A normal reviewer should be able to run one terminal command, inspect a
compact summary, replay a full run or one notable scenario, and decide whether the
behavioral findings justify v2 planning.

STS v1 uses deterministic, non-model generation. It may use rich seeded variation:
phrase banks, persona style transforms, typo/noise injection, ambiguity levels,
emotional intensity, overshare inserts, repeated questions, and topic switches. It
must not add a second model to generate customer journeys in v1.

## User Stories

1. As a product stakeholder, I want broad behavioral exploration beyond curated
   journeys, so that I can see whether the engine handles realistic variation.
2. As a reviewer, I want every STS run to have a seed, so that surprising behavior can
   be reproduced exactly.
3. As a reviewer, I want generated scenarios to include deterministic envelopes, so
   that the simulator is not grading its own stochastic output.
4. As a reviewer, I want copy-ready replay commands, so that I do not have to dig
   through raw JSON to rerun an interesting case.
5. As a reviewer, I want a Markdown summary, so that I can understand findings before
   opening JSONL traces.
6. As a technical stakeholder, I want STS to run through the real `TurnPlanner`, so
   that evidence reflects current model-backed behavior.
7. As an engineer, I want inline planners allowed only in unit tests, so that local
   deterministic tests do not become fake product evidence.
8. As an engineer, I want missing model credentials to fail clearly, so that STS never
   silently falls back to a fake baseline.
9. As a compliance reviewer, I want account-specific answers, ungrounded answers,
   missed vulnerability signals, excluded advice mistakes, and forbidden credential
   requests to be hard failures, so that safety problems cannot hide as UX notes.
10. As a product reviewer, I want tone, awkward wording, generic clarification, and
    safe-but-clumsy handoff copy to be findings rather than hard failures, so that
    the tool does not become a subjective copy linter.
11. As an engineer, I want findings clustered by behavioral cause, so that we can see
    what kind of behavior is failing instead of blaming one persona label.
12. As an engineer, I want persona and style to remain dimensions inside findings, so
    that clusters can explain cross-persona behavior.
13. As an engineer, I want sampled axis coverage, so that STS exposes blind spots
    without exploding into full Cartesian coverage.
14. As a reviewer, I want coverage gaps called out directly, so that no one mistakes
    sampled exploration for exhaustive testing.
15. As an operator, I want `smoke`, `review`, and `soak` profiles, so that I can pick
    the right amount of exploration for the situation.
16. As an operator, I want `review` to be the default profile, so that the normal run
    produces meaningful behavioral evidence.
17. As an operator, I want a run-level seed plus scenario-level paths, so that I can
    replay either the whole run or one scenario.
18. As an operator, I want STS stdout to be compact and useful, so that terminal use
    feels convincing rather than like scraping a debug dump.
19. As a future agent, I want STS artifacts to include structured replay fields, so
    that follow-up automation can rerun top findings and hard failures.
20. As a future engineer, I want valuable stochastic findings to be promotable into
    fixed regressions, so that discoveries become durable tests.
21. As a future engineer, I want promotion to require a human or agent decision, so
    that unrealistic or redundant generated cases do not pollute the fixed suite.
22. As a stakeholder, I want the final verdict to be provisional, so that STS does not
    imply production approval.
23. As a v2 planner, I want v1 to identify generator blind spots and next gaps, so
    that v2 planning starts from evidence rather than vibes.

## Implementation Decisions

- Name the tool `StochasticTestSimulator`, abbreviated `STS`.
- Do not call v1 `ChaosSimulator`. That name is reserved for a later tool only if the
  scope expands to controlled system fault injection.
- Optimize v1 for behavioral exploration, not resilience under injected failure.
- Vary customer inputs and journeys only in v1.
- Exclude planner outages, retrieval failures, latency injection, malformed transport,
  database faults, API faults, and other chaos-style system faults from v1.
- Use deterministic envelope templates with stochastic customer content as a testable
  hypothesis.
- Optimize v1 for breadth-first discovery. Known failures can be replayed and later
  promoted to fixed fixtures.
- Treat the first-class output as a seeded run artifact, not a conventional unit-test
  result.
- Record seed, STS version, profile, generator config, template set version, corpus
  fingerprint, planner metadata, policy version, generated scenario IDs, verdict,
  findings, coverage, and replay commands.
- Use run-level seeds with scenario-level derived paths.
- Use `smoke`, `review`, and `soak` profiles. Default to `review`.
- Keep the public CLI intentionally small: seed, profile, scenario replay, output
  directory, summary override, and compact JSON stdout are enough for v1.
- Include copy-ready replay commands in stdout, the Markdown summary, and the
  structured run artifact.
- Use real configured planner behavior for evidence runs. Inline planners are allowed
  only for deterministic unit tests.
- Use deterministic, non-model scenario generation in v1.
- Write four run artifacts under the existing Phase 0 artifact area:
  - run metadata and verdict JSON
  - generated scenario JSONL
  - trace JSONL
  - human-readable summary Markdown
- Use `verdict` for the final outcome with exactly three v1 values:
  - `blocked`
  - `useful_with_findings`
  - `promote_to_v2_planning`
- Include `verdictReasons` in the run artifact.
- When the verdict is `promote_to_v2_planning`, include `promotionStatus:
provisional`.
- Do not require generated promotion caveats in v1. The Markdown summary should
  include one fixed sentence stating that promotion is provisional and limited to the
  current STS version, seed/profile, and generator coverage.
- Hard failures drive verdicts. Findings drive behavioral insight.
- `promote_to_v2_planning` requires zero unresolved hard failures, stable replay,
  useful findings, and clear next gaps.
- All promotions are provisional.
- Cluster findings by behavioral cause first. Persona and style are dimensions, not
  the primary grouping.
- Report sampled axis coverage. Do not claim full matrix coverage.
- Require every axis value to appear at least once in the `review` profile.
- Require high-risk intents to appear across multiple persona styles in the `review`
  profile.
- Require each hard-failure category to have at least one targeted generator template.
- Promote STS findings to fixed regressions manually: replay, classify, decide,
  convert into a fixed journey/persona/validator/prompt regression if real, and
  preserve the original seed/path in the regression name or notes.

## Testing Decisions

- Test the generator as a deterministic module: same seed and profile must produce
  the same generated scenarios and scenario paths.
- Test replay behavior: a run-level seed and scenario path must reproduce the same
  generated scenario.
- Test profile behavior: `smoke`, `review`, and `soak` should differ in breadth while
  preserving deterministic replay.
- Test sampled coverage reporting: axis values, high-risk intent spread, and explicit
  coverage gaps should be reported.
- Test report verdict behavior: hard failures block promotion, quality findings do
  not block by themselves, and promotion is marked provisional.
- Test artifact writing: run JSON, scenario JSONL, trace JSONL, and summary Markdown
  should be written to the expected paths.
- Test CLI parsing and stdout shape: terminal output should include seed, artifact
  paths, verdict, and copy-ready replay commands.
- Test missing credentials for CLI evidence mode: STS should fail clearly rather than
  fall back.
- Test inline-planner paths only as unit tests for generator, runner, reporting, and
  artifact boundaries. Do not present those runs as evidence.
- Reuse prior testing patterns from the existing CLI, journey runner, persona runner,
  report, and schema tests.

## Out of Scope

- Chaos engineering or system fault injection.
- Model-generated customer journeys.
- Full Cartesian coverage across all axes.
- Numeric pass thresholds such as a global percentage score.
- Production approval or production model certification.
- New widget, production API, SQL persistence, ticket webhook, AWS deployment, or real
  PII intake.
- Autonomous promotion of every stochastic finding into fixed tests.
- A separate package extraction before v1 proves the interface.
- A fake planner baseline for evidence.

## Further Notes

STS v1 is done when a reviewer can run one command, get replayable artifacts, inspect
sampled behavioral coverage, replay notable findings, and make a provisional decision
about whether v2 planning is justified.

A human using the terminal version must have a convincing experience. Concretely,
terminal output should be compact and legible; seed, summary path, and replay commands
should be copy-ready; top findings should be understandable without opening raw JSON;
scenario replay should feel obvious; and the Markdown summary should read like a
review artifact rather than a debug dump.

The v1 done bar includes:

- `just core-stochastic -- --profile review` works with a real planner.
- Optional `--seed` reproduces the same generated scenarios.
- Optional `--scenario` replays one generated scenario.
- The four accepted artifacts are written.
- The report includes `verdict`, `verdictReasons`, findings, sampled coverage axes,
  and replay commands.
- Hard failures block promotion.
- Findings can be manually promoted to fixed regressions.
- Deterministic tests cover generator, replay, report schema, CLI parsing, and
  artifact writing.
- The PRD, guide, and implementation plan exist before v1 implementation is treated
  as complete.
