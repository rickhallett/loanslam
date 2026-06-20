# Repository Surface Audit PRD - 2026-06-20

Status: Complete
Owner: Codex
Branch: `worktree-repo-surface-audit`
Worktree: `/Users/mrkai/code/loanslam/.claude/worktrees/repo-surface-audit`
Report: `docs/reports/2026-06-20-repository-surface-audit.md`

## Problem Statement

Loanslam now has several active surfaces: the Phase 0 TurnPlanner engine, Vercel
demo deployment wiring, Postgres-backed evidence storage, site content work,
local lab/demo apps, MCP tooling, secrets workflows, and a growing command
surface in the `Justfile`.

The repo is still small enough to understand, but it is no longer obvious where
architecture authority, build responsibility, runtime ownership, and operator
commands begin and end. A future agent needs a clean, evidence-backed map of the
repository before making larger cleanup, packaging, deployment, or architecture
changes.

## Solution

Run a read-first repository surface audit and produce a concise report that maps
the current repo structure, active architecture, build and verification process,
command surface, deployment path, secret workflow, and documentation authority.

The audit should not refactor the codebase. It should identify what exists, what
owns what, which commands are the real operator front doors, which docs are
authoritative, and which gaps create risk for future agents or human operators.

## User Stories

1. As a repo maintainer, I want a current repository map, so that I can see the
   active product, engine, site, demo, evidence, and deployment surfaces without
   reverse-engineering the tree every time.
2. As a future implementation agent, I want the active architecture boundaries
   named plainly, so that I do not confuse the Phase 0 engine with later
   productisation work.
3. As a future implementation agent, I want the build and verification commands
   grouped by purpose, so that I can choose the narrowest credible check for a
   change.
4. As a repo maintainer, I want the `Justfile` command surface audited against
   package scripts, so that stale, duplicated, missing, or misleading operator
   recipes are visible.
5. As a repo maintainer, I want workspace package roles summarized, so that each
   package has a clear reason to exist.
6. As a repo maintainer, I want deployment and database commands separated from
   local development commands, so that secret-dependent and environment-mutating
   workflows are not run casually.
7. As a future implementation agent, I want the current source-of-truth docs
   identified, so that old PRDs or evidence receipts do not overrule live
   architecture.
8. As a repo maintainer, I want documentation and command drift called out, so
   that cleanup work can be split into small follow-up slices.
9. As a repo maintainer, I want the audit to preserve private client and secret
   discipline, so that no decrypted values or proprietary content are copied into
   generated reports.
10. As a future reviewer, I want every claim in the audit to point to a command,
    file, package, or observed behavior, so that the report is useful evidence
    rather than vibes.

## Completed Work Items

- [x] Confirm the worktree branch and dirty state before starting.
- [x] Inventory the top-level repository structure and classify each directory
      by owner surface.
- [x] Inventory npm workspaces and package roles.
- [x] Compare root package scripts with workspace package scripts.
- [x] Inventory `Justfile` recipes and group them by quality gates, engine,
      evidence, local apps, database/deploy, secrets, and MCP.
- [x] Identify which `Justfile` recipes are pure local checks, which call a
      model, which need Postgres, and which may touch deployment sinks.
- [x] Trace the build process from package scripts through Vercel build wiring.
- [x] Trace local development entrypoints for the lab, demo, review, and site
      surfaces.
- [x] Map architecture authority across README, product brief, TurnPlanner
      architecture doc, PRDs, and current code shape.
- [x] Check whether README repository maps and source-of-truth links match the
      current tree.
- [x] Check whether documentation cleanup decisions remain aligned with the
      documentation audit recommendation matrix.
- [x] Identify missing or stale commands, scripts, docs, or package references.
- [x] Produce a concise audit report with findings, risks, and recommended next
      slices.
- [x] Leave code behavior unchanged unless the user explicitly approves a
      follow-up implementation slice.

## Implementation Decisions

- The primary output should be a repository audit report, not a code change.
- The audit should be observational first: inspect files and command surfaces,
  then make claims only where the current checkout supports them.
- The report should separate active architecture, operator commands, build and
  deployment workflow, evidence workflow, documentation authority, and risks.
- The report should prefer deletion or simplification recommendations over new
  abstractions unless an existing workflow is genuinely duplicated or unclear.
- The audit should keep secrets handling read-only. Use status and metadata
  commands only; do not print decrypted values.
- The audit should treat model-backed evidence commands differently from static
  build and test commands. Static commands prove local code health, while live
  lab and model-backed commands prove user-visible routing behavior.
- The audit should avoid broad rewrite work. Any proposed cleanup should be
  split into follow-up slices with clear verification commands.

## Testing Decisions

- This PRD is for a docs and process audit, so the main verification is evidence
  quality rather than new automated tests.
- Run read-only inventory commands for tree shape, package scripts, workspace
  metadata, and `Justfile` recipes.
- If the audit report changes only Markdown, source tests are optional unless the
  report edits command examples that need validation.
- If the audit recommends or performs command-surface edits later, verify with
  the narrow command discovery checks first, then run broader build or test gates
  only if package metadata or executable scripts change.
- Do not run model-backed or database-mutating evidence commands merely to write
  the audit unless the user explicitly asks for fresh behavioral evidence.

## Suggested Audit Commands

These are starting points for the next agent to review and adapt:

```bash
git status --short --branch
git worktree list --porcelain
find . -maxdepth 2 -type d -not -path './.git*' -not -path './node_modules*' | sort
find packages -maxdepth 2 -name package.json -print | sort
just --list
npm pkg get scripts --json
npm --workspaces --if-present pkg get scripts --json
rg -n "docs/architecture.md|phase-0-human-validation-guide|TODO|FIXME" README.md docs packages site api scripts -g '*.md' -g '*.ts' -g '*.json'
```

## Expected Report Shape

- [x] Practical takeaway.
- [x] Repository surface map.
- [x] Architecture authority map.
- [x] Package and runtime ownership map.
- [x] Build and verification flow.
- [x] `Justfile` recipe taxonomy.
- [x] Secrets, database, and deployment boundaries.
- [x] Documentation authority and drift.
- [x] Risks and cleanup opportunities.
- [x] Recommended follow-up slices with verification commands.

## Out of Scope

- Rewriting architecture.
- Refactoring packages.
- Changing runtime behavior.
- Running production deployment mutations.
- Printing or copying decrypted secrets.
- Replacing the existing documentation audit cleanup work.
- Re-running full Hell Week or model-backed evidence batteries unless explicitly
  requested as a separate evidence slice.

## Further Notes

Current observed surfaces before this PRD was written:

- Root `Justfile` exposes the operator command surface.
- Root package scripts provide quality gates, workspace builds, Vercel build
  wiring, core CLI entrypoints, and local app entrypoints.
- The README presents the Phase 0 engine, evidence loop, Vercel/Neon demo path,
  and repository map.
- The TurnPlanner architecture doc is the current Phase 0 architecture authority.
- The documentation audit recommendation matrix records recent cleanup decisions
  and should be checked before reintroducing broad historical docs.
- This new worktree intentionally copied `.claude/` and `.fallow/` local agent
  context, and intentionally did not copy plaintext `.env` or `.env.local`
  caches.
