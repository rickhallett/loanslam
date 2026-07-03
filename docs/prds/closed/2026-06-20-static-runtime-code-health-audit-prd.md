# PRD: Static and Runtime Code Health Audit

## Problem Statement

The repository now carries several overlapping surfaces: the Phase 0 TurnPlanner
engine, local lab API, MCP wrapper, stochastic and Hell Week evidence harnesses,
stakeholder demo routes, review/demo widgets, a rebuilt site surface, Prisma
deployment wiring, and generated evidence artifacts. That growth makes it hard
for an agent to tell which code is live product behavior, which code is legacy
or demo-only scaffolding, and which code is genuinely dead, deprecated, or buggy.

Static analysis alone is not enough for this repo. Some paths are command
entrypoints, demo-only adapters, generated artifact readers, or evidence tools
that can look unused from the import graph. Runtime checks alone are also not
enough, because they only cover the scenarios that were exercised. The next
agent needs a combined static and active runtime audit that treats deletion as
an evidence-backed decision, not a cleanup reflex.

The risk is two-sided:

- dead or deprecated code can keep steering agents and humans toward stale
  behavior;
- over-eager cleanup can remove important evidence, safety, demo, or operator
  surfaces that only show up through commands and runtime smoke tests.

## Solution

Run a full code health audit that combines static graph analysis, native project
quality gates, and active runtime smoke checks. The audit should produce a
reviewable report that classifies findings into delete, deprecate, fix, keep, or
needs-human-decision buckets, with enough evidence for a later implementation
slice to act safely.

The audit should use Fallow for dead-code, dependency, duplication, complexity,
feature-flag, and architecture-health signals. It should also use the repo's own
checks and operator commands to prove which surfaces are active: typecheck,
tests, builds, lab API smoke, engine turn probes, simulation runs, stochastic
smoke, Hell Week smoke, demo/review smoke where feasible, and site build smoke.

Where possible, collect local runtime coverage from tests and smoke commands and
merge it into the static health report. A finding should not be marked safe to
delete unless it is statically unreachable, absent from exercised runtime paths,
not a documented operator entrypoint, not deployment wiring, and not preserved
as evidence or policy data.

The first deliverable is an audit report, not a cleanup commit. Follow-up work
can then delete, deprecate, or fix specific buckets in small reviewed slices.

## User Stories

1. As the repo owner, I want dead code candidates separated from live entrypoints,
   so that cleanup does not break demos, evidence tooling, or deployment wiring.
2. As the repo owner, I want deprecated code called out explicitly, so that old
   prototype surfaces stop silently shaping future work.
3. As the repo owner, I want buggy code backed by failing tests, smoke failures,
   runtime logs, or reproducible traces, so that fixes are grounded in observed
   behavior.
4. As the repo owner, I want static findings cross-checked against active runtime
   evidence, so that graph-only false positives do not trigger bad deletions.
5. As the repo owner, I want runtime-only findings cross-checked against source
   ownership, so that one smoke run does not overstate coverage.
6. As a future cleanup agent, I want every delete candidate to include why it is
   safe to remove, so that I can implement the next slice without redoing the
   whole audit.
7. As a future cleanup agent, I want every deprecation candidate to explain the
   replacement surface, so that removal can be staged instead of guessed.
8. As a future cleanup agent, I want every bug candidate to include a narrow
   reproduction command or scenario, so that the fix can start from evidence.
9. As a future cleanup agent, I want generated artifacts and historical reports
   separated from source code, so that artifact noise does not distort the code
   health picture.
10. As a future cleanup agent, I want dependency findings to distinguish unused,
    test-only, build-only, script-only, and workspace-placement issues, so that
    package changes do not break commands.
11. As a future cleanup agent, I want duplicate-code findings ranked by actual
    maintenance risk, so that superficial duplication does not distract from
    brittle shared behavior.
