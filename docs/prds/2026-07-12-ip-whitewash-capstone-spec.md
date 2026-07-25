# IP Whitewash Strategy: LoanSlam Portfolio Capstone

Date: 2026-07-12
Status: draft (strategy only; no execution yet)
Driver: `~/fluency-protocol/reference/market-jump-focus-2026-07.md` item 2 —
a sanitised, own-IP-only demo asset derived from the MAL engine architecture,
serving both the Applied AI Engineer and FDE interview loops.

## Goal

Produce a publishable, IP-neutral portfolio repo from this codebase with
**zero trace of the client in content, assets, config, deployment, or git
history**. The existing repo stays intact and private as the client
deliverable (repo is withheld until signing; that posture does not change).

## Non-negotiable framing

A branch or worktree in this repo can never be the published artifact: every
branch shares the object database, and ~100+ files across 498 commits contain
client IP (scraped copy, the trademarked logo, `mal-logo.png`, MAL-named
commit messages and audit docs). The worktree is the **workbench**; the
deliverable is a **fresh-history export** (`git init` from a cleaned
snapshot). No history rewrite of this repo is needed or wanted.

## What must be removed (kill list)

Grouped by exposure type, from the 2026-07-12 survey:

1. **Brand names**: "Loans by MAL" / "loans by mal" / all casings; standalone
   "MAL"/"Mal" where it means the client (64 files for the long form, 44 for
   the short form).
2. **Legal identity** (in scraped copy, esp. `page-terms-and-conditions.json`,
   `page-privacy-policy.json`, `page-existing-customers.json`,
   `site-copy/chrome.json`): Monthly Advance Loans Limited; FCA firm
   reference 912359; ICO registration ZA553679; company number 12070468;
   registered office Bourne Park, Exeter Park Road, Bournemouth BH2 5BD.
3. **Hosts and vendor trail**: `loansbymal.co.uk`, `applyloansbymal.co.uk`,
   `apply.loansbymal.co.uk`, `monthlyadvanceloans.anchor.co.uk` (also exposes
   the Anchor Computer Systems vendor relationship). Centralised in
   `packages/site-nuxt/lib/siteRoutePolicy.ts` and `packages/core/src/policy.ts`,
   but also inlined throughout content JSON.
4. **Contact data / PII**: all `@loansbymal.co.uk` emails (support,
   customercare, complaints, enquiries, DPO); client landlines 01202 122699 /
   01202 138850; mobiles 07984 352847 / 07984 393896 (likely personal staff
   numbers — PII, highest-severity item); the Trustpilot review link.
   National helplines (0800 023 4567 FOS, 0808 808 4000, 0800 138 111) are
   generic and may stay.
5. **Trademarked assets**: `packages/site-nuxt/public/logo.png` (the mal duck
   logo — verified visually) and `favicon.png` (verify). History also holds
   `packages/review-host/public/mal-logo.png`.
6. **Site/FAQ copy — substitute, do not regenerate** (operator decision
   2026-07-12): `packages/site-nuxt/data/content/*.json`,
   `data/site-copy/*.json`, `data/faq-qa.json`, `data/instalment-qa.json`
   stay semantically intact to preserve classifier/routing tuning. Only the
   identifying tokens inside them are swapped (brand, hosts, emails, phones,
   legal identity). The bar is "not obviously recognisable as Loans by MAL",
   not zero textual lineage.
7. **Live-capture artifacts**: `site/docs/live-application-capture/` (21
   tracked DOM snapshots of the client's real application flow on the Anchor
   platform). Untracked but on disk: `site/dist/` (190M scraped mirror) and
   `site/node_modules/` — excluded from export automatically, deleted from the
   workbench for hygiene.
8. **Prompts**: `conciergePrompt.service.ts` — assistant self-identifies as
   "the MAL Loans assistant" for "Loans by MAL".
9. **Brand indirection layer**: `lib/brandText.ts`
   (`normalizeDemoBrandText`), the dual-host entries in `siteRoutePolicy.ts`,
   and their tests (`brandText.test.ts`, `sitePolicy.test.ts`,
   `siteUrls.test.ts` assert real client hosts). This layer exists only to
   inject the real brand at demo time — in the capstone it is deleted, not
   translated. Deletion is a feature: single-brand code is simpler and the
   commit story is cleaner.
10. **Docs and tooling**: `docs/demo-concierge-runbook.md`,
    `docs/roadmaps/2026-07-02-site-nuxt-roadmap.yaml` (mal-demo URLs),
    MAL-referencing PRDs, `Justfile` comments (lines ~403, ~443), untracked
    `packages/site-nuxt/DESIGN.md` / `PRODUCT.md`.
11. **Deployment names**: the `mal-demo.up.railway.app` service. Portfolio
    deploys go to **new** Railway/Vercel projects with neutral names; the
    existing client demo infra is left untouched.
12. **Secrets**: never carry `secrets/*.env.sops`, rendered `.env.*` caches,
    or sops keys into the export. The portfolio repo starts with a fresh
    `.env.example` and its own encrypted secrets if needed.

## Replacement design

- **Brand**: LoanSlam becomes the real (fictional) brand — it is already the
  internal-neutral name everywhere, so most code needs no rename. Confirm
  comfort with publishing the name (loanslam.co.uk hosts are referenced;
  either own the domain story or swap hosts to `loanslam.example`).
