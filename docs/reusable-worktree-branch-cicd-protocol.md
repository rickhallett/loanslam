# Reusable Worktree, Branch, And CI/CD Protocol

Use this as a starter protocol for repositories where agents need to keep
branch, worktree, verification, and promotion hygiene consistent.

The core idea: agents should not improvise release process from memory. Give
them a small operator surface, make proof requirements mechanical, isolate
parallel work in worktrees, and promote through a protected ladder without
squashing history.

## Doctrine

1. Verify before reporting.
2. Work in the checkout the user named.
3. Preserve unrelated changes.
4. One slice owns one concern.
5. Promote by fast-forward, non-squash hops through the ladder.
6. Treat CI, hooks, and deployment read-back as proof surfaces, not ceremony.
7. Stop on divergence, dirty surprises, missing secrets, or unproven behavior.

## Agent Startup Checklist

Every mutating or merge-sensitive task starts with:

```sh
git worktree list --porcelain
git status --short --branch
git branch -vv
```

Then classify the task:

- read-only: inspect, summarize, audit, or plan only.
- mutating: edits, generated files, dependency changes, migrations, docs rewrites.
- merge-sensitive: branch movement, release promotion, PR merge, worktree pruning.
- secret-sensitive: env files, deployment variables, credentials, encrypted secret stores.
- behavior-sensitive: product behavior, routing, validation, data migrations, API contracts, user-facing flows.

Before editing, identify:

- the exact branch and worktree that owns the change;
- the protected branches that must not be moved from this checkout;
- the narrowest proof bar required by the changed files;
- the one concern this slice is allowed to touch.

## Worktree Discipline

Use worktrees for parallel or risky work. Do not stack unrelated experiments in
one dirty checkout.

Recommended conventions:

- long-running arcs: `worktree-<topic>-arc`;
- bounded slices: `slice/<owner>-<short-hypothesis>-<stamp>`;
- planning-only handoffs: one worktree plus one uncommitted planning document.

Rules:

- Create each slice from the intended baseline branch, usually `dev` or the
  repo's integration branch.
- Never move a branch that is checked out in another worktree.
- Never create work directly on `main`, `staging`, `production`, or equivalent
  protected branches.
- Copy only safe local context that Git does not carry, such as agent settings,
  examples, or non-secret config.
- Do not copy stale `.env` or generated secret caches between worktrees.
- Render or fetch fresh local secrets through the repo's secret workflow.
- Prune a worktree only after its work is merged or deliberately abandoned.
- Delete the slice branch only after confirming no active worktree owns it.

Parallelism is safe only when write scopes are disjoint. Define repo-specific
owners such as `api`, `web`, `auth`, `billing`, `infra`, `docs`, `tests`, or
`data`. One slice changes one owner. If two slices need the same owner, serialize
them.

## Branch Promotion Ladder

Use an explicit ladder. A common shape:

```text
feature/* | fix/* | chore/* | slice/* -> dev -> staging -> main
```

Promotion rules:

- `main` accepts only `staging`.
- `staging` accepts only `dev`.
- `dev` accepts completed feature, fix, chore, or slice branches.
- Use fast-forward, non-squash promotion when ancestry permits.
- Preserve commit history across the ladder.
- Stop on divergence; do not rebase, force-push, or reset protected branches
  unless the user explicitly asks.
- Run the required proof bar before each hop, not after.
- If a branch is checked out elsewhere, operate from the owning worktree.

This keeps deployment history explainable. Squash merges hide the path that made
the release safe; forced branch movement makes agents dangerous.

## Proof Bar Classification

Every repo should expose a deterministic command that maps changed files to a
proof tier. It might be `just branch-risk`, `make branch-risk`,
`npm run branch-risk`, or a CI workflow.

A portable tier model:

| Tier | Typical triggers | Required proof |
| --- | --- | --- |
| Docs | Markdown, comments, diagrams | format/link check or doc review |
| Tooling | scripts, build config, local commands | unit test for script, self-gate |
| UI | frontend views, CSS, client behavior | build/test plus browser or screenshot read-back |
| API | routes, handlers, validation, auth boundaries | integration/API test plus contract check |
| Data | migrations, schema, seed data | migration dry-run, rollback plan, integration read-back |
| Infra | deploy config, CI, runtime settings | preview deploy or dry-run plus live environment read-back |
| Behavior | ranking, routing, policy, planner, business-critical logic | full integration scenario proof, not just unit tests |
| Secrets | encrypted secret source, env sync, credentials | dry-run sync, no printed secrets, no committed decrypted cache |

The key rule is not the exact labels. The key rule is that a changed file must
mechanically imply its proof bar before anyone reports success.

## Deterministic Operator Surface

Give agents one small control surface. Prefer `just`, `make`, `npm scripts`, or
a thin CLI over prose-only instructions.

Recommended commands:

```sh
just status-snapshot        # branch, upstream, dirty tree, worktrees, hook state
just branch-risk -- <base>  # changed files -> required proof tier
just self-gate              # cheap local checks: format, lint, typecheck, tests, build
just gate-slice             # staged-diff guard before commit
just evidence -- <target>   # repo-specific integration proof
just digest -- <run>        # summarize proof without private/raw logs
just checkpoint-packet      # status + proof bar + evidence summary for review
just promote-hop <from> <to>
```

Each command should be deterministic where possible. Model calls, flaky external
systems, and costly integration runs belong behind explicit evidence commands,
not in the cheap self-gate.

## Commit Gate

Install a staged-diff gate close to commit time. It should block:

- decrypted `.env` caches and secret-looking content;
- generated transcripts, private logs, or bulky evidence artifacts that should
  not live in Git;
- protected-boundary imports, such as demo code importing review code or test
  fixtures importing production-only helpers;
- behavior-sensitive code without the required integration receipt;
- source-policy violations, such as a banned provider SDK or disallowed runtime.

The gate should inspect the staged diff, not the whole working tree, so agents
can keep unrelated user changes untouched.

## CI/CD Discipline

CI should repeat the same proof ladder used locally:

1. Cheap deterministic checks first.
2. Build and type checks before deploy.
3. Integration proof for behavior-sensitive changes.
4. Secret/deploy dry-runs before environment mutation.
5. Preview or staging deploy read-back before production promotion.
6. Production read-back after promotion.

Deployment config should live in the repo. Environment variables and secret
values should not. Treat Vercel, Railway, AWS, Fly, or any other platform as a
deployment sink; keep the source of truth in an encrypted secret store or
another deliberate local process.

Do not call a deploy successful because the command exited zero. Read back the
actual route, job, migration state, health endpoint, dashboard, or log line that
proves the deployed surface is serving the intended change.

## PR And Review Packet

Every PR or merge request should include:

- current branch and target branch;
- changed-file risk tier;
- commands run and their result;
- integration evidence or a clear statement that none was required;
- deployment/read-back evidence if applicable;
- known residual risk;
- confirmation that unrelated dirty files were left alone.

Keep raw logs, private transcripts, and bulky artifacts out of Git. Put concise
numbers, paths, IDs, and links in the PR body so the proof survives worktree
cleanup.

## Stop Conditions

Agents must stop and report instead of pushing through when:

- the named checkout is not the active checkout;
- the branch is checked out in another worktree;
- the working tree contains unrelated dirty changes that would be touched;
- proof requirements are unclear;
- a required secret is missing or would need to be printed;
- protected branches diverged;
- a deployment or migration would mutate production without explicit approval;
- tests pass but the relevant integration or live-flow proof is absent;
- the change expands beyond the declared owner slice.

Stopping is not failure here. It is how the protocol avoids fake confidence.

## Portable Agent Instruction Block

Paste this into another repo's `AGENTS.md` or equivalent, then fill in the
repo-specific branch names, commands, and proof tiers.

```text
## Worktree And Branch Discipline

- Start worktree-sensitive tasks with `git worktree list --porcelain`,
  `git status --short --branch`, and `git branch -vv`.
- Work in the checkout the user named.
- Preserve unrelated user changes. Stage narrowly.
- Do not move a branch checked out in another worktree.
- Do not reset, rebase, force-push, or delete branches unless explicitly asked.
- Use isolated worktrees for parallel or risky work.
- One slice owns one concern; parallel slices must not share an owner.
- Do not copy stale `.env` or generated secret caches between worktrees.

## Promotion Discipline

- Promotion path is: <feature/fix/chore/slice branches> -> <integration> ->
  <staging> -> <main>.
- <main> accepts only <staging>; <staging> accepts only <integration>.
- Use fast-forward, non-squash promotions when ancestry permits.
- Stop on divergence or protected-branch surprises.
- Preserve commit history across promotion hops.

## Proof Discipline

- Run `<status-snapshot command>` before mutating or promoting.
- Run `<branch-risk command>` to determine the required proof bar.
- Cheap checks such as lint/type/test/build prove wiring, not necessarily
  behavior.
- Behavior-sensitive changes require full integration or live-flow evidence.
- Deployment-sensitive changes require deploy/read-back evidence.
- Do not report success until the proof bar for the changed files is met.

## Commit And CI/CD Hygiene

- Run `<self-gate command>` before review.
- Run `<staged-diff gate command>` before commit when available.
- Never commit decrypted secrets, raw private logs, or bulky generated evidence.
- Treat deployment platforms as sinks, not secret sources of truth.
- A deploy is successful only after live read-back proves the intended surface.
```

## Implementation Notes For A New Repo

Start small:

1. Add a `status-snapshot` command.
2. Add a `branch-risk` command that maps paths to proof tiers.
3. Add a cheap `self-gate`.
4. Add a staged-diff `gate-slice` for secrets and forbidden paths.
5. Document the promotion ladder in `AGENTS.md`.
6. Add a `checkpoint-packet` command that prints status, risk, proof, and next
   hop in one place.

The goal is not process theater. The goal is that any agent can enter a repo,
learn the active checkout, choose the correct proof bar, avoid branch damage,
and leave behind evidence a human can trust.
