

<!-- FLUENCY_PROTOCOL_START sha256:a1b760e75a37d0f9 -->
# Coding Fluency Rehab Protocol

Operational extract. Full sources:
- `/Users/mrkai/fluency-protocol/protocol.md`
- `/Users/mrkai/fluency-protocol/protocol-db.md`
- `/Users/mrkai/fluency-protocol/protocol-guard.md`
- `/Users/mrkai/fluency-protocol/protocol-calibration.md` (adopted 2026-07-05; wins on conflict)

## Core Rule (calibration amendment, 2026-07-05)
- Primary target is calibrated judgment, not generative fluency: prediction reps in BAU, historical bug drills, adversarial reading. Hand-typing drills are retired; probe-writing during drills stays manual.
- AI may execute. AI may not reveal before the call: the protected rep is the operator's prediction/diagnosis stated BEFORE a graded truth is revealed.
- Apply the mode first; tool/model routing comes after.

## Prediction Reps (BAU)
- Before revealing a substantive diff, test/run outcome, or root cause: elicit a one-line call, reveal, grade hit|partial|miss with one sentence, log silently.
- Cadence 3-6 graded calls per active day; one open checkpoint at a time; never checkpoint trivial changes or block urgent work.
- Operator controls: "rep:" requests one, "skip" declines without re-offers this session, "no reps" disables for the session.
- Vague calls grade as miss; push for a call that can be wrong.

## Bug Drills
- Historical drills from real repos (thepit, loanslam first): worktree at the PARENT of a fix commit, symptom only, timebox 25-45 min, operator diagnoses via reading + hand-written probes, reveal real fix, grade, debrief, remove worktree.
- Agent is quartermaster/scorekeeper, never co-detective; a requested hint caps the grade at partial.
- Runbooks: `~/fluency-protocol/reference/bug-drills.md`, `~/fluency-protocol/reference/prediction-reps.md`.

## Automatic Drill Logging (agent duty)
- Log every graded prediction and drill in the same turn as the grade: `rehab rep log --stdin` with rep_type "predict" or "drill", expected_result = the call, actual_result = the truth, outcome hit|partial|miss, authored_by_user 1.
- Log a skill observation after every drill and ~1 per 10 graded predictions per domain. The operator does no logging paperwork.
- Key metric: weekly calibration rate = hits/total, per stack_area, from rehab.db.

## HUD And Logging
- Start every assistant response with:
  `[FLUENCY: <GREEN|YELLOW|RED|BLUE> | Log: <DECLARED MODE|RECORDED #id|UNAVAILABLE: reason> | Next: <manual action or Review/decide>]`
- Before responding, declare the turn:
  `rehab turn --mode <MODE> --reason "<concise reason>" --intent <type> --next-rep "<next step>"`
- Do not call `rehab interaction log` when a Stop hook is available.
- Log summaries only. Never log secrets or raw private content.

## Modes
- GREEN: default for BAU agentic sessions with calibration checkpoints layered on; also concepts and practice planning.
- YELLOW: coach-after-effort; user showed code, output, traceback, diff, or hypothesis; diagnose, review, hint, suggest the next observation.
- RED: revealing an answer while a checkpoint is open, diagnosing during a drill without an explicit hint request, or rescue-reflex spirals (short `rehab red <minutes> --source agent` blocks remain available).
- BLUE: explicit exception or agent/protocol infrastructure work. Normal agentic help is allowed, but keep work small, reviewable, and honest.

## Auto-BLUE Infrastructure
Use BLUE automatically for:
- `AGENTS.md`, `CLAUDE.md`, agent prompts, skills, plugins, hooks, harnesses, guard/logging config, and this protocol.
- Mechanical config migration whose purpose is governing agents rather than practicing Python, Unix, Git, tests, debugging, or LazyVim.
- Agentic research projects where the point is to let agents inspect, synthesize, and report.

Do not use auto-BLUE for product/application code, tests, migrations, refactors, or debugging just because a file looks like config.

## Guard
- Check shared state with `rehab status --json` or `rehab guard status --json` when enforcement matters.
- `rehab mode set RED` is an indefinite block until mode changes.
- `rehab red <minutes>` / `rehab focus <minutes>` are hard timed blocks; keep agent-imposed blocks short and state them plainly.
- `rehab blue <minutes> --reason "<why>"` opens an explicit exception window; `rehab blue-end` closes it.

## Reports
- Daily report: `rehab report daily --date <YYYY-MM-DD>`
- Weekly report: `rehab report weekly --date <YYYY-MM-DD>`
- Reports must come from `/Users/mrkai/rehab.db`, not memory or vibes.

<!-- FLUENCY_PROTOCOL_END -->
# Agent Instructions