- **Legal boilerplate**: do NOT fabricate FCA/ICO/company numbers — a
  plausible fake FCA firm reference is its own liability. Replace with an
  explicit fiction notice: "LoanSlam is a fictional lender built as a
  technical demonstration; it is not FCA-authorised and does not lend."
  Footer keeps the *shape* of regulated-lender chrome (that shape is part of
  the regulated-industry story for interviews) with visibly fictional values.
- **Content corpus**: keep intact; substitute identifying tokens only. The
  FAQ/content corpus is the classifier's tuned input and there is no budget
  for a retune; much of it is generic or was generated as simulation in the
  first place. One global, consistent substitution map (brand → LoanSlam,
  hosts → loanslam hosts, emails/phones/address → fictional equivalents,
  legal entity → fiction notice) applied across corpus, prompts, and tests
  in a single pass, so any routing signal that keys on those tokens changes
  identically everywhere.
- **Assets**: neutral SVG logo — `packages/demo-host/public/logo.svg` is
  already a clean LoanSlam mark; reuse/extend it for site-nuxt and favicon.
- **Application-flow references**: the DOM captures are deleted; if the
  journey shape matters to the demo narrative, describe it in a short
  fictional journey spec instead.
- **Prompts**: "the LoanSlam assistant" for the LoanSlam website; drop the
  "never use Loans by MAL hostnames" instruction (no longer meaningful).

## Execution phases

**Phase 0 — decisions (operator).** (a) Portfolio scope: full-repo conversion
vs slimming to engine + demo host + one site surface. The market doc defines
done as "cloneable, runs in one command, costed, 5-minute tour" — a slimmer
repo serves that better; pruning happens naturally during export. (b) Keep
the name LoanSlam? (c) Public repo name.

**Phase 1 — workbench.** `git worktree add ../loanslam-whitewash -b
chore/ip-whitewash main`. This branch is never promoted to dev/staging/main
and never pushed to any public remote; it exists solely to produce the
snapshot. Copy required ignored context per worktree discipline; render
fresh secrets, don't copy `.env*`.

**Phase 2 — scrub.** Work the kill list: apply the substitution map across
corpus/prompts/tests in one pass; delete DOM captures, the client logo, and
the brand indirection layer + its tests; rewrite docs and Justfile comments;
collapse route policy to single-host. Expect test churn wherever tests
assert client hosts or `normalizeDemoBrandText` behavior.

**Phase 3 — verification gate.** Add `just whitewash-audit`: `rg` over the
canonical term list (below), exit non-zero on any hit, including a binary
check that no client-origin images remain. Then one confirming Hell Week
integration run — a regression check that token substitution didn't move
routing behavior, not a tuning loop. Semantics are unchanged, so a clean run
is the expected outcome; a dirty run means a substitution inconsistency, not
a retune.

**Phase 4 — fresh-history export.** From the clean workbench:
`git archive chore/ip-whitewash | tar -x -C <new-dir>` (tracked files only —
this drops `site/dist`, `node_modules`, `.env*` automatically; additionally
exclude `secrets/`, `CLAUDE.md`/`AGENTS.md` rehab-protocol content, and
internal docs that don't serve the portfolio). `git init`, single initial
commit (or a small curated sequence if a readable history is wanted for
reviewers). Fresh README written for a hiring-manager audience.

**Phase 5 — final audit on the artifact.** On a fresh clone of the new repo:
re-run the term scan including `git log -p --all`; verify `git count-objects`
history contains nothing pre-export; run the one-command demo end to end.
Only then create the remote — private first, public after the audit passes.

**Phase 6 — infra.** New Railway/Vercel projects with neutral names for the
hosted demo; no shared env, no shared domains with client infra.

## Canonical audit term list

`loansbymal`, `loans by mal`, `loans-by-mal`, `loansByMal`, `by MAL`,
`\bMAL\b` (case-sensitive, excluding false positives like "normalize"),
`Monthly Advance Loans`, `monthlyadvanceloans`, `anchor.co.uk`, `912359`,
`12070468`, `ZA553679`, `Bourne Park`, `Exeter Park Road`, `BH2 5BD`,
`01202 122699`, `01202 138850`, `07984 352847`, `07984 393896`,
`trustpilot.com/review/loansbymal`, `mal-demo`, `mal-logo`.

## Risks

- **Worktree ≠ isolation for publication.** The single most dangerous
  failure mode is pushing the whitewash branch (full client history) to a
  public remote. The export step is the isolation boundary.
- **Searchable verbatim sentences.** Token substitution leaves distinctive
  phrases intact (e.g. the contractor-lending positioning copy); anyone
  pasting a sentence into a search engine could reach the client site. This
  is accepted under the "not obviously recognisable" bar (operator decision
  2026-07-12). Optional cheap mitigation: lightly rephrase a handful of the
  most distinctive marketing sentences on non-classifier pages only.
- **Fake regulatory numbers.** Fiction notice instead; never a plausible FRN.
- **Inconsistent substitution breaks routing.** The corpus is kept intact to
  avoid a retune; the residual risk is a token swapped in the corpus but not
  in a prompt or test (or vice versa). The single-map, single-pass rule and
  the confirming Hell Week run guard this.
- **Out-of-repo references.** Career docs call it "the MAL engine"; public
  naming should be "the LoanSlam engine". CEB entries mined from loanslam
  must use sanitised naming.
