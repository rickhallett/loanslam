# worktrees

Create, fan-out, merge, and prune isolated slice worktrees.

- New slice: `just slice-new -- <owner>` (one of retrieval / planner / validator
  / state / corpus / scenario). Creates `slice/<owner>-<stamp>` as a sibling
  worktree, copies ignored local context (.fallow, .claude/settings.local.json,
  .env.example), and renders no stale secrets. Add `--dry-run` to preview,
  `--render <env>` to render fresh secrets.
- Fan-out: one slice per disjoint owner; never two slices on the same owner in
  parallel (they would collide). See
  [write-scope-guardrails](write-scope-guardrails.md).
- Discipline (`AGENTS.md`): never move `dev`/`staging`/`main` or a branch checked
  out elsewhere; never copy a stale `.env`/`.env.local`; preserve history.
- Prune a finished slice: `git worktree remove <path>` then delete its branch
  only after its work has merged back.

Hard rules are enforced by `scripts/slice-worktree.sh` (refuses protected or
checked-out branches) and `scripts/gate-slice.ts` (blocks staged env caches).