PROTOCOL OVERRIDE: BLUE for execution - agentic work proceeds normally in this repository; no manual-rep gating. The calibration amendment (2026-07-05) DOES apply here: offer prediction checkpoints on substantive diffs/test outcomes/root causes, run bug drills on request, and auto-log graded reps via `rehab rep log` (see the Prediction Reps / Bug Drills / Automatic Drill Logging sections in the managed block above).

## Commit Attribution

AI commits MUST include:

```text
Co-Authored-By: (the agent's name and attribution byline)
```

## Working Notes

- Keep handoff docs concise; link to source docs rather than duplicating them.
- Markdown context pruning is tracked in `docs/prds/2026-07-06-markdown-context-pruning-spec.md`; treat old docs as guilty until this spec keeps them. There is no tracked `docs/prds/closed/` or `docs/reports/` directory as of the 2026-07-07 pass; closed cards and dated audits are archived, not retained as agent context.
- New multi-arc work is authorized and executed under `docs/campaign-workflow-protocol.md` (campaigns supersede per-arc agenda-card batch mechanics); durable decisions live in `docs/core-product-decision-log.yaml`, not in closed cards.
- Preserve unrelated user changes. Stage narrowly and check `git status` before committing.

## Provider Mandate

- Use OpenAI for all project LLM inference: runtime, simulations, judges, evals, probes, and agentic test workflows.
- Do not call Anthropic APIs, Anthropic SDKs, `claude` CLI workflows, or Claude/Anthropic-backed judge agents for this repo.
- If existing tooling depends on Anthropic, stop and replace it with an OpenAI Responses API path or report the work blocked; do not run the Anthropic path as a fallback.
- Default replacement ladder: `gpt-5.4-nano` for cheap classifiers/signals, `gpt-5.4-mini` for bulk per-scenario judges, `gpt-5.4` for higher-quality spot checks, and `gpt-5.5` only for final adjudication or hard disputed cases.

## Evidence And Test Discipline

- Treat full integration evidence as the proof surface for behavior claims.
- Unit, mocked, fixture, static, and runner-only tests are support scaffolding; without an endpoint/live-flow integration run, they may not prove what they claim.
- For route, planner, signal, validator, lab API, demo, or stakeholder behavior, verify with the full integration path. Extend the Hell Week battery when the current battery does not cover the claim.
- Do not present unsupported tests as proof. A test that gives false confidence is a net negative contribution to this project.

## Git Branch Discipline

- Check `git status --short --branch`, `git branch -vv`, and relevant upstream refs before moving branch pointers.
- Never use `git add .`; stage explicit paths only (`git add -- path/to/file`) so unrelated work is not swept into commits.
- Promotion path is `feature/*` / `fix/*` / worktree branches -> `dev` -> `staging` -> `main`.
- `main` accepts only promotions from `staging`; `staging` accepts only `dev`; `dev` accepts completed branches or worktrees.
- Use fast-forward, non-squash promotions when ancestry permits; stop on divergence or surprises.
- Inside worktrees, normal `feature/*`, `fix/*`, and `chore/*` branch conventions apply; merge completed branches back into the owning branch.
- Make atomic commits. Preserve the commit history when merging; never squash.
- Do not delete, reset, rebase, or force-push branches unless explicitly requested.

## Worktree Discipline

- Start worktree-sensitive tasks with `git worktree list --porcelain`.
- Work in the checkout the user named; do not assume sibling worktrees have the same files, env, or ignored context.
- When creating worktrees, copy required ignored local context such as `.claude/`, `.fallow/`, and `.env.example`; Git does not copy ignored files.
- Do not copy stale `.env` or `.env.local` between worktrees. Render fresh local caches from encrypted secrets instead.
- Do not move a branch that is checked out in another worktree; operate from that worktree or choose a non-destructive path.
- Preserve old branch state before reparenting or cleanup, usually with an archive branch rather than destructive history edits.

## Secret Discipline

- Canonical secret values live in encrypted `secrets/*.env.sops`; `.env.local`, `.env.staging`, and `.env.production` are ignored generated caches.
- Use `just secrets-status` before secret-dependent work; use `just secrets-render <env>` for normal local runs and `just secrets-run <env> -- <command>` for no-file execution.
- Treat legacy `.env` as deprecated local state; do not create or update it unless the user explicitly asks.
- Treat Vercel envs and Railway variables as deployment sinks, not source of truth; sync with `just secrets-sync-* <env> -- --dry-run` first, then `--apply` only when asked.
- Never print, commit, or paste decrypted secret values.

## Miscellaneous

### zsh expansion footguns

- Never use `path` as a shell variable; zsh ties it to `$PATH`, so assigning it clobbers command lookup. Use a prefixed name (`wt_path`):

```zsh
while IFS= read -r wt_path; do
  printf '\n%s\n' "$wt_path"
  git -C "$wt_path" status --short --branch
done < <(git worktree list --porcelain | awk '/^worktree / {print $2}')
```

- Quote words starting with `=` (for example `echo '==='`); unquoted, zsh applies `=cmd` filename expansion and the command fails with `== not found`.
