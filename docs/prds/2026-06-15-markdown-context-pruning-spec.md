# Markdown Context Pruning Spec

## Problem Statement

The repository has enough Markdown that future agents can be steered by stale
run summaries, generated presentation copy, unchecked implementation plans, and
historical evidence snapshots. In an agent-heavy workflow, every durable context
line is eventual prompt material. Treat Markdown like code: every line must earn
its place.

The current documentation set mixes four different things:

- standing product and engineering authority
- current implementation direction
- historical plans and PRDs
- generated or dated evidence receipts

The risk is not only contradiction. The larger risk is context poisoning: old
metrics, old failure modes, and derivative prose can outrank fresher runtime
evidence simply because they are easier for an agent to find and quote.

## Goal

Reduce the active Markdown surface to a small, trustworthy context set.

The cleanup should:

- keep only docs that define current product, Phase 0, architecture, commands, or
  executable cleanup direction
- burn or quarantine docs that are historical, generated, stale, or likely to
  steer future agents incorrectly
- preserve raw evidence where useful without letting human-readable summaries
  masquerade as current truth
- leave explicit anti-poison markers where stale folders remain temporarily

## Definitions

- **KEEP**: allowed to remain in normal agent context and be treated as useful
  current guidance.
- **BURN**: delete, quarantine outside normal context, or replace with a short
  superseded pointer. Do not let it remain a normal source of truth.
- **QUARANTINE**: move to an archive/evidence area ignored by normal agent
  discovery, with a clear stale or historical label.
- **BACKREF**: a short pointer from standing agent instructions to this spec, not
  a duplicate of the spec content.

## Inventory Scope

Audit basis:

- 58 Markdown paths found with `rg --files -uu -g '*.md'` excluding
  `node_modules`, `.git`, `dist`, and `coverage`.
- 33 tracked Markdown entries from `git ls-files '*.md'`.
- `CLAUDE.md` is tracked as a symlink to `AGENTS.md`; include it as the same
  authority surface even though `rg --files` did not list it.
- `just --list` and root npm scripts were checked so command docs could be judged
  against the live command surface.

## Decision Rules

1. Keep canonical docs short and explicit about authority.
2. Prefer current runtime checks over historical narrative.
3. Evidence artifacts may exist, but human-readable Markdown summaries should not
   be active context unless they are the current review entrypoint.
4. Completed task plans are historical receipts, not agent instructions.
5. Generated presentation, recruiter, or model-written interpretation prose is
   not engineering source of truth.
6. If a doc says "current", "source of truth", "must", or "non-negotiable", it
   must be fresher than the code and command surface it describes.
7. If a doc is useful only as a dated receipt, either burn it or mark it as a
   dated receipt in a quarantine location.

## Ranked Decisions

### P0 KEEP - Active Authority

These files should remain normal agent context.

| Decision | Path | Why |
|---|---|---|
| KEEP | `AGENTS.md` | Standing repo agent contract. |
| KEEP | `CLAUDE.md` | Symlink to `AGENTS.md`; safe duplicate entrypoint. |
| KEEP | `CONTEXT.md` | Current shared vocabulary and ambiguity resolutions. |
| KEEP | `README.md` | Repo front door and live command guide. |
| KEEP | `docs/product-brief.md` | Product boundary and safety contract. |
| KEEP | `docs/llm-turn-planner-architecture.md` | Current Phase 0 architecture. |
| KEEP | `docs/architecture.md` | Eventual stack, explicitly not first build slice. |
| KEEP | `docs/prds/2026-06-14-phase-0-policy-authority-consolidation-prd.md` | Explains authority consolidation and docs-as-liability direction. |
| KEEP | `docs/prds/2026-06-15-structured-signal-routing-prd.md` | Current branch-relevant route-evidence direction. |
| KEEP | `docs/phase-0-static-routing-restraint-audit-2026-06-15.md` | Current deletion/test discipline. |
| KEEP | `docs/phase-0-core-api-battery.md` | Compact live API battery, useful as current operator input. |

### P1 KEEP - Useful But Not Primary Authority

These can stay, but should not outrank P0 docs.

