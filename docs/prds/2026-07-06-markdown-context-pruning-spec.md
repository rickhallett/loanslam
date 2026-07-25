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

**Not touched this pass, deliberately (reference-blocked, verified not just
assumed) — all archived in the third burn pass instead, see below:**

- 13 `docs/prds/closed/*.md` files named by path in
  `docs/core-product-decision-log.yaml`, a roadmap `receipt:`/prose
  reference, `AGENTS.md`, or `docs/campaign-workflow-protocol.md`.
- All 36 `artifacts/**/*.md` receipts: every one is a roadmap `receipt:`
  path; `scripts/campaign-consistency-check.mjs` would fail if any moved
  without a coordinated roadmap/checker rewrite.
- 5 `docs/reports/*.md` files: one hard roadmap receipt
  (`2026-07-01-widget-adapter-sunset-assessment.md`), two cited by the active
  `2026-07-06-design-pattern-refactor-spec.md`
  (`2026-07-06-mal-service-layer-fit-audit.md`,
  `2026-07-06-design-patterns-audit-staff-bar.md`), and two cited as
  provenance from kept evidence-index docs
  (`2026-07-05-adversarial-cleanup-review.md`,
  `2026-07-02-concierge-probe-report.md`).

`docs/loanslam-operator/*` was deferred per the original High-Priority
Remaining Burn Targets item 4; the operator later overrode that deferral
entirely (keep, not reduce — see the third burn pass).

**Non-doc finding surfaced during review (not acted on here):** the validator
review flagged that `packages/core/src/policy.ts`'s
`sensitiveOversharePattern` has drifted from its four sibling credential-guard
patterns (missing `payment_credentials`, has `dob` when the others do not) —
a live safety-relevant maintainability gap, not a documentation issue. Flagged
for a separate code slice, not fixed in this pass.

Expected tracked-Markdown count after this pass is committed: 104 paths
(129 after first pass - 25 archived this pass). Verify with
`git ls-files '*.md' | wc -l` post-commit.

## Third Burn Pass (2026-07-07, operator-directed)

The second pass applied a receipt-integrity lens: keep anything a mechanical
checker or live citation still points at. The operator rejected that lens for
this pass and asked a different question instead: not "is this referenced,"
but "would deleting this stop someone from building the next feature or
catching a real quality problem." Under that test, roughly 60% of what
survived the second pass was still audit trail, not reference material.

Content review (not just a reference grep) found two files the receipt-lens
pass would have wrongly filed as droppable:

- `docs/reports/2026-07-05-adversarial-cleanup-review.md` is not a stale
  report; it is a live 33-item numbered punch list (production-restart proof
  defaults to redeploying production, `clarification_loop` declared but never
  emitted, generated report allowlist fails open, and 30 more). At least one
  item has been separately checked off; the rest look open.
- `docs/reports/2026-07-01-widget-adapter-sunset-assessment.md` carries a
  still-binding constraint: freeze investment in `demo-host`/`demo-widget`
  until the Integrated POC has a deployed URL. Both packages still exist on
  disk, so the freeze is still active.

The operator was told this and explicitly overrode it anyway: **delete both,
along with every other file in `docs/reports/`, every file in
`docs/prds/closed/` (all 13, not just the 22 from pass two), and all 36
`artifacts/**/*.md` receipts** (their JSON/txt siblings — parity reports,
battery results, `evidence-index/baseline.json`,
`evidence-index/floor-delta-latest.json` — were left in place; live tooling
reads those, not the Markdown).

Archived, same destination as passes one and two
(`var/doc-archive/2026-07-06-hellfire/`, preserving relative paths):

```text
docs/prds/closed/2026-06-20-site-widget-integration-architecture-prd.md
docs/prds/closed/2026-06-30-integrated-poc-reference.md
docs/prds/closed/2026-07-01-documentation-cleanup-agenda-card.md
docs/prds/closed/2026-07-01-integrated-poc-arc-003-agenda-card.md
docs/prds/closed/2026-07-01-integrated-poc-implementation-agenda-card.md
docs/prds/closed/2026-07-02-concierge-probes-campaign-001-card.md
docs/prds/closed/2026-07-02-demo-concierge-campaign-001-card.md
docs/prds/closed/2026-07-02-demo-concierge-campaign-002-card.md
docs/prds/closed/2026-07-02-demo-resilience-campaign-001-card.md
docs/prds/closed/2026-07-02-integrated-poc-arc-004-agenda-card.md
docs/prds/closed/2026-07-02-site-nuxt-arc-001-agenda-card.md
docs/prds/closed/2026-07-02-site-nuxt-arc-003-agenda-card.md
docs/prds/closed/README.md
docs/reports/2026-07-01-widget-adapter-sunset-assessment.md
docs/reports/2026-07-02-concierge-probe-report.md
docs/reports/2026-07-05-adversarial-cleanup-review.md
docs/reports/2026-07-06-design-patterns-audit-staff-bar.md
docs/reports/2026-07-06-mal-service-layer-fit-audit.md
artifacts/concierge-probes/concierge-probes-001-closeout.md
artifacts/demo-concierge/*.md (11 files)
artifacts/demo-resilience/*.md (3 files)
artifacts/evidence-index/*.md (5 files)
artifacts/integrated-poc/*.md (11 files)
artifacts/site-nuxt/*.md (5 files)
```

`docs/loanslam-operator/*` was explicitly kept in full (see High-Priority
Remaining Burn Targets item 4 below) — the opposite direction from every
other cluster in this pass.

**Dangling references repaired in the same pass** (front doors and live docs
that pointed at now-archived files):

- `docs/prds/README.md` — rewrote the "cards move to `closed/`" workflow
  description; there is no tracked `closed/` anymore.
