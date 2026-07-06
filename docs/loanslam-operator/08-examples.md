# 8. Worked examples

[← Worktrees and promotion](07-worktrees-and-promotion.md) · Next: [Reference →](09-reference.md)

End-to-end command sequences. Output is abbreviated.

## Example A — a tooling/docs change (no behaviour proof needed)

```sh
$ just branch-risk -- --base dev
## branch risk
- required proof bar: TOOLING
  verify (test + typecheck + build + reports check + source-policy).

$ git add docs/loanslam-operator/04-operations.md
$ git commit -m "docs(ops): clarify operations catalog"
# pre-commit hook runs:
TypeScript source policy passed: scanned N source files; ...
gate-slice passed: scanned 1 staged file(s).
[chore/... abc1234] docs(ops): clarify operations catalog
```

The hook passed because the change is docs-only — no engine source, no secrets.

## Example B — an engine tuning slice, orient → PR

```sh
# 1. Orient and learn the proof bar.
$ just status-snapshot
$ just branch-risk -- --base dev
- required proof bar: ENGINE
  Full Hell Week + judge + floor-delta REPAIRED/HOLDING receipt. ...

# 2. Isolate the slice (one disjoint owner).
$ just slice-new -- validator
slice-worktree ready: cd /Users/.../.claude/worktrees/slice-validator-2026...
$ cd /Users/.../slice-validator-2026...
$ just secrets-render local        # fresh secrets, never copied

# 3. Make the single change, then the cheap gate.
$ just self-gate                   # verify + report check + fallow audit (zero tokens)

# 4. Behaviour proof: smoke first, then full + judge.
$ just hell-week -- --profile smoke
$ just hell-week                   # writes artifacts/phase0/.../report.json
$ just hell-week-judge -- artifacts/phase0/.../hell-week-full-...

# 5. Score against the committed anchor.
$ just floor-delta -- artifacts/phase0/.../hell-week-full-...
floor-delta: HOLDING
  - Prompt injection / data improved 6->7 (+1)
  receipt: artifacts/evidence-index/floor-delta-latest.json

# 6. Commit (the hook requires the receipt for engine changes).
$ git add packages/core/src/validator/...
$ git commit -m "fix(core): tighten prompt-injection validator"
gate-slice: engine-touching change (1 file under packages/core/src/)
gate-slice: floor-delta receipt HOLDING (candidate hell-week-full-...)
gate-slice passed.

# 7. Build the review packet and open the PR with the receipt inline.
$ just checkpoint-packet -- artifacts/phase0/.../hell-week-full-... > /tmp/packet.md
# paste /tmp/packet.md into the PR body
```

If step 6 is attempted **without** a receipt, the hook blocks:

```
gate-slice failed:
- engine-touching commit requires a floor-delta receipt at
  artifacts/evidence-index/floor-delta-latest.json (run `just floor-delta -- <run-dir>`)
```

## Example C — promotion to staging

```sh
# Floor must be REPAIRED, not merely holding.
$ just floor-delta -- artifacts/phase0/.../hell-week-full-...
floor-delta: REPAIRED
  - safety floor fully passing (breached == false)

$ just branch-risk -- --base staging      # confirm the bar is met
# From dev's OWNING worktree (never move dev from here):
$ git -C /Users/.../site-contact-widget-style merge --ff-only chore/...
# then dev -> staging, staging -> main as separate ff non-squash hops
```

If `floor-delta` reports `HOLDING`, promotion is refused by doctrine — the anchor
is breached, so "holding at breached" is not a ship signal. Keep tuning.

## Example D — separating signal from noise

```sh
# The battery is stochastic; don't trust one run.
$ just hell-week-stability -- --runs run-a,run-b,run-c
# classifies each scenario: stable pass / stable failure / recurring / one-off
```

Use this before declaring REPAIRED, especially near the breached dimensions.
