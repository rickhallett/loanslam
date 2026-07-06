# PRD: Hell Week Performance Regression Analysis

## Status

Unchecked handoff for the next analysis agent.

## Problem Statement

The latest Hell Week run appears to have a significant regression compared with
the prior runs. Before anyone tunes prompts, retrieval, validator policy, or
scenario encoding, the project needs a defensible analysis of Hell Week
performance over time.

The analysis must separate two ideas that can blur together:

- behavioral quality movement: pass count, demo-killers, dents, safety floor,
  deflection, routing precision, UX score, scenario clusters, and triage labels;
- runtime performance movement: total run duration, per-scenario duration,
  per-turn signal latency where available, errors, and any model or prompt
  version changes that make timing comparisons unfair.

The output should make the latest regression concrete: what moved, which
scenario clusters caused it, whether the run is comparable to earlier evidence,
and whether the apparent regression is confirmed, mixed, or inconclusive.

## Solution

Create a read-only evidence analysis over comparable Hell Week runs. Use
`report.json` and `evidence.json` as the source of truth, with the existing
Hell Week comparison and stability tools as the first pass.

The pickup agent should locate the latest run and the most relevant prior full
runs, normalize them by profile and scenario set, compare the latest run against
both the immediately prior run and the prior-run baseline, then produce a compact
report that explains the regression in terms of metrics and scenario movement.

If the evidence lives in local generated artifacts, use those artifacts. If the
latest evidence was persisted through the Hell Week/Postgres path instead, use
the existing DB-backed stability surface. Do not invent missing numbers.

## Known Starting Points

- Hell Week commands are documented in `docs/hell-week-gauntlet.md`.
- The bounded tuning loop is documented in `docs/hell-week-agent-loop-playbook.md`.
- Existing read-only helpers are exposed through `just hell-week-compare` and
  `just hell-week-stability`.
- Historical 2026-06-16 full runs are indexed in
  `artifacts/evidence-index/hell-week-runs.md` with DB-backed replay commands;
  use that index instead of local `artifacts/phase0` directories.
- The retired cheap-model probe raw outputs are inventoried in
  `artifacts/evidence-index/phase0-retention-2026-07-06.md`; they are not a
  runnable proof surface in this checkout.
- Prior Iteration 1 context to verify through the evidence index: three full
  runs were previously summarized as `95/122`, `96/122`, and `95/122`, with
  stable, recurring, and one-off dents classified separately.

## User Stories

1. As the prototype owner, I want to know whether the latest Hell Week result is
   truly worse than prior evidence, so that I do not tune from a misleading
   single-run impression.
2. As the prototype owner, I want the latest regression explained by scenario
   clusters, so that the next fix slice can target the real owner.
3. As the prototype owner, I want safety-floor movement separated from ordinary
   dents, so that demo-blocking risk is not hidden inside aggregate pass rate.
4. As an operator, I want exact run IDs, artifact paths, generated timestamps,
   model versions, prompt versions, policy versions, judged state, and scenario
   counts, so that I can trust the comparison.
5. As an operator, I want total and per-scenario duration compared over time, so
   that slower execution is visible separately from poorer behavior.
6. As an operator, I want signal latency summarized where present, so that signal
   extraction cost or instability is visible.
7. As an engineer, I want the analysis to use existing compare/stability helpers
   first, so that it stays aligned with the current Hell Week semantics.
8. As an engineer, I want scenario-set and profile mismatches called out, so that
   incompatible reports are not treated as clean regressions.
9. As an engineer, I want the latest run compared against both the immediately
   prior run and the prior-run baseline, so that one noisy run does not define
   the whole story.
10. As an engineer, I want persistent failures, new failures, resolved failures,
    and worsened severities separated, so that aggregate movement is explainable.
11. As an engineer, I want the report to identify whether the regression is
    likely retrieval, planner, validator, state, signal, scenario-rubric, judge,
    or infrastructure related, so that implementation work can be scoped.
12. As a future reviewer, I want the report to distinguish facts from inference,
    so that the next agent does not launder guesses into project memory.

## Implementation Decisions

- Treat this as diagnostic analysis, not a behavior-fix slice.
- Do not change planner, retrieval, validator, scenario, policy, or prompt logic
  until the regression is quantified.
- Prefer existing `hell-week-compare` and `hell-week-stability` outputs before
  adding analysis code.
- Use `HellWeekReport.durationMs` for total runtime movement.
- Use `HellWeekScenarioEvidence.durationMs` for per-scenario runtime movement.
- Use `HellWeekTurnEvidence.signalLatencyMs` where present for signal-latency
  movement.
