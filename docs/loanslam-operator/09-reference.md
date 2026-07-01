# 9. Reference

[← Worked examples](08-examples.md) · Next: [Troubleshooting →](10-troubleshooting.md)

## Operator `just` targets (added by this system)

| Target | Script | Read-only | Notes |
| --- | --- | --- | --- |
| `status-snapshot` | `scripts/status-snapshot.sh` | yes | orient |
| `branch-risk -- [--base <ref>] [--json]` | `scripts/branch-risk.ts` | yes | default base `dev` |
| `self-gate` | `verify` + fallow | yes | zero tokens |
| `gate-slice -- [--receipt <path>]` | `scripts/gate-slice.ts` | yes | staged-diff gate |
| `floor-delta -- <run> [--baseline p] [--out p] [--json]` | `scripts/floor-delta.ts` | yes | writes a receipt |
| `digest -- <run> [--json] [--floor-delta p]` | `scripts/digest.ts` | yes | report.json only |
| `checkpoint-packet -- [<run>] [--base <ref>]` | `scripts/checkpoint-packet.sh` | yes | composes the above |
| `slice-new -- <owner> [--base r] [--render env] [--dry-run]` | `scripts/slice-worktree.sh` | no | creates a worktree |
| `hooks-install` | — | no | sets `core.hooksPath` |

## Exit codes

| Tool | 0 | 1 | 2 |
| --- | --- | --- | --- |
| `floor-delta` | REPAIRED / HOLDING | REGRESSED / INCONCLUSIVE | usage/IO error |
| `gate-slice` | clean | violation found | bad argument |
| `digest` | ok | — | usage / non-report path |
| `branch-risk` | ok | — | bad argument |
| `slice-worktree` | ok | refused (protected/checked-out) | usage / bad owner |

## floor-delta verdict statuses

| Status | Meaning | Slice | Promote |
| --- | --- | --- | --- |
| REPAIRED | floor fully passing (`breached == false`) | keep | yes |
| HOLDING | no dimension regressed, still breached | keep | no |
| REGRESSED | a floor dim dropped / new demo-killer / aggregate fell | discard | no |
| INCONCLUSIVE | profile or scenario-set mismatch — untrustworthy | discard | no |

## `ratchet.config.json` fields

`.claude/skills/loanslam-operator/workflows/ratchet.config.json`

| Field | Meaning |
| --- | --- |
| `iterationCeiling` | max loop iterations (default 6) |
| `candidatePatchCeiling` | max candidate patches (default 8) |
| `tokenCeiling` | output-token cap, or `null` |
| `baselinePin` | path to the committed anchor |
| `disjointOwners` | the six write-scope owners |
| `oneOwnerPerSlice` | enforce one owner per slice |
| `smokeBeforeFull` | run smoke before the full battery |
| `stabilityMinRuns` | runs required before declaring REPAIRED |
| `keepStatuses` | statuses that keep a commit (`REPAIRED`,`HOLDING`) |
| `promotionRequires` | status required to promote (`REPAIRED`) |
| `firstArc` | calibration arc settings (`alwaysNotify`, lower ceiling) |

## Key file locations

| Path | Role |
| --- | --- |
| `.claude/skills/loanslam-operator/SKILL.md` | dispatcher |
| `.claude/skills/loanslam-operator/references/*.md` | link-only references |
| `.claude/skills/loanslam-operator/workflows/*.md` | named arcs |
| `.claude/skills/loanslam-operator/workflows/ratchet.config.json` | controller config |
| `scripts/*.ts`, `scripts/*.sh` | deterministic tier |
| `scripts/hooks/pre-commit` | enforcement hook (opt-in) |
| `artifacts/evidence-index/baseline.json` | committed floor anchor |
| `artifacts/evidence-index/floor-delta-latest.json` | runtime receipt (gitignored) |
| `docs/loanslam-operator/` | this manual |

## Canonical source docs (referenced, not duplicated)

| Doc | Covers |
| --- | --- |
| `docs/hell-week-agent-loop-playbook.md` | the bounded autonomous loop |
| `docs/hell-week-gauntlet.md` | the run + grading model |
| `docs/phase-0-core-api-battery.md` | the cheap lab-API path |
| `docs/llm-turn-planner-architecture.md` | the engine / owners / static-vs-live evidence rule |
| `AGENTS.md` | branch / worktree / secret / provider doctrine |
