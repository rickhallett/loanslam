# lsops Operator Tools Spec

Date: 2026-07-06
Status: proposed
Owner: operator tooling

## Summary

Create `lsops`, a private internal utility package and CLI that replaces the
current pile of one-off JavaScript and TypeScript operator scripts with a
coherent, typed, reusable tooling system.

`lsops` is not product runtime code. It is the operator and evidence toolkit
for Loanslam: proof harnesses, browser automation, API batteries, report
generation, secret sync wrappers, campaign consistency checks, and LLM judging
plumbing. The current script names may remain temporarily as compatibility
shims, but the reusable logic should live in one package with one public
operator command.

## Problem

The repository has accumulated many useful scripts, but the implementation
surface is now fragmented:

- Browser proof scripts copy the same Playwright launch code, screenshot
  plumbing, `check()` helper, result tally, and exit handling.
- Several scripts hard-code a local macOS Playwright Chromium cache path,
  coupling all proofs to one machine and one Playwright revision.
- HTTP batteries repeatedly reimplement JSON fetch wrappers and route/session
  clients.
- LLM judge and evaluator scripts own separate OpenAI wrappers, parsing,
  cost accounting, and failure handling.
- Some probe/evaluator scripts can write a failure-filled artifact while
  exiting successfully, which violates the repo's evidence discipline.
- Sensitive secret-sync code uses the same subprocess error path as ordinary
  commands, increasing the risk of accidental value exposure on third-party
  CLI failures.
- The root `scripts/` directory mixes active operator surfaces, retired
  campaign receipts, probes, deploy packaging, and throwaway research.

The consequence is not just clutter. It creates real proof risk: a tool can
look green while the behavior it claims to verify was not exercised, and fixing
one harness bug requires editing many copies.

## Goals

- Provide one private package for operator tooling: `@loanslam/lsops`.
- Provide one operator CLI: `lsops`.
- Preserve `just` as the human-facing command surface; `just` should call
  `lsops` subcommands instead of bespoke script files.
- Make evidence runs falsifiable: failed probes, broken judge verdicts, API
  errors, and partial harness failures must fail loudly.
- Centralize browser launch, HTTP clients, OpenAI judge wrappers, artifact
  writing, redaction, and exit-code policy.
- Convert historical campaign proof scripts into declarative scenario modules
  where they still matter; otherwise keep only their committed receipts.
- Keep product runtime assets separate from operator tooling.

## Non-Goals

- Do not change customer-facing behavior.
- Do not merge demo and review widgets.
- Do not rewrite Hell Week core behavior in this effort.
- Do not replace `just`; it remains the operator front door.
- Do not move public embed loaders into `lsops`; they are runtime assets.
- Do not delete historical proof receipts as part of the first migration.
- Do not introduce non-OpenAI inference paths.

## Current Script Groups

### Browser and UI Proofs

Examples:

- `scripts/dc002-surface-proof.mjs`
- `scripts/dc003-navigate-proof.mjs`
- `scripts/dc005-form-state-proof.mjs`
- `scripts/dc006-handoff-proof.mjs`
- `scripts/dc2-001-presence-proof.mjs`
- `scripts/dc2-002-page-context-proof.mjs`
- `scripts/dc2-003-persistence-proof.mjs`
- `scripts/dr001-resurrection-proof.mjs`
- `scripts/dr002-streaming-proof.mjs`
- `scripts/dr003-live-restart-proof.mjs`
- `scripts/contact-assistant-ux-proof.mjs`
- `scripts/seam-walk-proof.mjs`
- `scripts/concierge-nav-proof.mjs`
- `scripts/concierge-journey-memory-proof.mjs`
- `scripts/concierge-rehearsal.mjs`

These should become scenario definitions over a shared browser proof runner.

### HTTP and API Batteries

Examples:

- `scripts/ipoc-integration-battery.mjs`
- `scripts/sitenuxt-chat-battery.mjs`
- `scripts/dc004-concierge-probe.mjs`
- `scripts/dc007-exposure-proof.mjs`
- `scripts/concierge-probes.mjs`

These should use typed API clients and shared result reporting.

### LLM Evaluation and Judging

Examples:

- `scripts/concierge-probes-judge.mjs`
- `scripts/ux-evaluator-probe.mjs`
- `scripts/phase0-cheap-model-quality-probe.ts`

These should share OpenAI Responses API wiring, schema parsing, retries,
adjudication ladder policy, usage/cost capture, and non-zero exit rules.

### Reports, Parity, and Deploy Packaging

Examples:

- `scripts/build-reports.mjs`
- `scripts/site-parity-harness.mjs`
- `scripts/contact-chat-parity.mjs`
- `scripts/site-nuxt-deploy-pack.mjs`

