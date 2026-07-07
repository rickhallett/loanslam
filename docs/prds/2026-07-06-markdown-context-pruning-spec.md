# Markdown Context Pruning Spec - 2026-07-06

Status: active cleanup spec

## Problem

Markdown is executable agent context in this repo. Old reports, closed PRDs,
proof receipts, package READMEs for legacy shells, and non-operational audit
notes can steer future agents as if they are current doctrine. The safe default
is now guilty until proven operational.

## Goal

Reduce tracked Markdown to the smallest operational set:

- current agent instructions and repo front doors
- current product, architecture, campaign, roadmap, operator, secret, and hook
  docs
- active campaign/spec cards
- compact evidence indexes that current commands or runbooks rely on

Everything else should be deleted from tracked context or moved to an ignored
local archive. Historical value is not enough to remain in git; git history is
the fallback for ordinary provenance.

## Inventory Scope

Commands run from `/Users/mrkai/code/loanslam` on `main`:

```bash
git worktree list --porcelain
git status --short --branch
just status-snapshot
git ls-files '*.md'
git ls-files --others --exclude-standard '*.md'
rg --files -uu -g '*.md' -g '!**/node_modules/**' -g '!.git/**' -g '!**/.git/**' -g '!dist/**' -g '!coverage/**' -g '!site/dist/**' -g '!packages/site-nuxt/.output/**' -g '!.claude/worktrees/**'
just --list
npm pkg get scripts --json
```

Observed inventory:

- 144 git-tracked Markdown paths before this pass.
- 0 untracked non-ignored Markdown paths.
- `CLAUDE.md` is a symlink to `AGENTS.md`, so `git ls-files` double-counts one
  instruction body.
- The root checkout had a pre-existing unrelated modification to
  `packages/site-nuxt/lib/content.ts`; this pass did not touch it.

## Decision Rules

KEEP only if the file is active authority for future work: agent doctrine,
current repo map, product boundary, architecture, campaign workflow, active
cards, active roadmaps, current operator instructions, secrets/hooks, or compact
evidence indexes used by current commands.

BURN if the file is derivative, generated, stale, superseded, tied to a retired
surface, or recoverable from git history without harming current operations.

QUARANTINE if the file has historical or evidence value but should be outside
normal repo context. The quarantine destination for this pass is ignored by
`.gitignore`:

```text
var/doc-archive/2026-07-06-hellfire/
```

Do not move a proof receipt that a still-tracked roadmap mechanically checks
without moving or rewriting the roadmap/checker layer in the same slice.

## Canonical Keep Set

These are operationally required unless a later cleanup replaces them with a
smaller equivalent:

- `AGENTS.md` and symlink `CLAUDE.md`
- `README.md`
- `CONTEXT.md`
- `.claude/skills/loanslam-operator/**.md`
- `docs/product-brief.md`
- `docs/llm-turn-planner-architecture.md`
- `docs/campaign-workflow-protocol.md`
- `docs/hell-week-gauntlet.md`
- `docs/hell-week-agent-loop-playbook.md`
- `docs/demo-concierge-runbook.md`
- `docs/integrated-poc-demo-runbook.md`
- `docs/phase-0-core-api-battery.md`
- `docs/stochastic-test-simulator-guide.md`
- `docs/roadmaps/README.md`
- `docs/prds/README.md`
- active cards/specs directly under `docs/prds/`
- `docs/loanslam-operator/README.md`
- `scripts/hooks/README.md`
- `secrets/README.md`
- `artifacts/evidence-index/*.md`

The `docs/loanslam-operator/01-*.md` manual pages remain a reduction target:
they are operational today, but they duplicate the thin skill and `just` surface
more than the new standard should tolerate.

## First Burn Pass

The following files were moved to the ignored archive destination and should
leave tracked Markdown in this cleanup:

```text
docs/non-operational/doc-cleanup/2026-06-20-documentation-audit-cleanup-prd.md
docs/non-operational/doc-cleanup/2026-06-20-documentation-audit-recommendation-matrix.md
docs/non-operational/hell-week-measurement-integrity-runway-log-2026-06-20.md
docs/non-operational/reusable-worktree-branch-cicd-protocol.md
docs/reports/2026-06-16-hell-week-full-summary.md
docs/reports/2026-06-16-hell-week-iteration-1-stability-summary.md
docs/reports/2026-06-20-repository-surface-audit.md
docs/reports/2026-06-20-static-runtime-code-health-audit.md
docs/reports/2026-06-23-full-repo-code-review.md
docs/reports/hell-week-performance-regression-report-2026-06-20.md
packages/demo-host/README.md
packages/demo-widget/README.md
packages/review-host/README.md
site/docs/2026-06-20-application-flow-link-audit.md
site/docs/live-application-capture/README.md
site/docs/live-application-capture/retention-2026-07-06.md
```

