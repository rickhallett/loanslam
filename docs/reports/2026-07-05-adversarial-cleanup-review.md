# Adversarial Cleanup Review - 2026-07-05

Practical takeaway: the repo does not have a confirmed P0 source-code defect from
this review, but it does have a serious cleanup and proof-discipline problem.
The largest risks are stale or over-retained evidence artifacts, public/internal
report boundaries that blur, proof scripts that can touch production, and docs or
commands that still make retired surfaces look active.

This report combines:

- A 12-chunk adversarial review of the repo, split by subsystem and artifact
  surface.
- A follow-up refuter-style review focused on static dead-code, duplication,
  stale docs, and safe deletion candidates.
- Local verification of the highest-risk claims where cheap to check.

No source behavior was changed for this report.

## Review Baseline

- Repo: `/Users/mrkai/code/loanslam`
- Branch at write time: `main`, ahead of `origin/main` by 2 commits
- Pre-existing dirty files at write time:
  - `.claude/launch.json`
  - `AGENTS.md`
  - `packages/site-nuxt/assets/chat-widget.css`
  - `packages/site-nuxt/components/ChatWidgetPanel.vue`
  - untracked `.DS_Store`, `.claude/.DS_Store`
- Generated reports check: `node scripts/build-reports.mjs --check` returned
  `reports up to date`.
- Behavior tests, local servers, deployment commands, model-backed evals, and
  secret-dependent commands were not run.

## Scope

The repo was reviewed in these coherent chunks:

1. Core runtime, planner, validator, contracts
2. Lab API, MCP, CLI
3. Hell Week mechanics, judge, report generation
4. Hell Week fixtures, taxonomy, supporting docs
5. Simulation and stochastic testing
6. Current Nuxt site
7. Legacy Astro/widgets/integrated POC/lab UI
8. Ops scripts, config, gates
9. Active docs, operator doctrine, roadmaps
10. Closed docs, generated reports, public report pages
11. Phase 0 artifacts, model probes, lab-session evidence
12. Demo/site/integrated artifacts and live-capture archive

## Verified Signals

- `artifacts/phase0` has 94 tracked files.
- A sampled `artifacts/phase0/lab-session-*.json` contains conversation history,
  traces, `customerMessage`, and collected fact keys including `dateOfBirth`,
  `email`, `address`, and `situationSummary`.
- There are 45 tracked PNGs under `artifacts/` outside `artifacts/phase0`.
- `.gitignore` ignores `artifacts/*` except `artifacts/evidence-index/*.md`, but
  existing tracked artifact files remain in git history and the index.
- `site/docs/live-application-capture/source/*.html` contains production HTML/JS
  captures with analytics/bootstrap markers including `DD_RUM`,
  `googletagmanager`, and `contentsquare`.
- `scripts/dr003-live-restart-proof.mjs` defaults to a production Railway
  redeploy command.
- `railway.json` currently runs `npm run railway-build`, and that root script
  builds and serves Astro `site/dist`, while Nuxt docs/roadmaps describe
  `packages/site-nuxt` as the current site surface.
- With `site/dist` temporarily hidden, `npm --workspace @loanslam/site-nuxt run
  build` completed successfully. Nuxt does not require the Astro build output.
  It does still import `site/src` data/components/styles and `site/public`
  assets directly.

## P0 Candidate / P1

### 1. Raw transcript-shaped Phase 0 artifacts are tracked

**Priority:** P0 candidate if any real customer or operator PII entered these
artifacts; otherwise P1 cleanup.

**Evidence:**

- `git ls-files artifacts/phase0` returns 94 tracked files.
- Sampled `artifacts/phase0/lab-session-6c345a46-2026-06-14.json` contains
  `state.history`, `traces[].customerMessage`, and collected fact keys for
  `dateOfBirth`, `email`, and `address`.

**Why it matters:** the repo policy has moved toward compact evidence indexes,
but this folder still stores raw transcript-shaped session data. Even if the
current contents are synthetic, the retention pattern is too easy to repeat with
real data.

