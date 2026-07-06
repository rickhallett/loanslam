# 3. Getting started

[← Architecture](02-architecture.md) · Next: [Operations catalog →](04-operations.md)

## Prerequisites

- Node ≥ 24, `npm`, and [`just`](https://github.com/casey/just) on PATH.
- For behaviour evidence only: `OPENAI_API_KEY` and a reachable Postgres
  (`HELL_WEEK_DATABASE_URL` / `DEMO_INTERACTION_DATABASE_URL` / `DATABASE_URL`).
  The deterministic gates need neither.

## Activate the pre-commit gate (one time)

There is no CI in this repo, so the pre-commit hook is the enforcement layer.
Turn it on once per clone:

```sh
just hooks-install        # = git config core.hooksPath scripts/hooks
```

`core.hooksPath` is shared repo config, so it applies to every worktree. A
worktree whose branch does not yet contain `scripts/hooks` simply runs no
pre-commit until the bundle reaches it. Reverse with
`git config --unset core.hooksPath`.

Once active, every commit runs:

- `source-policy:check` — extensionless-TS imports + the OpenAI-only mandate.
- `gate-slice --staged` — secret/evidence path + content scan, the engine-touch
  receipt requirement, and demo↔review separation.

To bypass deliberately (rare): `git commit --no-verify`, and write down why.

## First five minutes

```sh
just status-snapshot                 # where am I, which branches are checked out where
just branch-risk -- --base dev       # what proof bar do my changes owe
just self-gate                       # cheap, zero-token: verify + report check + fallow audit
```

Then, if you have an existing Hell Week run folder:

```sh
just digest -- <run-dir>             # privacy-preserving numbers digest
just floor-delta -- <run-dir>        # REPAIRED | HOLDING | REGRESSED vs the anchor
just checkpoint-packet -- <run-dir>  # orient + proof bar + digest, one packet
```

## Discover the agent path

If you drive this with an agent, the dispatcher skill auto-loads on intent. You
can also point an agent at
[`SKILL.md`](../../.claude/skills/loanslam-operator/SKILL.md) directly. The skill
and this manual stay in sync because both cite the same `docs/` and the same
`just` targets.

## Sanity check

```sh
just --list | grep -E 'gate-slice|floor-delta|digest|branch-risk|slice-new|status-snapshot|checkpoint-packet|self-gate|hooks-install'
git config core.hooksPath            # expect: scripts/hooks
```
