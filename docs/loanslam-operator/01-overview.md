# 1. Overview

[← Manual index](README.md) · Next: [Architecture →](02-architecture.md)

## The problem it solves

As agentic coding accelerates, the human becomes a relay: "keep going", "what's
the best next step", approve, repeat. The bottleneck is not running agents
longer — it is **trust**. You touch in constantly because you lack a cheap,
trustworthy signal that silent progress is actually good.

`loanslam-operator` makes that signal mechanical. Routine work self-gates against
deterministic checks and the real behaviour-proof surface (Hell Week), and you
are reached only at a few high-signal checkpoints.

## The mental model

Every operation answers two questions before it is "done":

1. **What kind of change is this?** Read-only, mutating, merge-sensitive,
   secret-sensitive, or evidence-sensitive. `just branch-risk` derives the
   required proof bar from the files that changed.
2. **What proof must exist before reporting success?** For engine behaviour, the
   answer is always integration evidence — a Hell Week run scored against the
   committed baseline — never unit tests.

## What it is built from

| Tier | What lives there | Examples |
| --- | --- | --- |
| Dispatcher | One thin always-loaded router | `SKILL.md` |
| References | Link-only routers into `docs/` | `references/verification.md` |
| Deterministic scripts | Gates and helpers with exit codes, no model | `gate-slice`, `floor-delta`, `digest` |
| Workflow arcs | Named multi-step compositions | `hell-week-tune`, `promote-hop` |

The lineage is the Railway CLI skill bundle (dispatcher → reference playbooks →
deterministic scripts), adapted to a stochastic behaviour-tuning domain instead
of idempotent CRUD. See [Architecture](02-architecture.md).

## What it is not

- It does not replace the `justfile` — it routes to it. The justfile stays the
  real control surface.
- It does not treat a green `just verify` as proof of behaviour.
- It does not add static routing restraints or dedup the demo/review widgets —
  both are explicit anti-patterns (see
  [Worktrees and promotion](07-worktrees-and-promotion.md) and the
  [write-scope guardrails](../../.claude/skills/loanslam-operator/references/write-scope-guardrails.md)).

## Key facts about this repo

- TypeScript npm-workspaces monorepo; `packages/core` is the engine.
- **OpenAI-only** inference (nano → mini → 5.4 → 5.5), enforced by the
  source-policy check.
- Promotion path: `feature`/`fix`/`chore`/slice → `dev` → `staging` → `main`,
  fast-forward non-squash.
- The committed Hell Week baseline is currently **breached (41/50)** — promotion
  requires it *repaired*, not merely held.
- There is no CI (no `.github/workflows`); the pre-commit hook is the enforcement
  layer.