12. As a future cleanup agent, I want complexity hotspots ranked with runtime
    importance where possible, so that refactor candidates are ordered by risk
    and payoff.
13. As a future cleanup agent, I want stale feature flags and environment gates
    identified, so that deprecated deployment paths are visible.
14. As a future cleanup agent, I want security candidates clearly marked as
    candidates, so that unverified SAST-style output is not presented as proven
    vulnerability.
15. As a future cleanup agent, I want route-quality tests and static
    phrase-matching tests reviewed against live lab evidence, so that natural
    language behavior is not overfit to brittle regex assertions.
16. As a future cleanup agent, I want test failures grouped by ownership surface,
    so that engine, site, widget, MCP, Prisma, and evidence-tooling problems are
    not flattened into one red pile.
17. As a future cleanup agent, I want the audit to preserve secret discipline, so
    that runtime checks do not print or commit decrypted environment values.
18. As a future cleanup agent, I want a durable artifact directory for raw JSON,
    logs, and coverage, so that the summary report can be verified.
19. As a future cleanup agent, I want the final report to distinguish facts from
    inferences, so that low-confidence candidates do not become accidental work
    orders.
20. As a reviewer, I want the final report to make the next implementation
    slices obvious, so that cleanup can proceed in small commits.

## Implementation Decisions

- Treat this as an audit and evidence-gathering slice. Do not delete, refactor,
  or auto-fix code during the first pass unless the repo owner explicitly
  approves a follow-up implementation slice.
- Use the current development branch as the baseline. Record the exact commit,
  branch, worktree path, tool versions, and environment assumptions in the audit
  report.
- Scope the audit across the monorepo root, workspaces, API entrypoint,
  Prisma/deployment wiring, site surface, scripts, policy data, and generated
  evidence boundaries.
- Exclude dependency installs, build outputs, coverage outputs, and generated
  artifacts from source-health conclusions unless they are checked-in source or
  actively linked by an operator command.
- Use Fallow's full static analysis for cleanup candidates, then targeted
  dead-code, production-only dead-code, duplication, health, feature-flag, and
  security-candidate passes for evidence detail.
- Use Fallow runtime-coverage integration if a local V8 or Istanbul coverage
  capture can be collected from tests and smoke commands.
- Follow Fallow's machine-readable JSON workflow. Keep raw JSON outputs as
  artifacts and summarize them in the report rather than pasting large tool
  output into Markdown.
- Treat Fallow exit code 1 as a normal "issues found" state, not as a tool
  failure. Treat invalid config, parse failure, or missing tool errors as audit
  blockers to record.
- Use native project gates as independent evidence: typecheck, tests, build,
  format check, and package/workspace-specific checks.
- Use active runtime smoke as the authority for user-visible engine and routing
  behavior: engine turn probes, lab API sessions, simulation smoke, stochastic
  smoke, Hell Week smoke, and demo/review smoke where dependencies and secrets
  permit.
- Prefer smoke profiles and narrow representative journeys before broad soak
  runs. The goal is coverage and reproducibility, not exhaustive model spend.
- Do not call external deployment sinks, mutate Vercel or Railway environment
  variables, or sync secrets as part of the audit.
- Use encrypted secret render/run commands when runtime checks require local
  secrets. Never print secret values, commit env caches, or copy stale env files
  between worktrees.
- Classify each finding as one of: delete candidate, deprecate candidate, bug,
  keep, needs-human-decision, or false positive.
- A delete candidate requires at least two independent signals, such as static
  unreachability plus no runtime coverage, or unused dependency plus no script or
  workspace usage.
- A deprecate candidate requires a named replacement surface or a documented
  reason the behavior is obsolete.
- A bug finding requires a concrete failure: failing test, failed build, failed
  smoke, runtime exception, broken route, schema mismatch, or contradictory
  behavior in a trace.
- Preserve safety/schema/determinism backstops unless the audit proves a
  replacement behavioral test or live evidence path exists.