**Recommendation:** classify the contents, untrack raw lab sessions/probes,
replace with sanitized manifests and hashes, and decide whether history rewrite
or secret/privacy handling is needed.

## P1 Findings

### 2. Production restart proof defaults to redeploying production

**Priority:** P1

**Evidence:** `scripts/dr003-live-restart-proof.mjs` defaults
`DR003_RESTART_CMD` to:

```text
railway redeploy -p ... -s loanslam-site-nuxt -e production -y
```

and executes it with `execSync`.

**Why it matters:** a proof script can mutate production state by default.

**Recommendation:** require an explicit `--allow-production-redeploy` flag or
environment variable, default to dry proof, and make the production target
visible in the command name and docs.

### 3. Public reports exceed the sanitized-summary boundary

**Priority:** P1

**Evidence:** `packages/review-host/reports-manifest.json` says publishable
sources must be sanitized summaries, but
`packages/review-host/public/reports/hell-week-full.html` publishes all scenario
turns. Other public report pages include absolute local worktree paths.

**Why it matters:** stakeholder-facing reports can leak internal corpus,
operator context, stale paths, or raw run evidence.

**Recommendation:** split public report pages from internal full-evidence pages,
scrub absolute local paths, and make the report builder fail if unmanifested HTML
would still ship.

### 4. Live application capture stores production source, not just evidence

**Priority:** P1

**Evidence:** `site/docs/live-application-capture/source/*.html` contains
downloaded live HTML/JS with analytics/bootstrap markers. The same archive also
keeps screenshot receipts.

**Why it matters:** stale production-source retention can expose third-party
identifiers and creates a misleading "source of truth" outside the application.

**Recommendation:** replace raw source with a redacted route/copy/field manifest
and move raw captures/screenshots to an explicitly quarantined local archive if
they must be retained.

### 5. Astro build/deploy path is deletable, but production config still points at it

**Priority:** P1

**Evidence:** `railway.json` runs root `railway-build`; `package.json`
`railway-build` uses `npm --prefix site run build`, then `railway-start` serves
`site/dist`. Meanwhile the Nuxt roadmap and recent operator memory treat
`packages/site-nuxt` as the current site surface. A direct check with
`site/dist` hidden confirmed the Nuxt build does not depend on Astro build
output.

**Why it matters:** the Astro build/deploy path is now cleanup debt, but the
current production config still points at it. Operators can deploy, verify, or
delete the wrong surface unless the cutover is explicit.

**Recommendation:** schedule deletion of the Astro build/deploy path as part of
cleanup after switching root/Railway build-start scripts to the Nuxt output.
Do not delete the whole `site/` source tree in the same step: Nuxt still imports
`site/src` and `site/public` directly.

### 6. Hell Week judge coverage can produce false confidence

**Priority:** P1

**Evidence:** Hell Week aggregation treats a boolean judged state as enough,
without proving exact scenario-id coverage and current judge metadata.

**Why it matters:** partial judge verdicts can make a run look ship-ready.

**Recommendation:** require exact scenario coverage, judge version/model
metadata, and current rubric hash before a judged aggregate can count.

### 7. Signal extraction errors are dropped before grading/reporting

**Priority:** P1

**Evidence:** the engine records `shadowSignalError`, but Hell Week runner/types
do not carry signal errors through evidence, DB, or reports.

**Why it matters:** failures in load-bearing safety signal extraction can vanish
from the proof surface.

**Recommendation:** propagate `signalError` through run JSON, DB, reports, and
gate logic. Fail or downgrade when enabled signal extraction errors.

### 8. Candidate intake facts count as confirmed handoff facts

**Priority:** P1

**Evidence:** planner doctrine says `*_candidate` fields require confirmation,
but engine handoff completion accepts candidate facts as collected fields.

**Why it matters:** handoff can complete before the user confirmed sensitive
facts.

