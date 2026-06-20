# PRD: Website Copy Configuration

## Status

Unchecked handoff PRD. This document prepares the implementation slice but does
not verify or implement it.

## Problem Statement

The restored website now mixes two content models. Scraped pages and posts live
in JSON and are rendered into HTML at build or serve time, but bespoke website
surfaces still hardcode customer-facing copy directly inside Astro and Vue
components. That makes copy changes risky, hides product language inside layout
code, and makes it harder to audit what the website actually says.

The next slice should replace hardcoded website copy with a config-driven
approach. The source of customer-facing website copy should be JSON or equivalent
structured content data. Astro/Vue should render that data into HTML at build or
serve time.

## Solution

Introduce a website-copy configuration layer for the `site` app and migrate
visible website copy out of templates/components into structured JSON.

The implementation should keep the existing visual design and page behaviour,
but move copy into a coherent content/config surface. Rendered HTML should still
be built by Astro or Vue during normal `dev` and `build` flows. The site should
not require runtime CMS infrastructure for this slice.

This scope is website-only. Do not migrate chat widget copy, review widget copy,
lab UI copy, engine messages, or package demo copy as part of this work.

## User Stories

1. As a maintainer, I want website copy in JSON/config, so that copy changes do
   not require editing layout code.
2. As a reviewer, I want one obvious place to audit website language, so that
   stale or non-compliant claims are easier to find.
3. As a developer, I want Astro pages to render structured content, so that the
   site remains statically buildable.
4. As a developer, I want navigation and footer labels in config, so that shared
   chrome is not duplicated across components.
5. As a developer, I want page-specific bespoke content in config, so that home,
   contact, FAQ, news index, instalment loan, 404, and apply surfaces can be
   changed without hunting through templates.
6. As a product owner, I want customer-facing legal and lending copy to be
   reviewable as content, so that the wording can be checked without reading UI
   implementation.
7. As a future agent, I want copy and rendering separated, so that style work
   does not accidentally rewrite product language.

## Implementation Decisions

- Scope this to the `site` app only.
- Exclude chat widgets and non-website surfaces: demo widget, review widget,
  review host, lab UI, core engine, contracts, MCP, and evidence tooling.
- Treat `site/src/data/content/*.json` as prior art for config-driven content.
- Add or extend structured site data for bespoke surfaces that are currently
  hardcoded in templates/components.
- Keep routing, styling, class names, and behaviour stable unless the copy
  extraction exposes a small bug.
- Prefer typed content loaders/helpers over ad hoc JSON imports scattered across
  pages.
- Preserve existing rendered HTML semantics where possible: headings remain
  headings, lists remain lists, links remain links.
- Allow trusted static HTML only where the existing content model already uses
  HTML strings or where rich prose genuinely needs it.
- Prefer structured fields for repeated UI sections: navigation items, footer
  columns, legal paragraphs, hero blocks, CTAs, eligibility cards, process steps,
  contact channels, FAQ group headings, side CTAs, 404 copy, and news index copy.
- Keep customer-facing application-flow copy in scope if it lives under the
  `site` app; keep chat-widget copy out of scope.
- Do not introduce a remote CMS in this slice.

## Typed Copy Contract

Typed copy is appropriate for this slice, but the types should describe the
shape of the copy configuration rather than the prose itself.

- Use small shared TypeScript types for repeated structures such as links, CTAs,
  hero blocks, footer columns, navigation items, contact channels, legal
  notices, FAQ groups, and process steps.
- Use page-level types for page-specific config such as home, contact, FAQ,
  news index, instalment loan, 404, and apply-surface copy.
- Validate JSON at the loader boundary. TypeScript interfaces alone are not
  enough for imported JSON because malformed content should fail loudly during
  `dev` or `build`.
- Prefer the repo's existing validation pattern if one exists. If not, keep the
  validation lightweight and local to the site content loader.
- Avoid one giant `WebsiteCopy` type unless the implementation genuinely uses a
  single site-wide config file.
- Do not type every literal phrase, enum every heading, or make normal
  copywriting changes require type changes.

The goal is a typed content contract that catches missing URLs, missing required
sections, malformed repeated content, and unsafe rich text boundaries. The goal
is not ceremonial over-typing.

## Suggested Migration Targets

- Site chrome: header navigation, action labels, footer columns, footer legal
  copy, footer policy links, brand microcopy.
- Home page: hero text, CTAs, quote card labels, representative example,
  eligibility, steps, trust ticker, stats, review quote, news section copy.
- Contact page: hero copy, channel labels, support notes, debt-advice notice.
- Instalment loan page: intro, process steps, CTA copy, FAQ link copy.
- FAQ page: page header copy, group headings, CTA copy.
- News index and article side CTAs.
- 404 page copy.
- Apply page metadata and application-flow customer copy if treated as part of
  the website application surface.

## Testing Decisions

- Build the site after migration.
- Compare generated pages before and after for visible copy parity on core
  routes.
- Smoke at least `/`, `/instalment-loan/`, `/contact/`, `/faq/`, `/news/`,
  `/apply/`, and a catch-all content page.
- Verify link rewriting still works for scraped content pages.
- Verify rich HTML content still renders safely and predictably.
- Verify no widget packages were changed unless a shared type/helper was
  intentionally introduced and justified.
- Search the `site` app after migration for remaining hardcoded customer-facing
  phrases and document any intentional exceptions.

## Acceptance Criteria

- Website copy for bespoke site surfaces is loaded from JSON/config rather than
  hardcoded inline in Astro/Vue templates.
- Existing scraped JSON content rendering still works.
- The site builds successfully.
- Core website routes render the same customer-facing content unless a deliberate
  copy correction is documented.
- Header/footer/navigation/legal copy comes from config.
- Chat widget and review widget copy remain untouched.
- The content/config shape is typed or validated enough that missing required
  fields fail loudly during build/dev.
- The implementation uses small shared and page-level TypeScript types for copy
  config shape, plus runtime validation where JSON enters the rendering layer.
- Remaining inline copy is limited to non-customer UI mechanics, accessibility
  fallbacks, or documented exceptions.

## Out of Scope

- Migrating chat widget, review widget, lab UI, core engine, demo host, review
  host, or evidence tooling copy.
- Adding a remote CMS or editor workflow.
- Rewriting website design.
- Changing lending claims, rates, contact details, or legal wording for product
  reasons.
- Refactoring the engine or widget message model.

## Further Notes

Current starting observations:

- The site already imports scraped page/post records from
  `site/src/data/content/*.json`.
- `site/src/lib/content.ts` is the current build-time content loader and link
  rewriting surface.
- Header, footer, home, contact, FAQ, news, 404, instalment-loan, apply metadata,
  and the local application journey still contain hardcoded visible copy.
- `packages/*widget`, `packages/review-host`, `packages/demo-host`, and
  `packages/lab-ui` are not part of this request.