- Treat natural-language route-quality assertions and phrase-specific tests as
  suspicious, not automatically wrong. Review them against the existing static
  routing restraint direction and prove replacement behavior through live
  sessions before recommending removal.
- Use a final report with ranked findings, raw artifact references, confidence
  level, reproduction evidence, and proposed follow-up slices.

## Testing Decisions

- Good tests for this audit assert external behavior, command success, API
  contracts, generated artifact shape, and safety boundaries. They should not
  merely assert implementation wording or private helper structure.
- Static analysis is evidence, not a test oracle. Findings must be interpreted
  against documented entrypoints, package scripts, deployment wiring, and runtime
  smoke.
- Runtime smoke should cover at least one general answer path, one
  account-specific handoff path, one vulnerability or hardship route, one
  forbidden-credential path, and one reset or continuity path.
- Site smoke should cover build success and at least one representative page or
  route if browser tooling is available.
- Widget smoke should cover message send, intake/form rendering where feasible,
  host bridge behavior where feasible, and absence of obvious runtime console
  errors.
- Database-backed checks should be optional unless a safe local Postgres or
  encrypted local secret path is available. If unavailable, record the skipped
  coverage and continue with non-DB smoke.
- Model-backed checks should record model, prompt/runtime configuration, and
  whether failures are deterministic, transient, or provider-dependent.
- Failing gates should be kept as evidence in the report. Do not hide existing
  red checks by narrowing the audit only to passing commands.
- If broad gates fail because of known unrelated backlog, also run the narrowest
  checks that isolate the audited surface and record both results.
- Runtime coverage, if collected, should be treated as "observed during this
  audit," not proof that unobserved code is dead.

## Out of Scope

- Deleting source code, tests, docs, dependencies, migrations, or artifacts in
  this first audit slice.
- Applying Fallow auto-fixes.
- Rewriting architecture boundaries.
- Refactoring complexity hotspots.
- Changing model prompts, routing policy, or validation behavior.
- Changing Prisma schema or running production migrations.
- Deploying to Vercel, Railway, or any other external host.
- Syncing secrets to any deployment provider.
- Reclassifying product scope or safety policy.
- Running long soak tests unless the repo owner explicitly asks for them.
- Treating unverified security candidates as confirmed vulnerabilities.

## Further Notes

Pickup context:

- Worktree: `.claude/worktrees/static-runtime-audit`
- Branch: `worktree-static-runtime-audit`
- Base: `dev` at `ea0a111d2b3f8573f7ae4c7c1e7cad1860e010e9`

Recommended output locations:

- Raw static artifacts: `artifacts/code-health-audit/2026-06-20/static/`
- Runtime logs and coverage: `artifacts/code-health-audit/2026-06-20/runtime/`
- Final human report: `docs/reports/2026-06-20-static-runtime-code-health-audit.md`

Recommended audit report shape:

- Executive summary with the highest-confidence actions.
- Environment and baseline section.
- Static analysis findings.
- Runtime gate and smoke results.
- Runtime coverage interpretation, if collected.
- Dead-code candidates with confidence and deletion blockers.
- Deprecation candidates with replacement surfaces.
- Bug findings with repro evidence.
- False positives and intentional live entrypoints.
- Proposed follow-up slices in safe order.

Suggested first pass:

1. Install dependencies in the worktree if needed.
2. Check encrypted secret status and render only the local cache needed for safe
   runtime checks.
3. Run Fallow project discovery before interpreting dead-code output.
4. Run static passes and save JSON artifacts.
5. Run native quality gates and save logs.
6. Run smoke paths and save traces/logs.
7. Merge runtime coverage into health analysis if coverage was captured.
8. Write the final report without changing source behavior.

The important discipline is to make every conclusion falsifiable. "Looks unused"
is not enough; the report should say which graph, command, test, smoke, or trace
made the finding believable.