**Recommendation:** keep candidate fields missing until confirmed and update
tests that currently expect ticket creation from candidate facts.

### 9. Route audit misses the carryover state leak it names

**Priority:** P1

**Evidence:** route-audit normalization strips account/change flags from answer
rows before the classifier checks for carryover-on-answer leakage.

**Why it matters:** an audit named to detect this class of leak can pass the
precise scenario it should catch.

**Recommendation:** classify from raw state flags and handoff-pending state
before normalization.

### 10. Stochastic scenario replay can overwrite full-run artifacts

**Priority:** P1

**Evidence:** stochastic artifact paths are seed-based even when replay narrows
to one scenario.

**Why it matters:** a targeted replay can overwrite or be mistaken for a full
seed run.

**Recommendation:** include scenario id in replay output paths or require an
explicit output directory for narrowed replays.

### 11. `clarification_loop` is declared but never emitted

**Priority:** P1

**Evidence:** STS schema/templates include `clarification_loop`, but the
evaluator does not emit it.

**Why it matters:** a hard-failure category can appear covered while no check is
actually implemented.

**Recommendation:** add the evaluator check or delete the category and target.

### 12. Hell Week taxonomy fields look behavior-bearing but are not enforced

**Priority:** P1

**Evidence:** `failureMarkers` and `severityFloor` exist in scenario taxonomy,
but are not passed to the judge or enforced in grade aggregation.

**Why it matters:** scenario metadata can imply a proof bar that the runner does
not honor.

**Recommendation:** wire these fields into judge packets/gating or rename them
as human-only metadata.

### 13. Evidence baseline points at missing or partial reports

**Priority:** P1

**Evidence:** `artifacts/evidence-index/baseline.json` points to report paths
that are missing or partial.

**Why it matters:** baseline proof cannot be replayed or trusted from the
checked-in pointer alone.

**Recommendation:** store a checked-in digest or DB replay id plus exact commands,
and remove dead report paths.

### 14. Branch-risk under-classifies active site and IPOC changes

**Priority:** P1

**Evidence:** `scripts/branch-risk.ts` handles several UI paths but misses active
`packages/site-nuxt/**` and integrated POC changes.

**Why it matters:** changes to the current interactive surface can receive a
lower proof bar than they need.

**Recommendation:** add `packages/site-nuxt/**` and
`packages/integrated-poc/**`, with live read-back proof requirements.

### 15. Provider mandate scanning is too narrow

**Priority:** P1

**Evidence:** the source policy check scans TypeScript-focused sources and
blocks Anthropic imports, while the secrets manifest still recognizes
non-OpenAI provider keys.

**Why it matters:** repo policy says all project inference uses OpenAI, but the
guard is narrower than the policy.

**Recommendation:** scan JS/MJS/CJS as well as TS, block non-OpenAI inference
provider imports/env keys unless explicitly allowlisted, and document any
non-inference exceptions.

### 16. Nuxt unknown first-party URL fallback rewrites to homepage

**Priority:** P1

**Evidence:** `packages/site-nuxt/lib/siteUrls.ts` falls back unknown first-party
paths to the homepage.

**Why it matters:** stale or invalid first-party links can be masked as valid.

**Recommendation:** fail closed for unknown first-party paths.

### 17. Active docs and closed roadmaps still look executable

**Priority:** P1

**Evidence:** closed PRDs/roadmaps retain imperative language and active-looking
status fields. `AGENTS.md` points key implementation starts at closed agenda
cards.

**Why it matters:** future agents can revive historical work or bypass the
campaign workflow.

**Recommendation:** add uniform closed/historical banners, move or demote closed
roadmaps, and make the active campaign/front-door doc unmistakable.

### 18. Active PRD directory contains superseded widget architecture

**Priority:** P1

**Evidence:** an active PRD still describes prior widget architecture that the
cleanup matrix says has been superseded by I-POC/Nuxt work.

**Why it matters:** old architecture can be mistaken for current design input.

