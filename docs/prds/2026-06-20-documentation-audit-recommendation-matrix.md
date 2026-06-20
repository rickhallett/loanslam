# Documentation Audit Recommendation Matrix - 2026-06-20

## Practical Takeaway

The repository is much smaller than the stale 2026-06-15 pruning spec describes,
but the remaining Markdown still mixes active authority, useful operator guides,
dated evidence receipts, and stale links. Keep the root/product/operator surface,
repair broken references, and delete old evidence summaries and completed broad
PRDs once this matrix is reviewed.

This matrix supersedes
`docs/prds/2026-06-15-markdown-context-pruning-spec.md` for the current tree.
That older spec is now prior art only.

Implementation status: the approved cleanup keeps this matrix as the decision
record, repairs the live authority/operator docs, and removes the P2 Markdown
receipts listed below. No source code behavior changes are part of this cleanup.

## Audit Scope

Commands used from this worktree:

```bash
git status --short --branch
git worktree list --porcelain
git ls-files '*.md' | sort
rg --files -uu -g '*.md' -g '!node_modules/**' -g '!.git/**' -g '!dist/**' -g '!coverage/**' | sort
git log --oneline --max-count=40 -- '*.md'
just --list
npm pkg get scripts --json
```

Observed scope:

- 28 tracked Markdown paths from `git ls-files '*.md'`.
- 29 visible Markdown paths from `rg --files` before this matrix was written,
  because
  `docs/prds/2026-06-20-documentation-audit-cleanup-prd.md` is currently
  untracked.
- This matrix is the generated audit artifact and becomes the next visible
  Markdown path after the audit write.
- `CLAUDE.md` is a tracked symlink to `AGENTS.md`.
- Recent history includes `2c63aea docs: Prune stale context documents`, which
  removed the previous broad docs, presentation docs, local agent prompt, old
  superpowers plans, and some broad PRDs.

## Decision Rules

- **KEEP** means the file remains useful normal context after this audit.
- **EDIT** means keep the file, but remove stale claims, fix links, or narrow its
  authority.
- **DELETE** means remove the Markdown file from normal repo context. Preserve raw
  JSON, database-backed evidence, or source code where those are the real source
  of truth.

Prefer deletion over archive sprawl unless there is a concrete compliance,
evidence, or product-reconstruction reason to keep a Markdown receipt.

## Recommendation Matrix