| Decision | Path | Why |
|---|---|---|
| KEEP | `docs/stochastic-test-simulator-guide.md` | Operator guide for STS. |
| KEEP | `docs/prds/2026-06-14-stochastic-test-simulator-prd.md` | STS product/evidence contract. |
| KEEP | `docs/prds/2026-06-15-lab-api-mcp-session-simulator-prd.md` | Local evidence tooling contract. |
| KEEP | `docs/prds/2026-06-14-intake-form-fallback-prd.md` | Focused pending behavior spec. |
| KEEP | `docs/superpowers/specs/2026-06-13-phase-0-turnplanner-core-design.md` | Concise design record without unchecked plan steps. |
| KEEP | `packages/demo-host/README.md` | Current demo host instructions. |
| KEEP | `artifacts/phase0/lab-api-battery-rerun-2026-06-14T20-50-33Z/STALE_DO_NOT_USE.md` | Anti-poison marker while stale folder exists. |

### P2 BURN - Agent-Prompt And Generated-Prose Poison

Remove or quarantine these first. They read authoritative while being derivative
or agent-shaped.

| Decision | Path | Why |
|---|---|---|
| BURN | `docs/agents/documentation-auditor-agent.md` | Repo-local agent prompt; recursively steers future agents. |
| BURN | `docs/presentation/README.md` | Presentation context, not engineering context. |
| BURN | `docs/presentation/gemini-interpet-trace.md` | Generated interpretation prose. |
| BURN | `docs/presentation/gemini-recruiter-minded-from-trace.md` | Recruiter framing, not product truth. |
| BURN | `docs/presentation/gemini-recruiter-minded-whole-repo.md` | Recruiter framing, not product truth. |
| BURN | `docs/presentation/gemini-technically-minded-from-trace.md` | Analogy-heavy generated explanation. |
| BURN | `packages/review-host/README.md` | MAL review/mock branding context can poison Loanslam direction. |

### P3 BURN - Completed Implementation Plans

These contain unchecked task lists and workflow commands. They are historical
receipts, not standing instructions.

| Decision | Path |
|---|---|
| BURN | `docs/superpowers/plans/2026-06-13-phase-0-turnplanner-core.md` |
| BURN | `docs/superpowers/plans/2026-06-13-phase-0-simulator-lab.md` |
| BURN | `docs/superpowers/plans/2026-06-13-phase-0-engine-stakeholder-readiness.md` |
| BURN | `docs/superpowers/plans/2026-06-14-stochastic-test-simulator.md` |
| BURN | `docs/superpowers/plans/2026-06-15-lab-api-mcp-session-simulator.md` |

### P4 BURN - Broad Or Future Specs That Pull Scope

These may contain useful thinking, but they should not remain active context in
their current form.

| Decision | Path | Why |
|---|---|---|
| BURN | `docs/prds/2026-06-15-llm-centric-intelligence-prd.md` | Too broad; pulls Phase 0 toward multi-model architecture. |
| BURN | `docs/prds/2026-06-15-phase-0-turnplanner-caching-prd.md` | Future optimization with policy risk. |
| BURN | `docs/prds/2026-06-13-phase-0-engine-stakeholder-readiness-prd.md` | Completed readiness slice; stale current-claim risk. |
| BURN | `docs/prds/2026-06-14-phase-0-conversation-quality-evidence-prd.md` | Useful historical evidence, but stale as active direction. |

### P5 BURN - Dated Analysis Docs

These summarize old runs or old failure shapes. Preserve only distilled decisions
in current docs.

| Decision | Path |
|---|---|
| BURN | `docs/phase-0-human-validation-guide.md` |
| BURN | `docs/phase-0-stakeholder-evidence.md` |
| BURN | `docs/phase-0-lab-scenario-analysis-2026-06-14.md` |
| BURN | `docs/phase-0-lab-api-battery-26-analysis-2026-06-14.md` |

### P6 BURN - Artifact Markdown

Burn all Markdown under `artifacts/phase0/` except the stale warning marker kept
above. Raw JSON/JSONL artifacts can remain if still useful; Markdown summaries
should not stay in normal agent context.