The local archive preserves the original relative paths under:

```text
var/doc-archive/2026-07-06-hellfire/
```

Expected tracked-Markdown count after this pass is committed: 129 paths
(144 original - 16 archived + this spec).

## Second Burn Pass (2026-07-07)

Continuation of this spec, executed by an independent agent session that
found this spec uncommitted and picked it up. Verified the first burn pass
was intact (16 archive copies present, 16 matching working-tree deletions, no
data loss) before proceeding.

Method: for every remaining `docs/prds/closed/*.md` and `docs/reports/*.md`
file, ran a mechanical exact-path reference check across all other tracked
Markdown and YAML (`git grep -l --fixed-strings <path>`), excluding the
now-historical 2026-07-01 classification matrix as a noise source. Files with
zero live references went through a two-stage agent pass: content review
(does it hold any rule/boundary not already captured in product-brief,
architecture doc, decision log, campaign protocol, or an active card? default
QUARANTINE otherwise) followed by an adversarial second check that grepped
for the file's title and distinctive topic phrases (prose/paraphrase
references, not just exact paths) and was instructed to override to KEEP on
any concrete finding.

Result: 25 of 25 candidates confirmed QUARANTINE with zero overrides on
adversarial re-check (22 closed PRDs, 3 reports). Moved to the same ignored
archive root, preserving relative paths:

```text
docs/prds/closed/2026-07-02-site-nuxt-arc-002-agenda-card.md
docs/prds/closed/2026-07-01-integrated-poc-handoff-capture-form-agenda-card.md
docs/prds/closed/2026-06-29-validator-layer-quality-review.md
docs/prds/closed/2026-06-21T090837Z-hell-week-openai-judge-and-safety-runway.md
docs/prds/closed/2026-06-21-release-gate-stability-and-demo-readiness-spec.md
docs/prds/closed/2026-06-21-judge-trust-release-candidate-arc-prd.md
docs/prds/closed/2026-06-21-engine-safety-guard-robustness-spec.md
docs/prds/closed/2026-06-21-calibration-foundations-spec.md
docs/prds/closed/2026-06-20-website-copy-config-prd.md
docs/prds/closed/2026-06-20-test-signal-trust-strategy-spec.md
docs/prds/closed/2026-06-20-static-runtime-code-health-audit-prd.md
docs/prds/closed/2026-06-20-repository-surface-audit-prd.md
docs/prds/closed/2026-06-20-hellweek-judge-foundation-handoff.md
docs/prds/closed/2026-06-20-hell-week-performance-regression-analysis-prd.md
docs/prds/closed/2026-06-20-hell-week-measurement-integrity-sequential-runway-prd.md
docs/prds/closed/2026-06-20-hell-week-judge-trustworthiness-prd.md
docs/prds/closed/2026-06-20-hell-week-coverage-expansion-spec.md
docs/prds/closed/2026-06-20-customer-facing-agent-acceptance-spec.md
docs/prds/closed/2026-06-20-application-flow-site-style-parity-prd.md
docs/prds/closed/2026-06-15-structured-signal-routing-prd.md
docs/prds/closed/2026-06-14-stochastic-test-simulator-prd.md
docs/prds/closed/2026-06-16-stakeholder-demo-safe-display-boundary-prd.md
docs/reports/2026-07-06-railway-decommission-inventory.md
docs/reports/2026-07-06-design-patterns-audit.md
docs/reports/2026-07-06-design-pattern-refactor-implementation-log.md
```

**Not touched this pass (reference-blocked, verified not just assumed):**

- 13 `docs/prds/closed/*.md` files named by path in
  `docs/core-product-decision-log.yaml`, a roadmap `receipt:`/prose
  reference, `AGENTS.md`, or `docs/campaign-workflow-protocol.md`.
- All 36 `artifacts/**/*.md` receipts: every one is a roadmap `receipt:`
  path; `scripts/campaign-consistency-check.mjs` would fail if any moved
  without a coordinated roadmap/checker rewrite (see High-Priority Remaining
  Burn Targets item 2, unchanged).