| Priority | Decision | Path | Current reader / role | Evidence | Recommendation |
|---|---|---|---|---|---|
| P0 | EDIT | `AGENTS.md` | Root agent authority | Current file points at stale `2026-06-15` pruning spec. `CLAUDE.md` symlinks here. | Replace stale backref with this matrix. Keep all branch/worktree/secret discipline. |
| P0 | KEEP | `CLAUDE.md` | Compatibility entrypoint | `ls -l` shows `CLAUDE.md -> AGENTS.md`. | Keep symlink. No separate content. |
| P0 | KEEP | `CONTEXT.md` | Shared vocabulary | Terms match current Phase 0 architecture: `TurnPlanner`, `TurnPlan`, `ValidatedTurnResult`, serving mode, handoff intake. | Keep as active glossary. |
| P0 | EDIT | `README.md` | Repo front door and command map | `just --list` and package scripts match most commands, but README links missing `docs/architecture.md` and `docs/phase-0-human-validation-guide.md`. | Fix source-of-truth list, remove missing docs, point architecture readers at `docs/llm-turn-planner-architecture.md` plus `docs/product-brief.md`. |
| P0 | EDIT | `docs/product-brief.md` | Product/safety boundary | Still links missing `docs/architecture.md` and contains old 30-day AWS framing, partly superseded by its own Phase 0 note. | Keep product boundary; remove or narrow stale deployment/deadline wording and missing architecture link. |
| P0 | KEEP | `docs/llm-turn-planner-architecture.md` | Current Phase 0 engine architecture | Matches live package shape: `packages/core`, signal extraction, retrieval, planner, validator, trace, lab/demo surfaces. | Keep as primary architecture doc. |
| P0 | KEEP | `docs/phase-0-core-api-battery.md` | Compact route/API battery | Scenarios match current engine risk classes and complement `just core-*` surfaces. | Keep as operator input for focused route checks. |
| P0 | EDIT | `docs/hell-week-gauntlet.md` | Hell Week operator guide | Commands exist, and `packages/core/src/hellweek/*` exists. First paragraph links missing `artifacts/phase0/burn-regression-testing/agent-hell-battery-2026-06-15.md`. | Keep guide; replace missing artifact-source reference with current source paths and evidence index. |
| P0 | EDIT | `docs/hell-week-agent-loop-playbook.md` | Tuning-loop playbook | Commands exist, but the named baseline run directory is not present in this checkout. Newer DB-backed replay commands live in `artifacts/evidence-index/hell-week-runs.md`. | Keep loop shape; replace stale baseline artifact with evidence-index/Postgres replay guidance. |
| P0 | KEEP | `artifacts/evidence-index/hell-week-runs.md` | Compact DB-backed evidence index | Created from imported Postgres reports, includes 2026-06-20 runs, and replay commands use current `just hell-week -- --from-db`. | Keep as current index. It should remain an index, not a narrative report. |
| P1 | KEEP | `docs/stochastic-test-simulator-guide.md` | STS operator guide | `just core-stochastic` exists and STS source/tests exist under `packages/core/src/stochastic`. | Keep. Generated example Markdown paths are examples, not retained docs. |
| P1 | KEEP | `docs/prds/2026-06-14-stochastic-test-simulator-prd.md` | Durable STS product/evidence contract | STS is implemented and paired with the current operator guide. | Keep as tool contract. |
| P1 | KEEP | `docs/prds/2026-06-15-structured-signal-routing-prd.md` | Current route-evidence decision record | Matches live signal extractor/retrieval direction in `packages/core/src/signals` and architecture doc. | Keep as concise decision history. |
| P1 | KEEP | `docs/prds/2026-06-16-stakeholder-demo-safe-display-boundary-prd.md` | Demo display-boundary contract | Live code includes `packages/core/src/lab/demoDisplay.ts`, demo state token tests, `/demo` API, and demo/review widgets. | Keep as active safety/display contract. |
| P1 | KEEP | `docs/prds/2026-06-20-site-widget-integration-architecture-prd.md` | Site/widget integration architecture | Recent site/widget work exists in sibling worktrees; doc clearly separates iframe adapter from future native host API. | Keep, but treat as site integration authority, not Phase 0 engine authority. |
| P1 | KEEP | `docs/prds/2026-06-20-documentation-audit-cleanup-prd.md` | Audit setup PRD | Currently untracked, but it defines this audit and explicitly demotes the older pruning spec. | Track it with this branch if the audit PRD should remain; otherwise this matrix can supersede it after cleanup lands. |
| P1 | KEEP | `docs/prds/2026-06-20-documentation-audit-recommendation-matrix.md` | Generated audit artifact | Created by this audit as the current recommendation matrix and `AGENTS.md` backref target. | Keep while cleanup is being executed. After cleanup lands, either keep as the decision record or replace with a shorter docs-health note. |
| P1 | KEEP | `packages/demo-host/README.md` | Current Loanslam demo host guide | `packages/demo-host`, `packages/demo-widget`, and `just demo` exist; README describes demo-safe API boundary. | Keep. |
| P1 | EDIT | `packages/review-host/README.md` | Legacy MAL review demo guide | `packages/review-host`, `packages/review-widget`, and `just review` exist, but MAL branding can over-steer future Loanslam context. | Keep while `just review` exists; add clearer legacy/review-only framing or remove with the review packages later. |
| P1 | KEEP | `secrets/README.md` | Secret workflow guide | Commands match `just secrets-*`; aligns with `AGENTS.md` secret discipline. | Keep. |
| P1 | KEEP | `site/docs/live-application-capture/README.md` | Site/application capture index | Current 2026-06-20 capture for offline/static customer-journey prototype; scoped to site work. | Keep as source index for the local apply-flow prototype. |
| P2 | EDIT | `docs/phase-0-static-routing-restraint-audit-2026-06-15.md` | Dated static-restraint decision note | Contains useful principle, but claims file-by-file checked line numbers from 2026-06-15. Code and evidence surfaces have moved since then. | Keep only if edited into a dated decision note. Remove line-number authority or mark as historical. |
| P2 | DELETE | `docs/prds/2026-06-13-phase-0-engine-stakeholder-readiness-prd.md` | Completed readiness PRD | Later docs, Hell Week, demo display boundary, and DB-backed evidence supersede this readiness runway. | Delete after confirming no unique current decision remains. |
| P2 | DELETE | `docs/prds/2026-06-15-llm-centric-intelligence-prd.md` | Broad strategic PRD | Useful historical frame, but too broad for active context. Distilled direction lives in structured signal routing and architecture docs. | Delete from normal context. |
| P2 | DELETE | `docs/prds/2026-06-15-markdown-context-pruning-spec.md` | Stale prior pruning spec | It references deleted files such as `docs/architecture.md`, old superpowers docs, and many artifact summaries. This matrix supersedes it. | Delete after `AGENTS.md` and README no longer point at it. |
| P2 | DELETE | `docs/phase-0-stakeholder-evidence.md` | Old stakeholder evidence receipt | Claims current head at commit `e257e6b`; listed artifacts are not present in this checkout. | Delete. Use current Hell Week DB index and live reruns instead. |
| P2 | DELETE | `docs/phase-0-lab-scenario-analysis-2026-06-14.md` | Old lab analysis receipt | Cites `artifacts/phase0/lab-session-notes-2026-06-14.md`; fixes in its trial log have already been absorbed. | Delete. |
| P2 | DELETE | `docs/phase-0-lab-api-battery-26-analysis-2026-06-14.md` | Old lab API battery analysis | Cites missing `artifacts/phase0/lab-api-battery-26-2026-06-14/summary.md`; current compact battery and Hell Week evidence supersede it. | Delete. |
| P2 | DELETE | `artifacts/phase0/lab-session-notes-2026-06-14.md` | Old human lab notes | Long dated transcript notes under artifact path; later analysis and current route batteries supersede it. | Delete Markdown receipt. Preserve raw evidence only if still present and useful. |
| P2 | DELETE | `artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/report.md` | Old generated model-probe summary | Raw JSON evidence exists beside it; recommendation is dated and model/provider assumptions may drift. | Delete Markdown summary; keep JSON artifacts if needed. |

