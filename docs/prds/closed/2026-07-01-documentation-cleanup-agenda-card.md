# Documentation Cleanup Gate Agenda Card - 2026-07-01

Status: executed and closed 2026-07-01 (historical record). The gate was
closed with the committed classification matrix at
`docs/non-operational/doc-cleanup/2026-07-01-classification.yaml`, which
remains the current cleanup record.

## Objective

Close the pre-implementation documentation cleanup gate before integrated POC
implementation begins. The goal is to reduce active agent context to small,
focused, task-oriented sources while keeping an auditable cleanup trail.

## Good Look

- Repository documentation is classified as `KEEP`, `LAZY-LOAD`, `REWRITE`,
  `ARCHIVE`, or `DELETE`.
- Unambiguous cleanup actions are applied in the same slice.
- Active context links no longer point at stale or misleading docs.
- High-risk docs are deferred only when human judgement is genuinely required.
- The cleanup record is durable but stored under a non-operational path.

## Allowed Autonomy

The cleanup agent may:

- Inventory tracked and untracked documentation across the repository.
- Classify docs by context risk and cleanup state.
- Delete low-risk stale docs when the classification is clear.
- Rewrite necessary-but-misleading docs where the subject remains operational.
- Move historical or evidential docs to a deep non-operational archive path.
- Update `README`, `AGENTS`, and `CONTEXT` pointers when active context changes.
- Commit the cleanup when the proof bar is met.

The cleanup agent must not:

- Treat archive as the default alternative to deletion.
- Use `REWRITE` as a mercy bucket for stale docs.
- Move or rewrite high-risk docs without human judgement.
- Start integrated POC implementation.
- Treat this agenda card, the cleanup matrix, or archived docs as final product
  doctrine after the cleanup closes.

## Human Gate

Stop for human judgement before deleting, moving, or rewriting docs whose cleanup
could change:

- agent behaviour;
- deployment or promotion rules;
- secret handling;
- verification evidence;
- stakeholder commitments;
- product or compliance doctrine;
- active roadmap decisions.

Do not stop for ordinary stale notes, duplicated plans, low-risk reports, or
historical clutter when the cleanup state is clear.

## Agenda Tasks

1. Inventory repository documentation using both discovery and Git-tracked views.
2. Create `docs/non-operational/doc-cleanup/2026-07-01-classification.yaml`.
3. Classify each doc by state, context risk, reason, and intended action.
4. Apply unambiguous `DELETE`, `REWRITE`, `ARCHIVE`, and `LAZY-LOAD` changes.
5. Update active-context pointers in `README`, `AGENTS`, and `CONTEXT` if needed.
6. Create archive README only if any docs are actually archived.
7. Run proof checks and close with counts plus deferred high-risk docs.

## Proof Bar

The slice is complete only when all are true:

- Classification matrix is committed.
- Cleanup diff is applied.
- No top-level archive exists.
- No stale docs are linked from active context.
- `README`, `AGENTS`, and `CONTEXT` pointers are updated where needed.
- Closeout lists deleted, rewritten, archived, kept, and lazy-loaded counts.
- Any deferred high-risk docs are listed explicitly for human judgement.

## Verification

Minimum commands:

```sh
git status --short --branch
rg --files -uu -g '*.md' -g '*.mdx' -g '*.yaml' -g '*.yml' \
  -g '!node_modules/**' -g '!.git/**' -g '!dist/**' -g '!coverage/**'
git ls-files '*.md' '*.mdx' '*.yaml' '*.yml'
git diff --check
just gate-slice -- --staged
```

Use `just branch-risk` or broader gates if the cleanup changes command docs,
operator instructions, or other paths that imply a stronger proof tier.

## Stop Condition

Stop and produce a checkpoint instead of continuing if:

- high-risk docs need judgement;
- cleanup would change behavior doctrine or promotion rules without clear source
  authority;
- the matrix and observed docs disagree;
- required proof commands fail;
- the slice expands beyond documentation cleanup.

## Next Unlock

When this gate closes, create the Integrated POC Implementation Agenda Card. That
card must reference the cleanup matrix, final doctrine, in-repo roadmap first
chain, and first Golden Path Slice.