- `AGENTS.md` — removed two Working Notes bullets citing specific archived
  closed-card paths as provenance.
- `README.md` — removed the direct link to the now-archived
  `artifacts/evidence-index/hell-week-runs.md` and the "Closed PRDs... are
  provenance" line.
- `.claude/skills/loanslam-operator/references/evidence.md`,
  `docs/hell-week-gauntlet.md`, `docs/hell-week-agent-loop-playbook.md` —
  repointed from the archived human run index to the live Postgres-backed
  mechanism (`just hell-week-stability`).
- `docs/integrated-poc-demo-runbook.md` — repointed the widget-adapter-sunset
  citation from the archived report to decision log D039.
- `docs/campaign-workflow-protocol.md` — softened a specific closed-card
  filename citation to note it's archived.
- `docs/prds/2026-07-06-design-pattern-refactor-spec.md` — the two archived
  audit reports' findings are fully restated in this spec's own prose
  already; softened the "Source inputs" and "References" lists to describe
  them by name instead of by dead path.

Not repaired: prose citations of specific archived filenames inside
`docs/core-product-decision-log.yaml` and closed/active roadmap YAML files.
Those are dated historical entries citing what was true when written: lower
stakes than an active front door pointing nowhere, and a much larger edit
surface. Flagged, not fixed, per operator instruction to not worry about
receipt/citation completeness in this pass.

Tracked Markdown after this pass: 50 paths (104 after second pass - 54
archived this pass). Verify with `git ls-files '*.md' | wc -l` post-commit.

## High-Priority Remaining Burn Targets (status after third burn pass)

1. `docs/prds/closed/*.md` — DONE. The second burn pass already archived the
   22 files with zero live references. This third pass archived the
   remaining 13 (the whole directory, including `README.md`) despite live
   references, on explicit operator direction: `2026-06-30-integrated-poc-reference.md`
   (content already in `docs/core-product-decision-log.yaml` D012),
   `2026-06-20-site-widget-integration-architecture-prd.md` (opens with its
   own "no longer active architecture guidance" banner), and 11 closed
   campaign/arc cards whose receipts live independently under `artifacts/`.
   Prose citations of specific closed-card filenames in
   `docs/campaign-workflow-protocol.md` were softened to note the card is
   archived rather than left dangling.

2. `artifacts/**/*.md` receipts — DONE, operator-directed. All 36 receipt
   Markdown files archived; their JSON/txt siblings (parity reports, battery
   results, `evidence-index/baseline.json` and `floor-delta-latest.json`) were
   left in place since live tooling (`scripts/floor-delta.ts`, `digest.ts`,
   `gate-slice.ts`) reads those, not the Markdown. The mechanical blocker this
   item originally cited was real but narrower than stated: of the 7 roadmaps
   with receipts pointing into these directories, 6 are already
   `status: closed`; none of the 4 currently `active` roadmaps
   (demo-concierge-003, audit-log-001, demo-killbeat-001, sts-v2-001) cite any
   of the archived receipts. `campaign-consistency-check` was not rewritten to
   accommodate this — running it against the closed roadmaps will now report
   missing receipt paths, which is expected and accepted.

3. `docs/reports/*.md` — DONE, operator-directed. All 5 archived, including
   two this spec had argued should stay (`2026-07-05-adversarial-cleanup-review.md`,
   a live 33-item punch list with items still open; `2026-07-01-widget-adapter-sunset-assessment.md`,
   whose investment-freeze recommendation is still binding since the
   demo-adapter packages have not been retired). The operator's call, made
   explicitly and knowingly. Live citations of these two were repointed to the
   decision log (D039) or softened to note the source is archived; the
   design-pattern-refactor spec's inlined summary of the other two reports'
   findings was left intact (the reports were provenance, not unique content).

4. `docs/loanslam-operator/*.md`
   - Classification: KEEP, explicit override (2026-07-07). An earlier draft of
     this spec proposed reducing the manual to just its README plus the thin
     `.claude/skills` dispatcher. The operator overrode that: keep the full
     12-file manual. Not a reduction target.

5. Legacy package docs for non-keeper surfaces
   - Classification: BURN unless a current campaign names the package.
   - First pass moved `packages/demo-host/README.md`,
     `packages/demo-widget/README.md`, and `packages/review-host/README.md`.
   - Do not delete source packages in this doc cleanup; source retirement is a
     separate live-surface decision.

## Execution Plan (superseded by the third burn pass)

Items 1-3 below describe the first and second passes. The third pass did not
wait for a "coordinated slice" on the receipt checker (item 4) or condense the
operator manual (item 5, reversed by explicit override, see Burn Target 4
above) — the operator directed the cut regardless of those blockers.

1. Archive self-contained zombie Markdown to ignored `var/doc-archive/...`.
2. Add this spec and the `AGENTS.md` backref.
3. Verify the archive copies exist and only intended Markdown paths changed.

## Acceptance Criteria

- The root active context points here before trusting old Markdown.
- The first burn pass removes at least the 16 archived zombie docs from tracked
  Markdown.
- No current product/application code is changed by this cleanup.
- Proof receipts for the 4 currently-active roadmaps
  (demo-concierge-003, audit-log-001, demo-killbeat-001, sts-v2-001) are
  never moved by any pass of this spec; receipts belonging to closed
  roadmaps were archived in the third pass on explicit operator direction,
  accepting that `campaign-consistency-check` will report missing paths if
  run against those closed roadmaps.

## Verification

Use these commands:

```bash
git status --short -- '*.md'
git ls-files --deleted '*.md'
find var/doc-archive/2026-07-06-hellfire -type f -name '*.md' | sort
git diff -- AGENTS.md docs/prds/2026-07-06-markdown-context-pruning-spec.md
git diff --stat -- '*.md'
```
