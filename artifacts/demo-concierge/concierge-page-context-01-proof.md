# Concierge Page Context 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge-page-context-01 / Arc:
  concierge2-arc-001 / Campaign: demo-concierge-002 (D046)

## Change

Concierge serves every route except /contact/ (the validated engine keeps
the support chat). Each concierge turn carries a DOM-derived page snapshot
(route, title, up to 12 h1/h2 headings, 1200-char main-text excerpt) via
`lib/pageSnapshot.ts`; /apply/ additionally keeps the form snapshot. System
prompt generalized to a site guide, with account-specific matters explicitly
deferred to the support team.

## Proof

`scripts/dc2-002-page-context-proof.mjs`, live model: 3/3
(`artifacts/demo-concierge/dc2-002-page-context/`).

- /faq/: "What page am I on?" -> names the FAQ page and what it covers.
- /instalment-loan/: one-sentence summary names the product and terms from
  the page (`instalment-page-aware.png`).
- /contact/: "What is my outstanding balance?" -> engine intake form (the
  validated path still owns the support chat).
- `just verify` exit 0 (recorded at slice commit).
