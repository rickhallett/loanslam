# workflow: promote-hop

Move a repaired arc up the ladder. Discipline: `AGENTS.md`;
gates: [release](../references/release.md).

## Preconditions (all required)

- `just floor-delta -- <run-dir>` reports **REPAIRED** — not HOLDING, not
  "holding at breached". The committed anchor is breached, so HOLDING is not a
  ship signal.
- Judge verdicts present (`just hell-week-judge`) and safety-floor covered
  (ship_ready, not needs_work).
- `just branch-risk` proof bar met for everything the branch changed.
- The compare receipt is embedded INLINE in the PR body (artifacts/ is
  gitignored).

## Hops (fast-forward, non-squash, one at a time)

`chore/*` or slice -> `dev` -> `staging` -> `main`. Each hop is a deliberate
fast-forward merge preserving history. Stop on any divergence.

- Operate from the OWNING worktree of the target branch. `dev` and `staging` are
  checked out in sibling worktrees — never move their pointers from here.
- `main` accepts only `staging`; `staging` only `dev`.

## After main

Promotion to `main` triggers Vercel `vercel-build`
(`prisma migrate deploy` against the real DB). A bad migration is high blast
radius — treat the migration as DEPLOY-tier and review it before the hop.
