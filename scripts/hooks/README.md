# Git hooks

Committed hooks for the loanslam ops loop. They are **not** active until you
point git at this directory (a one-time, per-repo step):

```sh
just hooks-install        # = git config core.hooksPath scripts/hooks
```

Reverse with `git config --unset core.hooksPath`.

`core.hooksPath` is stored in the shared repo config, so it applies to every
worktree. Each worktree carries its own committed `scripts/hooks/`, so the
relative path resolves to the local copy.

## `pre-commit`

Runs two deterministic gates and aborts the commit on either failure:

- `npm run source-policy:check` — extensionless-TypeScript imports, no
  non-OpenAI inference provider SDK imports, and provider-env manifest policy,
  over the whole tree.
- `npm run gate-slice -- --staged` — staged-diff gate: blocks rendered env
  caches / `evidence.json`, decrypted-key-shaped content, an engine-touching
  change (`packages/core/src/**`) without a `REPAIRED`/`HOLDING` floor-delta
  receipt, and demo↔review widget cross-pollination.

Practical consequence: once installed, a commit that changes
`packages/core/src/**` requires a fresh floor-delta receipt. Produce one after a
Hell Week run with `just floor-delta -- <run-dir>` before committing engine
changes. To bypass deliberately (rare), `git commit --no-verify` and record why.
