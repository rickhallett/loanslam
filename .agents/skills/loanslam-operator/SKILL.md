---
name: loanslam-operator
description: >-
  Root operator dispatcher for the loanslam repo. Use when orienting in the
  repo, running verification or Hell Week evidence, managing worktrees and
  disjoint-scope slices, promoting dev -> staging -> main, triaging failed gates
  or flaky evidence, or driving the bounded tuning loop. Routes intent to one
  thin reference and the right deterministic `just` target, and forces the
  correct proof surface before any success is reported.
---

# loanslam operator

This skill is a **dispatcher**, not a manual. It routes an intent to one
reference and the deterministic tool that does the work. The human-facing user
manual lives at `docs/loanslam-operator/README.md`. It defers to the
`justfile` (the real control surface) and to `AGENTS.md` (the doctrine); it
never restates them. The references are thin routers into `docs/`.

Doctrine, in one line and not repeated here: integration evidence is the only
proof; OpenAI-only inference; fast-forward non-squash promotion; SOPS secrets.
See `AGENTS.md`.

## Before acting, classify the intent

1. What is the user trying to do? (route below)
2. Is it **read-only, mutating, merge-sensitive, secret-sensitive, or
   evidence-sensitive**?
3. What proof must exist before reporting success? Run `just branch-risk` to get
   the required bar from the changed files. Never declare route/planner/
   validator/demo/Hell Week behaviour "done" from unit tests - those are
   scaffolding. See [verification](references/verification.md).

## Intent router

| Intent | Reference | Tool / `just` target | Gate before "done" |
| --- | --- | --- | --- |
| Orient / where am I | [orient](references/orient.md) | `just status-snapshot` | read-only |
| Create / fan-out / prune a slice worktree | [worktrees](references/worktrees.md) | `just slice-new -- <owner>` | never move dev/staging/main |
| Verify a change | [verification](references/verification.md) | `just verify`, `just self-gate` | green = wiring only, not behaviour |
| Capture behaviour evidence | [evidence](references/evidence.md) | `just hell-week`, `just hell-week-judge` | ship_ready needs judge verdicts |
| Score a run vs the anchor | [evidence](references/evidence.md) | `just floor-delta -- <run-dir>` | REPAIRED/HOLDING to keep; REPAIRED to promote |
| Build a review/PR packet | [evidence](references/evidence.md) | `just checkpoint-packet -- <run-dir>`, `just digest` | numbers only, never transcripts |
| Manage secrets | [secrets](references/secrets.md) | `just secrets-status`, `just secrets-render <env>` | never print/commit decrypted |
| Promote up the ladder | [release](references/release.md) | floor REPAIRED, then ff non-squash | repaired, not holding-at-breached |
| Triage a failure | [failure-triage](references/failure-triage.md) | `just route-audit`, `just hell-week-stability`, `just demo-log-session` | distinguish regression from noise |
| Compose an autonomous arc | [agent-arcs](references/agent-arcs.md) | workflows/ + `ratchet.config.json` | bounded loop, one owner per slice |
| Pick a write-scope / guardrails | [write-scope-guardrails](references/write-scope-guardrails.md) | failure-owner table below | gate-slice enforces the hard ones |

## OpenAI ladder (escalate-only)

`gpt-5.4-nano` cheap classifiers/signals -> `gpt-5.4-mini` bulk per-scenario
judges -> `gpt-5.4` higher-quality spot checks -> `gpt-5.5` only for final
adjudication / hard disputed cases. Start at the cheapest rung; escalate only on
need. No Anthropic path, ever (the source-policy check enforces this).

## Failure -> likely owner (disjoint write scopes)

`retrieval` | `planner` | `validator` | `state` | `corpus` | `scenario`. One
slice changes exactly one owner; parallel slices must not share an owner. See
[write-scope-guardrails](references/write-scope-guardrails.md) for the KEEP/BURN
rules (no static routing restraints; demo and review widgets stay separate).

## Quick ops

- Orient: `just status-snapshot`
- Proof bar for this branch: `just branch-risk -- --base dev`
- Cheap self-gate (no tokens): `just self-gate`
- Keep-commit gate (staged): `just gate-slice`
- Behaviour receipt: `just floor-delta -- <run-dir>`
- Review packet: `just checkpoint-packet -- <run-dir>`
- New slice worktree: `just slice-new -- <owner>`

## Typed workflow chains

The named arcs live in [workflows/](workflows/). The controller reads them plus
`workflows/ratchet.config.json`.

- **Refactor branch**: orient -> verification -> [hell-week-tune](workflows/hell-week-tune.md) verifier -> checkpoint (merge / fix / split)
- **Behaviour tuning**: orient -> evidence -> implementer -> full integration proof -> floor-delta -> checkpoint
- **Hell Week / judge**: orient -> hell-week -> evidence -> judge -> stability/calibration gate -> checkpoint
- **Deploy / demo polish**: secrets -> verification -> [release](references/release.md) -> live read-back -> checkpoint

## The one rule

Verify before reporting. Produce a [checkpoint-packet](references/evidence.md)
with the required proof bar met; do not assert success without it.
