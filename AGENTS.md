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

### Railway Staging Exception — Owner Decision

- Recorded Saturday, 18 July 2026 at 05:59 BST: the Railway service named
  `loanslam-site-nuxt-staging` is intentionally left backed by the parked
  `feature/demo-concierge-03` lineage. It is not the deployment of the Git
  `staging` branch.
- The owner explicitly decided to keep this mismatch in place because it is
  not worth changing now and must be revisited separately later.
- Do not merge this parked feature into live production code, repoint or
  redeploy the Railway staging service, or infer that it represents Git
  `staging` without fresh owner instruction.
- The retired branch lineage and deployment context are preserved under
  `archive/2026-07-18/demo-concierge-03` and the external worktree-retirement
  archive recorded in the project README.

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