These should share manifest validation, HTML escaping/rendering helpers,
pixel diff utilities, artifact writing, and deterministic output handling.

### Infra and Campaign Operations

Examples:

- `scripts/secrets.mjs`
- `scripts/campaign-consistency-check.mjs`
- `scripts/branch-risk.ts`
- `scripts/gate-slice.ts`
- `scripts/floor-delta.ts`
- `scripts/digest.ts`
- `scripts/check-typescript-source-policy.ts`
- `scripts/slice-worktree.sh`
- `scripts/status-snapshot.sh`
- `scripts/checkpoint-packet.sh`

The TypeScript gates are already closer to the target shape because they expose
testable functions. They should move last, after the proof harness proves the
package boundary.

### Runtime Browser Assets

Examples:

- `packages/review-host/public/loader.js`
- `packages/demo-host/public/loader.js`
- `packages/review-host/public/devtools.js`
- `site/astro.config.mjs`

These are not `lsops` code. The loaders and devtools panel may share protocol
types through `@loanslam/contracts`, but they should not be bundled into the
operator CLI package.

## Proposed Package

Add a new private workspace:

```text
packages/lsops/
  package.json
  tsconfig.json
  src/
    index.ts
    cli/
      main.ts
      commands.ts
    checks/
      CheckRun.ts
      exitPolicy.ts
    artifacts/
      ArtifactWriter.ts
      redaction.ts
      stablePaths.ts
    browser/
      launchProofBrowser.ts
      proofPage.ts
      waitForTurn.ts
      pixelDiff.ts
    http/
      JsonClient.ts
      ConciergeClient.ts
      IpocClient.ts
    judge/
      openaiResponses.ts
      adjudicationLadder.ts
      usageCost.ts
    reports/
      manifest.ts
      markdown.ts
      html.ts
    secrets/
      manifest.ts
      dotenv.ts
      sops.ts
      remoteSync.ts
    campaign/
      roadmap.ts
      receipts.ts
      writeScope.ts
    scenarios/
      concierge/
      ipoc/
      siteNuxt/
```

The package is private and internal. It is consumed by repo scripts, `just`
targets, and future CI jobs.

## CLI Shape

`lsops` should expose narrow, typed commands:

```text
lsops proof run <scenario> [--base <url>] [--out <dir>] [--json]
lsops battery run <battery> [--base <url>] [--out <file>] [--json]
lsops probe concierge [--base <url>] [--out <file>]
lsops judge concierge-probes --in <file> --out <file>
lsops reports build [--check]
lsops parity site --astro-base <url> --nuxt-base <url> [--routes <csv>]
lsops secrets status [env]
lsops secrets render <env>
lsops secrets run <env> -- <command...>
lsops secrets sync vercel <env> [--dry-run|--apply]
lsops secrets sync railway <env> [--dry-run|--apply] [--service <name>]
lsops campaign check <roadmap.yaml...>
```

Compatibility shims may remain temporarily:

```text
scripts/seam-walk-proof.mjs -> lsops proof run seam-walk
scripts/build-reports.mjs -> lsops reports build
scripts/secrets.mjs -> lsops secrets ...
```

## Core APIs

### CheckRun

All proof and battery tools should report through one result object:

```ts
type CheckStatus = "pass" | "fail" | "skip";

interface CheckResult {
  id: string;
  status: CheckStatus;
  detail?: string;
  artifacts?: string[];
}

interface CheckRunSummary {
  id: string;
  startedAt: string;
  base?: string;
  passed: number;
  failed: number;
  skipped: number;
  results: CheckResult[];
}
```

Rules:

- Any `fail` exits non-zero by default.
- Harness infrastructure errors are recorded separately from product failures.
- JSON output and console output come from the same data model.
- No script writes a green artifact while exiting zero on failed setup.

### Browser Harness

`launchProofBrowser()` owns Playwright launch policy:

- Prefer Playwright's own executable resolution.
- Support a single environment override, for example
  `LSOPS_CHROMIUM_PATH`.
- Always close browsers in `finally`.
- Standardize viewport defaults.
- Provide helpers for screenshots, animation disabling, font settling, and
  stable turn completion.

### HTTP Clients

`JsonClient` owns:

- Base URL handling.
- JSON request/response parsing.
- Non-JSON error bodies.
- Timeout and retry policy where appropriate.
- Redacted error messages.

Domain clients own route shape and status semantics:

- `ConciergeClient`
- `IpocClient`

For example, the "400 means session exists, 404 means session missing" probe
used by restart-recovery proofs should live in `ConciergeClient`, not in
multiple scripts.

### Judge Harness

The judge module owns:

- OpenAI-only Responses API calls.
- Structured schema parsing.
- Per-case try/catch with partial artifact writing.
- Escalation ladder defaults.
- Usage/cost accounting.
- Non-zero exit policy for broken verdicts, judge errors, and all-error runs.

