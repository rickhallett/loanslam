# Hell Week Judge Foundation Handoff - 2026-06-20

## Practical Takeaway

This worktree exists only to land the shared Hell Week judge contract before any
parallel implementation fan-out. Keep the slice small, merge it back to `dev`,
then create the workflow, measurement, report-gate, coverage, and default-enable
worktrees from the updated `dev`.

## Worktree

- Path: `.claude/worktrees/hellweek-judge-foundation`
- Branch: `worktree-hellweek-judge-foundation`
- Base: local `dev` at `a611c40`
- Seeded local context: `.claude/`, `.fallow/`, `.env.example`
- Not copied: `.env`, `.env.local`, `.env.staging`, `.env.production`

## Ownership

Foundation may touch:

- `packages/core/src/hellweek/types.ts`
  - shared judge verdict artifact shape
  - judge metadata contract
  - any validation result/error types used by later slices
- `packages/core/src/hellweek/run.ts`
  - read/merge boundary for judge verdict artifacts
  - schema validation for JSON and JSONL verdict inputs
  - artifact paths and names that later workflow/report slices must honor
- Focused Hell Week tests beside the touched code, especially
  `packages/core/src/hellweek/run.test.ts` and `packages/core/src/hellweek/grade.test.ts`
- Minimal operator-doc edits only if they clarify the new artifact contract.

Foundation must not implement:

- `.claude/workflows/hellweek-judge.js` workflow changes
- measurement or latency rollups
- report gate behavior
- coverage expansion
- default judge enablement
- engine routing, retrieval, validator, or planner behavior

## Acceptance Checks

Before merging foundation back to `dev`, prove:

- `JudgeVerdict` input remains backward-compatible with existing array and JSONL
  verdict files.
- The new shared artifact shape records enough metadata for later comparability:
  judge provider/model or tool, prompt/version if known, generated timestamp,
  source run id/path, scenario count, and per-scenario verdicts.
- Invalid verdict artifacts fail loudly instead of being silently reduced to a
  partial `Map`.
- Duplicate or unknown `scenarioId` handling is explicit and covered by tests.
- Existing deterministic-only Hell Week re-render behavior still works when no
  judge artifact is supplied.

Suggested local checks:

```bash
npm run source-policy:check
npx vitest run packages/core/src/hellweek/run.test.ts packages/core/src/hellweek/grade.test.ts
npm run typecheck
```

Use broader `just test` or `just verify` only if the implementation touches more
than the contract/read-boundary files above.

## Merge-Back Path

1. Confirm this worktree is clean except the foundation commit.
2. Confirm `dev` still points at the intended base or only has expected completed
   work.
3. Merge `worktree-hellweek-judge-foundation` into `dev` from the checkout that
   owns `dev`: `.claude/worktrees/site-contact-widget-style`.
4. Preserve history; do not squash.
5. Stop on divergence, dirty related files, merge conflicts, or failing
   acceptance checks. Preserve unrelated user files.

After foundation lands on `dev`, create the parallel worktrees:

- `hellweek-judge-workflow`
- `hellweek-judge-measurement`
- `hellweek-report-gate`
- `hellweek-coverage`

Hold `hellweek-judge-default` until those are merged.
