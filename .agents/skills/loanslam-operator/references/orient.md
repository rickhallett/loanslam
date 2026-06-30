# orient

Where am I, and what is safe to touch, before any mutating work.

- Run `just status-snapshot` — branch, upstream, dirty state, every worktree and
  the branch it holds, and whether the pre-commit gate is active.
- Source of truth and discipline: `AGENTS.md` (branch, worktree, secret, and
  provider rules). Repo map and product framing: `docs/product-brief.md`.
- ~11-15 worktrees are live; `dev` and `staging` are checked out in siblings.
  Never move a branch checked out in another worktree from here.

Next: pick the intent in `SKILL.md`'s router. If the change is non-trivial, run
`just branch-risk -- --base dev` to learn the proof bar you owe.