## Broken Or Risky References Found

- `README.md` links `docs/architecture.md`, which was deleted by
  `2c63aea docs: Prune stale context documents`.
- `README.md` links `docs/phase-0-human-validation-guide.md`, also deleted by
  the pruning commit.
- `docs/product-brief.md` says technology and architecture decisions live in
  `docs/architecture.md`, which no longer exists.
- `docs/hell-week-gauntlet.md` references
  `artifacts/phase0/burn-regression-testing/agent-hell-battery-2026-06-15.md`,
  which is not present in this checkout.
- Older lab analysis docs reference artifact Markdown paths that are not present
  or should no longer be normal context.

## Recommended Cleanup Slices

1. **Audit/backref slice**
   - Track this matrix and the audit PRD if desired.
   - Point `AGENTS.md` at this matrix instead of the stale 2026-06-15 spec.

2. **Authority link repair slice**
   - Edit `README.md`, `docs/product-brief.md`, `docs/hell-week-gauntlet.md`,
     `docs/hell-week-agent-loop-playbook.md`, and
     `packages/review-host/README.md`.
   - Do not change source code behavior.

3. **Historical receipt deletion slice**
   - Delete the P2 stale PRDs, old lab analyses, and artifact Markdown summaries.
   - Repair any references revealed by `rg` after deletion.

4. **Optional demotion slice**
   - Either edit `docs/phase-0-static-routing-restraint-audit-2026-06-15.md`
     into a dated decision note or delete it after promoting its one durable
     rule into the architecture doc: static tests guard hard invariants; live
     model-backed evidence owns natural-language routing quality.

## Verification Commands For Cleanup

```bash
git status --short --branch
git ls-files '*.md' | sort
rg --files -uu -g '*.md' -g '!node_modules/**' -g '!.git/**' -g '!dist/**' -g '!coverage/**' | sort
rg -n 'docs/architecture.md|phase-0-human-validation-guide|agent-hell-battery|docs/prds/2026-06-15-markdown-context-pruning-spec|artifacts/phase0/lab-session-notes-2026-06-14.md|artifacts/phase0/cheap-model-quality-probe-2026-06-16T08-17-59Z/report.md|phase-0-lab-api-battery-26-analysis-2026-06-14|phase-0-lab-scenario-analysis-2026-06-14|phase-0-stakeholder-evidence' AGENTS.md README.md docs packages site secrets artifacts -g '*.md' -g '!docs/prds/2026-06-20-documentation-audit-recommendation-matrix.md'
just --list
npm pkg get scripts --json
```

Run source tests only if a cleanup slice touches package metadata, command
surface, or generated docs that participate in builds.