**Recommendation:** close or archive the PRD and link to the current decision.

### 19. README/front-door docs misdescribe current surfaces

**Priority:** P1

**Evidence:** README repository map omits `packages/site-nuxt` and presents
`site/` as the only site surface. Other docs describe integrated POC and Nuxt
deployment states inconsistently.

**Why it matters:** the root docs send operators to the wrong surface.

**Recommendation:** update README and `CONTEXT.md` with a current surface map:
Astro production status, Nuxt status, review/demo hosts, IPOC, lab, and proof
commands.

### 20. Default runtime corpus is synthetic but treated like real public info

**Priority:** P1

**Evidence:** `data/public-info/loanslam-synthetic-kb.json` contains synthetic
contacts/copy that drift from the FAQ/source corpus.

**Why it matters:** regulated lending copy and contact details can drift into
answers or page context.

**Recommendation:** mark synthetic corpora as non-deployable or derive runtime
contact facts from the canonical real source.

## P2 Findings

### 21. Tracked binary proof receipts contradict the evidence-index policy

**Priority:** P2

**Evidence:** `.gitignore` ignores `artifacts/*` except
`artifacts/evidence-index/*.md`, but 45 tracked PNGs remain outside
`artifacts/phase0`, plus large live-capture screenshots.

**Recommendation:** keep compact manifests/hashes and untrack most screenshot
receipts after retargeting roadmap links.

### 22. Closed one-shot demo-concierge proof scripts are burn candidates

**Priority:** P2

**Evidence:** these scripts are present at root:

- `scripts/dc002-surface-proof.mjs`
- `scripts/dc003-navigate-proof.mjs`
- `scripts/dc004-concierge-probe.mjs`
- `scripts/dc005-form-state-proof.mjs`
- `scripts/dc006-handoff-proof.mjs`
- `scripts/dc007-exposure-proof.mjs`
- `scripts/dc2-001-presence-proof.mjs`
- `scripts/dc2-002-page-context-proof.mjs`
- `scripts/dc2-003-persistence-proof.mjs`

Docs and artifacts reference their historical outputs, but no live `just`/CI
entrypoint was confirmed.

**Recommendation:** preserve durable receipt summaries, then delete or quarantine
the one-shot scripts. Do not delete the historical closeout records that explain
what they proved.

### 23. Generated report allowlist fails open

**Priority:** P2

**Evidence:** the report manifest says unlisted reports do not ship, but the
builder only warns that unknown HTML "will be served anyway".

**Recommendation:** make `--check` fail on unmanifested HTML or delete unknown
HTML in normal build mode.

### 24. `judgeScenario` is an unused exported wrapper

**Priority:** P2

**Evidence:** `packages/core/src/hellweek/openaiJudge.ts` exports
`judgeScenario`, while callers use `judgeScenarioPacket` or
`judgeScenarioPacketWithEscalation`.

**Recommendation:** remove the wrapper if API compatibility is not required.

### 25. Disabled contact-close reveal subsystem is dead UI code

**Priority:** P2

**Evidence:** `CONTACT_CLOSE_REVEAL_ENABLED = false` gates reveal behavior in
`ChatWidgetPanel.vue`, while `contact.vue` still contains `[data-revealed]`
styling.

**Recommendation:** delete the reveal subsystem in a separate change because
`ChatWidgetPanel.vue` has active uncommitted edits.

### 26. Root `pg` and `@neondatabase/serverless` deps look redundant

**Priority:** P2

**Evidence:** source grep found no direct imports for `pg` or
`@neondatabase/serverless`; Prisma adapters appear to own the real dependency
path.

**Recommendation:** remove only after `npm ci`, typecheck, and build prove the
lockfile still resolves correctly.

### 27. Demo and review widgets mirror transport/session logic

**Priority:** P2

**Evidence:** review and demo widget clients share near-identical HTTP/session
logic.

