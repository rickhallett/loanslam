# PRD: Documentation Audit and Cleanup Recommendations

## Problem Statement

The repository still contains enough Markdown to steer future agents, reviewers,
and operators. That makes docs a liability surface, not harmless commentary:
stale Markdown can poison context in the same way stale code can poison runtime.

The existing Markdown pruning spec is useful historical input, but it is stale.
The next pass must start from the current tree, current code, and Git history.
Generally, code and Git log are the source of truth; docs must earn trust by
matching them.

## Solution

Run a full documentation audit and produce cleanup recommendations before making
large deletions or rewrites.

Classify every tracked Markdown file as `KEEP`, `EDIT`, or `DELETE`. Each
classification should include a short reason and the evidence used: current code,
current commands, recent commits, or an explicit product/agent authority role.

The audit should treat the 2026-06-15 Markdown pruning spec from Git history as
prior art only. It can suggest candidate risks, but it must not be copied forward
without rechecking against the current repository. The resulting current matrix
lives in `docs/prds/2026-06-20-documentation-audit-recommendation-matrix.md`.

## User Stories

1. As a future agent, I want a small trustworthy Markdown surface, so that old
   plans do not outrank current code.
2. As a maintainer, I want every Markdown file classified, so that documentation
   debt is visible instead of ambient.
3. As a reviewer, I want cleanup recommendations tied to evidence, so that doc
   deletions are reviewable and not just taste.
4. As an operator, I want current command docs to match the live command surface,
   so that runbooks do not send me down dead paths.
5. As a product stakeholder, I want current product docs preserved or repaired,
   so that cleanup does not erase still-valid decisions.

## Implementation Decisions

- Use the current tracked Markdown inventory as the audit scope.
- Include root authority files, docs, package README files, site capture docs,
  secrets docs, and artifact Markdown.
- Treat generated, historical, or evidence-summary Markdown as suspect unless it
  has a clear current reader and cannot be replaced by raw evidence plus a short
  index.
- Treat PRDs as historical unless they describe still-active work or a durable
  decision.
- Prefer editing a current authority doc over keeping several overlapping docs.
- Prefer deleting stale docs over moving them into a larger archive, unless a
  specific evidence or compliance reason requires retention.
- Do not change source code behavior during the cleanup.
- Do not trust any doc merely because it says "current", "canonical", "source of
  truth", or "must"; verify the claim against code and Git history.

## Suggested Audit Procedure

1. Inventory tracked Markdown with `git ls-files '*.md'`.
2. Compare against recent documentation history with `git log --oneline -- '*.md'`.
3. Read the stale pruning spec for candidate risks, then recheck each claim.
4. For each Markdown file, assign `KEEP`, `EDIT`, or `DELETE`.
5. For each `KEEP`, name its authority level and current reader.
6. For each `EDIT`, name the stale claim or duplicate surface to remove.
7. For each `DELETE`, name the surviving source of truth or explain why none is
   needed.
8. Produce one recommendation document before applying broad cleanup.
9. After approval or a clear next-agent decision, make cleanup commits in small
   logical slices.

## Acceptance Criteria

- Every tracked Markdown file has a `KEEP`, `EDIT`, or `DELETE` recommendation.
- Recommendations cite current evidence rather than relying on the stale pruning
  spec.
- Root authority files and active product/runtime docs are preserved or repaired.
- Stale generated prose, obsolete PRDs, and old artifact summaries are removed or
  reduced unless a clear current reader exists.
- README and AGENTS links point only to surviving or intentionally edited docs.
- The final cleanup changes Markdown only unless a link or command surface makes
  a tiny adjacent config edit unavoidable.

## Verification Commands

```bash
git status --short --branch
git ls-files '*.md' | sort
git log --oneline --max-count=30 -- '*.md'
rg -n "docs/prds|docs/presentation|docs/agents|docs/superpowers|artifacts/.+\\.md" AGENTS.md README.md docs packages site secrets || true
```

## Out of Scope

- Implementing the full cleanup in this setup pass.
- Treating the stale 2026-06-15 pruning spec as authoritative.
- Rewriting product strategy, runtime architecture, or demo behavior.
- Editing source code to make docs true.
- Creating a broad archive of stale Markdown by default.

## Further Notes

The current tree already appears to have had a pruning pass. At the time this
PRD was created, `git ls-files '*.md'` returned 28 tracked Markdown files, and
recent history included `docs: Prune stale context documents`. Start there, not
from the older file counts in the stale spec.
