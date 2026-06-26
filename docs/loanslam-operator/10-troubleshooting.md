# 10. Troubleshooting

[← Reference](09-reference.md) · [Manual index](README.md)

## A commit is blocked by the gate

Read the violation list — it names the file and reason.

| Message | Cause | Fix |
| --- | --- | --- |
| `secret/cache file staged: .env.local` | A rendered env cache is staged | `git restore --staged <file>`; never commit caches |
| `possible API key in staged content` | An API-key-shaped line was added | Remove it; use SOPS secrets |
| `engine-touching commit requires a floor-delta receipt` | `packages/core/src/**` changed with no valid receipt | Run `just floor-delta -- <run-dir>` first (REPAIRED/HOLDING) |
| `floor-delta receipt status is REGRESSED` | The last run regressed the floor | Fix the regression; do not commit |
| `widget cross-pollination` | A demo↔review import was added | Remove the cross-boundary import (they stay separate) |
| `forbidden Anthropic provider import` | An `anthropic` / `@anthropic-ai/*` import | Replace with the OpenAI path; this repo is OpenAI-only |

To bypass deliberately (rare, write down why): `git commit --no-verify`.

## floor-delta says INCONCLUSIVE

The candidate is not comparable to the anchor — different `profile` or scenario
count (e.g. you compared a 10-scenario smoke run to the full baseline). A smoke
run cannot be a floor-repair receipt. Run a **full** `just hell-week` and score
that. INCONCLUSIVE exits non-zero, so it cannot satisfy a gate.

## Hell Week aborts before any model call

The CLI fails fast if Postgres is unreachable. Fix the connection
(`HELL_WEEK_DATABASE_URL` / `DATABASE_URL`); never downgrade to static green and
proceed — `just verify` does not prove behaviour.

## The hook does not run

```sh
git config core.hooksPath          # expect: scripts/hooks
just hooks-install                 # set it if missing
ls -l scripts/hooks/pre-commit     # must be executable (100755)
```

In a worktree whose branch does not contain `scripts/hooks`, git finds no
pre-commit and silently runs nothing — that is expected until the bundle reaches
that branch.

## A run "passed" but I do not trust it

The battery is stochastic and the baseline is breached. Do not declare REPAIRED
on one run:

```sh
just hell-week-stability -- --runs run-a,run-b,run-c
```

Require the stability classification (`stabilityMinRuns` in the config) before a
keep, especially near `human_support` / `prompt_injection` / `regulatory_boundary`.

## I lost a behaviour receipt

`artifacts/` is gitignored and dies with a worktree. Always embed the
`floor-delta` + `digest` summary **inline** in the PR body (use
`just checkpoint-packet`), so the claim survives even when the run folder does
not. If the receipt is gone, re-run and re-score.

## I clobbered `.env.local`

It is a regenerable cache, not source of truth. Re-render:

```sh
just secrets-render local
```

Never copy a `.env.local` from another worktree — render fresh from the encrypted
`secrets/*.env.sops`.

## A promotion will not fast-forward

The branch has diverged from its target. Stop — do not squash or rebase to force
it. Investigate the divergence (`just status-snapshot`, `git log --oneline`).
Promotions are fast-forward, non-squash only; operate from the target branch's
owning worktree.