**Recommendation:** preserve distinct skins if needed, but extract shared
transport/session/intake/composer code or explicitly freeze one package for
sunset.

### 28. Scraped Astro content is still Nuxt input

**Priority:** P2

**Evidence:** `packages/site-nuxt/nuxt.config.ts` uses `site/src/styles` and
`site/public`; Nuxt pages/libs import `site/src/data`, `site/src/data/site-copy`,
and `site/src/components/ApplicationJourney.vue`. The raw content records
contain duplicate/stale copy and links.

**Recommendation:** make this the second phase of Astro cleanup: migrate the
needed source data/components/styles/assets into `packages/site-nuxt` or a small
shared package, then delete the remaining Astro source. Until then, only the
Astro build/deploy path is ready to schedule for deletion.

### 29. Concierge site map omits live routes and hidden routes remain routable

**Priority:** P2

**Evidence:** the concierge site map is hand-maintained and does not fully match
live route/content inventory.

**Recommendation:** derive from route/content inventory or explicitly block and
redirect excluded routes.

### 30. URL and host policy is duplicated

**Priority:** P2

**Evidence:** URL/host logic appears across site URL helpers, nav-offer logic,
brand text, and widget links.

**Recommendation:** centralize first-party URL policy and reuse it from UI,
engine, and tests.

### 31. Lab/demo serving surfaces are too coupled

**Priority:** P2

**Evidence:** lab API has hidden intake/cancel routes, and one serve command can
mount proof/demo surfaces by default.

**Recommendation:** promote or delete hidden routes, and split `lab-serve` from
`demo-serve` or make demo mounting opt-in.

### 32. Old probe scripts reference missing PRDs or missing baselines

**Priority:** P2

**Evidence:** old proof/probe scripts point to absent PRDs and historical run
directories.

**Recommendation:** delete/quarantine them or rebase them on
`artifacts/evidence-index`.

### 33. Operator proof docs are duplicated or stale

**Priority:** P2

**Evidence:** QA checklist, proof doctrine, decision-log metadata, and old
architecture references duplicate each other or point at dead docs.

**Recommendation:** keep one current proof ladder: capture, judge, floor-delta,
gate-slice, digest/checkpoint.

### 34. Ignored local proof piles have no active doc references

**Priority:** P2

**Evidence:** ignored local artifact directories exist for old proof efforts but
are not linked from active docs.

**Recommendation:** burn local ignored outputs or move them under external/local
evidence storage. Keep scripts that can regenerate necessary evidence.

### 35. Report generator check is not part of default verification

**Priority:** P2

**Evidence:** `node scripts/build-reports.mjs --check` passes now, but default
verification does not run it.

**Recommendation:** add the check to an appropriate proof command or a targeted
report verification target.

## P2 Refactor Targets

These are behavior-preserving simplification candidates. They should be done as
small, separately verified changes.

1. Extract duplicated `mapLimit` from `hellweek/calibration.ts` and
   `hellweek/openaiJudge.ts` into one helper.
2. Collapse `buildComparabilityWarnings` in `hellweek/compare.ts` into
   data-driven rows.
3. Deduplicate the verify/hard-dispute escalation ladder across judge entrypoints.
4. Extract CLI helpers for repeated judge-model triads and DB URL fallback.
5. Refactor `lab/server.ts` request handling into a base context object and
   generic dispatch helper while preserving route ordering.
6. Centralize `escapeHtml`; `hellweek/stability.ts` has a variant that does not
   escape single quotes.
7. Import canonical `severityRank` and `HellWeekVerdict` into
   `hellweek/compare.ts` instead of redeclaring them.
8. Extract report metric helpers from `aggregate.ts`.
9. Extract `decodeSafetyPacket` in `openaiJudge.ts`.
10. Share `markdownTableRow` / audit row construction in `routeAudit.ts`.

## P3 Findings

### 36. Integrated POC duplicates telemetry and session guard logic

**Priority:** P3