- Compare only like-for-like runs by default: same profile, same scenario count,
  compatible scenario IDs, comparable judged state, and compatible model/prompt
  versions.
- If run metadata differs, still inspect the data, but mark the comparison
  mixed or inconclusive instead of calling it a clean regression.
- Include both aggregate metrics and scenario-level movement.
- For the prior baseline, compute at least min/median/max or per-run rows rather
  than relying only on one historical run.
- Treat every observed dent as real until repeated evidence proves it is flaky;
  classify one-off versus recurring behavior explicitly.
- Preserve generated analysis artifacts under `artifacts/phase0/` unless the
  user asks for a committed evidence bundle.
- Keep any new code read-only and narrowly scoped to parsing/reporting Hell Week
  artifacts.

## Testing Decisions

- If no new parser or reporting code is added, verify by running the existing
  compare/stability helpers against the selected reports.
- If a new analysis helper is added, test it with small fixture reports that
  cover:
  - same scenario set with latest regression;
  - scenario-set mismatch;
  - missing `evidence` or missing duration values;
  - judged versus deterministic-only report differences;
  - signal latency present on some turns but not others.
- Tests should assert behavior-level output: selected runs, metric deltas,
  scenario movement groups, and compatibility warnings.
- Cross-check any custom output against `hell-week-compare` for at least one
  baseline/candidate pair.
- Run the narrowest TypeScript or CLI test that covers any touched analysis
  code.
- Do not run a new full Hell Week merely to test the analysis code unless the
  existing latest evidence cannot be located.

## Handoff Checklist

- [ ] Locate the latest Hell Week run artifact or DB run ID that triggered the
      suspected regression.
- [ ] Locate at least two prior comparable full Hell Week runs, including the
      known Iteration 1 run set if available.
- [ ] Record run metadata: path or DB ID, `runId`, `generatedAt`, profile,
      scenario count, judged state, planner model, planner prompt version,
      signal extractor model, signal prompt version, and policy version.
- [ ] Confirm whether all compared runs share the same scenario set.
- [ ] Confirm whether all compared runs use comparable model and prompt
      versions.
- [ ] Build a quality time series: pass count, failed count, pass rate,
      demo-killers, dents, fine, errored, verdict, safety-floor breach,
      deflection rate, routing precision, signal agreement, and UX score.
- [ ] Build a runtime time series: total duration, median scenario duration,
      p95 scenario duration, slowest scenarios, errored scenarios, and signal
      latency summary where available.
- [ ] Compare latest versus immediately prior run with `hell-week-compare`.
- [ ] Compare latest versus the prior-run baseline or stability set.
- [ ] Identify resolved failures, new failures, persistent failures, improved
      severities, and worsened severities.
- [ ] Cluster the latest regression by likely owner: retrieval, planner,
      validator, state, signal, scenario rubric, judge, or infrastructure.
- [ ] Inspect evidence for the highest-severity new or worsened scenarios and
      summarize customer-visible behavior, not just trace labels.
- [ ] State whether the apparent regression is confirmed, mixed, inconclusive,
      or not a regression.
- [ ] Write a compact final report using run snapshots, movement diffs, and a
      short interpretation block.
- [ ] If new analysis code was added, run focused tests and typecheck for the
      touched surface.

## Acceptance Criteria

- The report names the exact latest run and prior runs used.
- The report explains why the compared runs are compatible, or clearly says why
  they are not.
- The report quantifies both behavioral quality movement and runtime movement.
- The report identifies the scenarios responsible for the latest regression.
- The report separates new failures from recurring known failures.
- The report separates safety-floor issues from ordinary dents.
- The report separates observed facts from inferred likely causes.
- The report ends with a recommended next slice, but does not implement it.

## Out of Scope

- Fixing the regression.
- Rewriting Hell Week scenario definitions.
- Changing prompt, retrieval, validator, policy, state, signal, or judge logic.
- Publishing raw evidence externally.
- Creating stakeholder-facing report pages.
- Running open-ended model-backed loops.
- Treating one incompatible run as proof of a product regression.

## Further Notes

The useful question is not simply "did the score drop?" The useful question is:
what exactly got worse, under which comparable conditions, and is the latest run
showing a repeatable product risk or a measurement artifact?

Use the existing Hell Week posture: behavior evidence outranks static route
theory, and repeated-run stability matters before turning dents into a tuning
plan.