- 5 `docs/reports/*.md` files: one hard roadmap receipt
  (`2026-07-01-widget-adapter-sunset-assessment.md`), two cited by the active
  `2026-07-06-design-pattern-refactor-spec.md`
  (`2026-07-06-mal-service-layer-fit-audit.md`,
  `2026-07-06-design-patterns-audit-staff-bar.md`), and two cited as
  provenance from kept evidence-index docs
  (`2026-07-05-adversarial-cleanup-review.md`,
  `2026-07-02-concierge-probe-report.md`).
- `docs/loanslam-operator/*` — deferred per the original High-Priority Remaining
  Burn Targets item 4; reducing it is a content rewrite of a live skill
  manual, not a mechanical reference-blocked move.

**Non-doc finding surfaced during review (not acted on here):** the validator
review flagged that `packages/core/src/policy.ts`'s
`sensitiveOversharePattern` has drifted from its four sibling credential-guard
patterns (missing `payment_credentials`, has `dob` when the others do not) —
a live safety-relevant maintainability gap, not a documentation issue. Flagged
for a separate code slice, not fixed in this pass.

Expected tracked-Markdown count after this pass is committed: 104 paths
(129 after first pass - 25 archived this pass). Verify with
`git ls-files '*.md' | wc -l` post-commit.

## High-Priority Remaining Burn Targets

1. `docs/prds/closed/*.md`
   - Classification: QUARANTINE.
   - Reason: every file is explicitly historical. Current starts are active
     campaign cards, active roadmaps, the decision log, and the campaign
     workflow protocol.
   - Blocker: `docs/core-product-decision-log.yaml` and roadmap provenance
     links still point at selected closed files. Move only with a link-repair or
     "archived in git history" policy.

2. Closed roadmaps plus completed receipt Markdown under `artifacts/`
   - Classification: QUARANTINE as a cluster.
   - Reason: proof receipts and completed roadmaps are historical evidence, not
     active execution context.
   - Blocker: `scripts/campaign-consistency-check.mjs` requires completed
     roadmap receipt paths to exist. Retire/rewrite closed roadmaps and receipt
     checks in the same slice before moving those receipts.

3. `docs/reports/*.md`
   - Classification: BURN or QUARANTINE by report.
   - Keep temporarily only when an active card directly cites the report as
     input, such as the current design-pattern and cleanup reports.
   - Convert stable decisions into `CONTEXT.md`, `README.md`, active cards, or
     `docs/core-product-decision-log.yaml`; archive the narrative report.

4. `docs/loanslam-operator/01-*.md`, `08-examples.md`, `09-reference.md`,
   `10-troubleshooting.md`, and `qa-checklist.md`
   - Classification: KEEP_FOR_NOW, reduce next.
   - Reason: operational, but too broad for the new context budget.
   - Target end state: one human README plus the thin `.claude/skills`
     dispatcher; details should live in `just --list`, scripts, or compact
     references.

5. Legacy package docs for non-keeper surfaces
   - Classification: BURN unless a current campaign names the package.
   - First pass moved `packages/demo-host/README.md`,
     `packages/demo-widget/README.md`, and `packages/review-host/README.md`.
   - Do not delete source packages in this doc cleanup; source retirement is a
     separate live-surface decision.

## Execution Plan

1. Archive self-contained zombie Markdown to ignored `var/doc-archive/...`.
2. Add this spec and the `AGENTS.md` backref.
3. Verify the archive copies exist and only intended Markdown paths changed.
4. In a later coordinated slice, retire closed PRD/roadmap/proof-receipt
   clusters together so `campaign-consistency-check` does not fail on missing
   historical receipt paths.
5. Condense the operator manual and remove duplicated pages once the README and
   skill references carry the required workflow.

## Acceptance Criteria

- The root active context points here before trusting old Markdown.
- The first burn pass removes at least the 16 archived zombie docs from tracked
  Markdown.
- No current product/application code is changed by this cleanup.
- No proof receipt required by an active roadmap is moved.
- Future burn passes preserve either a working mechanical checker path or an
  explicit replacement policy for closed evidence.

## Verification

Use these commands:

```bash
git status --short -- '*.md'
git ls-files --deleted '*.md'
find var/doc-archive/2026-07-06-hellfire -type f -name '*.md' | sort
git diff -- AGENTS.md docs/prds/2026-07-06-markdown-context-pruning-spec.md
git diff --stat -- '*.md'
```