| Decision | Path |
|---|---|
| BURN | `artifacts/phase0/lab-session-notes-2026-06-14.md` |
| BURN | `artifacts/phase0/lab-api-battery-26-2026-06-14/summary.md` |
| BURN | `artifacts/phase0/lab-api-battery-rerun-2026-06-14T20-50-33Z/battery-20/logs/summary.md` |
| BURN | `artifacts/phase0/lab-api-battery-rerun-2026-06-14T20-50-33Z/battery-26/logs/summary.md` |
| BURN | `artifacts/phase0/lab-api-battery-rerun-fresh-2026-06-14T20-59-56Z/battery-20/logs/summary.md` |
| BURN | `artifacts/phase0/lab-api-battery-rerun-fresh-2026-06-14T20-59-56Z/battery-26/logs/summary.md` |
| BURN | `artifacts/phase0/lab-api-battery-rerun-fresh-2026-06-14T20-59-56Z/battery-26/logs/route-audit.md` |
| BURN | `artifacts/phase0/lab-api-failure-mode-battery-20260615T093345Z/logs/summary.md` |
| BURN | `artifacts/phase0/shadow-signal-extraction/20260615T082341Z/operator-summary.md` |
| BURN | `artifacts/phase0/shadow-signal-extraction/20260615T084822Z/operator-summary.md` |
| BURN | `artifacts/phase0/stakeholder-hell-test/REPORT.md` |
| BURN | `artifacts/phase0/stochastic-summary-2026-06-14-smoke.md` |
| BURN | `artifacts/phase0/stochastic-summary-2026-06-14-smoke-final.md` |
| BURN | `artifacts/phase0/burn-battery/STATE-OF-PLAY.md` |
| BURN | `artifacts/phase0/burn-battery/sts-review/stochastic-summary-1.md` |
| BURN | `artifacts/phase0/burn-regression-testing/agent-hell-battery-2026-06-15.md` |
| BURN | `artifacts/phase0/openai-model-family-probe-2026-06-15T04-46-31Z/summary.md` |
| BURN | `artifacts/phase0/openai-model-family-probe-2026-06-15T04-49-25Z/summary.md` |
| BURN | `artifacts/phase0/openai-model-family-probe-2026-06-15T04-50-12Z/summary.md` |
| BURN | `artifacts/phase0/openai-model-family-probe-2026-06-15T04-57-24Z/summary.md` |
| BURN | `artifacts/phase0/openai-model-family-probe-2026-06-15T05-02-26Z/summary.md` |

## Execution Plan

1. Add this spec and one backref in `AGENTS.md`.
2. Confirm no unrelated Markdown changes are present.
3. Burn P2 generated/agent-prompt docs first.
4. Burn or quarantine P3 completed implementation plans.
5. Burn P4 and P5 stale specs/analysis after checking whether any current decision
   needs to be promoted into a P0/P1 doc.
6. Burn artifact Markdown in P6, preserving raw JSON/JSONL evidence where useful.
7. Re-run Markdown inventory and verify the active context set is small.
8. Update `README.md` only if deleted docs are still linked there.

## Acceptance Criteria

- `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `README.md`, and P0/P1 docs remain.
- No generated presentation prose remains under `docs/`.
- No repo-local agent prompt remains under `docs/agents/`.
- No unchecked historical implementation plan remains in active docs.
- No stale artifact Markdown remains under `artifacts/phase0/` except explicit
  stale markers.
- README documentation links point only to surviving current docs.
- `rg --files -uu -g '*.md' -g '!node_modules/**' -g '!.git/**' -g '!dist/**' -g '!coverage/**'`
  returns only the intended active Markdown set plus any explicit quarantine.
- The cleanup does not change source code behavior.

## Verification Commands

```bash
git status --short -- '*.md'
rg --files -uu -g '*.md' -g '!node_modules/**' -g '!.git/**' -g '!dist/**' -g '!coverage/**'
git ls-files '*.md'
rg -n "docs/presentation|docs/agents|docs/superpowers/plans|artifacts/phase0/.+\\.md" README.md AGENTS.md docs || true
just --list
```

Run source gates only if the cleanup touches linked command docs or package files.