**Recommendation:** export one telemetry builder and one `requireIpocSession`
helper. Verify with native chat `?devtools=true` and full route probes, not only
typecheck.

### 37. Vulnerability flag policy is duplicated

**Priority:** P3

**Recommendation:** centralize the vulnerability/safety flag policy helper and
reuse it from retriever, policy, and validator paths.

### 38. `shadowSignal` naming is stale

**Priority:** P3

**Recommendation:** add non-shadow aliases or plan a rename now that signal
extraction is load-bearing.

### 39. Local churn files are not ignored or are tracked

**Priority:** P3

**Evidence:** `.DS_Store` is unignored; `.fallow/cache.bin` and
`.fallow/churn.bin` are tracked binaries that churn on analysis.

**Recommendation:** ignore `.DS_Store`, remove local `.DS_Store` files, and
untrack or document `.fallow` cache files.

### 40. Operator bundles duplicate local agent material

**Priority:** P3

**Evidence:** `.agents` and `.claude` contain overlapping operator skill/config
material.

**Recommendation:** generate or sync from one source rather than hand-maintaining
duplicates.

### 41. Launch config hard-codes raw commands and sibling worktrees

**Priority:** P3

**Recommendation:** route launch commands through `just` or parameterize them so
they do not drift across worktrees.

## Do Not Burn Without A Human Decision

- The whole `site/` source tree: Nuxt still imports `site/src` and `site/public`
  directly. The Astro build output and Astro deployment scripts can be scheduled
  for deletion, but source/content/assets need a migration step first.
- `site` content JSON and `site/public`: keep until Nuxt owns or shares those
  inputs from a non-Astro location.
- `scripts/contact-chat-parity.mjs`, `sitenuxt-chat-battery.mjs`, and
  `site-parity-harness.mjs`: the refuter pass found live/standalone references.
- `demo-widget` and `review-widget` as a pair: similarity is real, but there are
  historical/stakeholder reasons for separate skins.
- Full `packages/core` dead-export lists from static analysis: many exports are
  used through tests, CLI dispatch, same-file paths, or dynamic proof surfaces.
- `artifacts/evidence-index`: this is the desired compact retention pattern, not
  a burn target.

## Suggested Work Packs

### Pack 1: Retention and exposure

1. Classify and untrack raw Phase 0 session/probe artifacts.
2. Quarantine or summarize live application captures.
3. Split public report summaries from internal full evidence.
4. Harden report manifest checks.

### Pack 2: Production and proof safety

1. Make production redeploy proof opt-in.
2. Switch Railway/root build-start scripts from Astro `site/dist` to Nuxt output,
   then schedule the Astro build/deploy path for deletion.
3. Add active site/IPOC paths to branch-risk.
4. Add report check to the appropriate verification path.

### Pack 3: False-confidence gates

1. Require exact Hell Week judge coverage.
2. Propagate signal extraction errors.
3. Stop candidate facts from completing handoff.
4. Fix route-audit carryover classification.
5. Fix STS replay artifact provenance.

### Pack 4: Stale docs and artifacts

1. Add closed/historical banners.
2. Close superseded active PRDs.
3. Retarget roadmap links away from raw screenshot/script receipts.
4. Burn one-shot demo-concierge scripts after receipt preservation.

### Pack 5: Small refactors

1. `mapLimit`, `severityRank`, and `escapeHtml` dedup.
2. Judge escalation helper.
3. CLI config helpers.
4. Lab server dispatch helper.
5. IPOC telemetry/session helpers.

## First Safe Slice

The safest first implementation slice is:

1. Add `.DS_Store` to `.gitignore`.
2. Untrack `.fallow/cache.bin` and `.fallow/churn.bin` if the team confirms they
   are local analysis caches.
3. Remove unused `judgeScenario`.
4. Extract `mapLimit`.
5. Add report-builder failure on unmanifested HTML.

Avoid touching `ChatWidgetPanel.vue` in that first slice because it has active
uncommitted user edits.
