# workflow: digest-and-ping

The human-comms layer. Collapses the live "keep going / what next" relay into
exactly four touchpoints. Keep them few and high-signal.

## 1. Plan-lock (once per arc)

Before any code: approve the arc spec — the pinned baseline, the hard ceilings
([ratchet.config.json](ratchet.config.json)), the disjoint-owner backlog, and
the escalation thresholds. Reject here is free; reject after code is not.

## 2. Never-suppressed ping (exception)

Fire immediately, never throttled, on: a per-dimension safety-floor regression
(`floor-delta`), an OpenAI-only / provider-mandate hit, or a git
divergence / scope collision / a branch live in another worktree. Carries the
`floor-delta` numbers plus `just route-audit` / `just demo-log-session` for the
offending scenario.

## 3. Batched digest (time)

One read per cadence. `just checkpoint-packet -- <run-dir>` (or `just digest`):
typed numbers only — bolded safety-floor and demo-killer lines, the proof bar,
and an Approve / Redirect / Stop default per slice. Never free-text-summarise
`evidence.json`; the digest tools structurally refuse to read transcripts.

## 4. End-of-arc PR (artifact)

One PR on the chore branch with the surviving atomic non-squash commits and the
`floor-delta` + `digest` receipt embedded INLINE in the body (artifacts/ is
gitignored and dies with the worktree). Promotion follows
[promote-hop](promote-hop.md) — REPAIRED required.

The rule under all four: verify before reporting. No success claim without the
proof bar met.
