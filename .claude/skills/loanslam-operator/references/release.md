# release

Promotion gates. Discipline: `AGENTS.md` (Git Branch Discipline).

- Path: `feature/*` | `fix/*` | `chore/*` | slice worktrees -> `dev` -> `staging`
  -> `main`. `main` accepts only `staging`; `staging` only `dev`.
- Fast-forward, NON-squash only, preserving full history. Stop on divergence.
  Never squash/rebase/force-push; never move a branch checked out in a sibling
  worktree (operate from its owning worktree).
- Gate to cross staging on an engine change: floor REPAIRED (not holding at
  breached) with judge verdicts — `just floor-delta -- <run-dir>` must report
  REPAIRED. Confirm with `just branch-risk` that the proof bar is met.
- `main` promotion triggers Vercel `vercel-build` (`prisma migrate deploy`
  against the real DB) — treat a migration as DEPLOY-tier risk.

The promote arc is [workflows/promote-hop.md](../workflows/promote-hop.md).