Default ladder:

```text
gpt-5.4-nano -> cheap signals and classifiers
gpt-5.4-mini -> bulk per-scenario judging
gpt-5.4 -> quality spot checks
gpt-5.5 -> final adjudication or hard disputes
```

### Secrets Harness

The secrets module owns:

- SOPS environment setup.
- Dotenv parsing and serialization.
- Manifest validation.
- No-value logging.
- Redacted subprocess errors.
- Per-key remote sync summaries.

Remote sync should report:

```text
planned: KEY_A, KEY_B, KEY_C
pushed: KEY_A, KEY_B
failed: KEY_C
```

It must never reflect raw third-party CLI stderr if that stderr could contain
the secret value supplied over stdin.

## Evidence Policy

`lsops` must encode the repo's evidence discipline:

- Static/unit checks are scaffolding, not behavior proof.
- Route, planner, validator, lab API, demo, and stakeholder behavior claims
  require full integration evidence.
- Failed setup is not a skipped behavior claim.
- Broken judge verdicts are failures unless the command explicitly runs in
  measurement-only mode.
- Measurement-only commands must name themselves as such in output and
  artifacts.
- Raw traces, transcripts, decrypted secrets, and private run dumps are never
  published by report commands.

## Migration Plan

### Phase 1: Foundation

- Add `packages/lsops`.
- Add `lsops` binary entrypoint.
- Implement `CheckRun`, `ArtifactWriter`, `JsonClient`, and
  `launchProofBrowser`.
- Add focused unit tests for exit policy, redaction, JSON parsing, and browser
  launch configuration.

### Phase 2: Fix Highest-Risk Scripts

Convert:

- `concierge-probes.mjs`
- `concierge-probes-judge.mjs`
- `ux-evaluator-probe.mjs`
- `seam-walk-proof.mjs`
- `contact-assistant-ux-proof.mjs`

Acceptance:

- Failed endpoints exit non-zero.
- Judge `broke` verdicts exit non-zero unless `--measurement-only` is passed.
- All-error evaluator runs exit non-zero.
- Browser launch uses the shared resolver.
- `just contact-assistant-proof` and `just seam-walk-proof` still work.

### Phase 3: Convert Browser Proof Families

Convert:

- `dc*` proof scripts.
- `dc2-*` proof scripts.
- `dr*` proof scripts.
- `concierge-nav-proof`.
- `concierge-journey-memory-proof`.
- `concierge-rehearsal`.

Acceptance:

- Scenario bodies are declarative and small.
- Shared harness owns screenshots and final result reports.
- Retired one-shot scripts are either compatibility shims or moved to a
  historical folder with receipts linked.

### Phase 4: Reports, Parity, and Deploy Packaging

Convert:

- `build-reports`.
- `site-parity-harness`.
- `contact-chat-parity`.
- `site-nuxt-deploy-pack`.

Acceptance:

- Report generation remains deterministic.
- Pixel-diff artifacts remain compatible with existing review workflows.
- Deploy packaging still refuses stale reports/build output.

### Phase 5: Infra and Gates

Convert or wrap:

- `secrets`.
- `campaign-consistency-check`.
- `branch-risk`.
- `gate-slice`.
- `floor-delta`.
- `digest`.
- `source-policy`.

Acceptance:

- Existing `just` targets still work.
- Secret values are never printed.
- Gate behavior remains equivalent unless a migration deliberately tightens a
  false-green path.

## Acceptance Criteria

- `npm run verify` remains green after each migrated slice.
- `npm --workspace @loanslam/lsops run typecheck` is part of root typecheck.
- `just --list` remains the human operator index.
- No active `just` target calls a long-lived one-off `.mjs` implementation
  once its `lsops` equivalent exists.
- All active proof and probe commands produce a structured JSON summary.
- Every command has documented exit-code semantics.
- The package has tests for the shared failure-prone machinery.

## Naming Decision

Use `lsops`, not `loanslam-ops`.

Rationale:

- Short enough for frequent operator use.
- Still clearly Loanslam-specific.
- Avoids long command names in `just` wrappers and CI logs.
- Leaves room for package names like `@loanslam/lsops` without duplicating the
  project name in the binary.

## Open Questions

- Should retired one-shot campaign scripts move to `docs/non-operational/` as
  historical references, or should they remain as executable shims until the
  related roadmap receipts are closed?
- Should `lsops proof run` support CI browser install bootstrap, or require
  Playwright browsers to be preinstalled?
- Should measurement-only probe runs default to exit zero when findings exist,
  or require an explicit `--allow-findings` flag?
- Should report rendering stay custom and narrow, or adopt a maintained
  markdown renderer with a locked sanitizer configuration?
