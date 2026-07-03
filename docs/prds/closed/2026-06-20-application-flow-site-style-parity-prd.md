# PRD: Application Flow Website Style Parity

## Problem Statement

The rebuilt website has a working local application flow, but the flow still
feels visually and structurally separate from the restored Loans by MAL website.
The application page currently mounts the Vue journey directly instead of using
the normal site shell, and its scoped styling partially recreates brand tokens,
header, footer, cards, buttons, and form surfaces.

The next implementation slice should bring the application flow into style
parity with the pre-existing website without breaking the working offline
journey. It should also verify that all customer-facing website links resolve to
the right local rebuilt-site route or the correct intentional external target.

## Solution

Restyle the application journey as a first-class part of the restored website.
Keep the existing Vue application-flow behaviour, copy, validation, and static
offline constraint, but align its frame, spacing, typography, actions, footer,
and form surfaces with the Astro website design system.

Use the current restored site as the visual source of truth: shared tokens,
button classes, site typography, header/footer conventions, amber primary CTAs,
teal/ink/sand palette, page rhythm, and responsive behaviour. Use the live
application capture as behavioural and content reference, not as the visual
target if it conflicts with the restored site.

## User Stories

1. As a customer, I want the application journey to feel like part of the same
   Loans by MAL website, so that the transition from marketing page to apply
   flow feels trustworthy.
2. As a customer, I want application forms to be readable and calm on mobile, so
   that I can complete the journey without fighting dense fields.
3. As a customer, I want the Apply and Continue actions to use the same visual
   priority as the rest of the site, so that the primary path is obvious.
4. As a customer, I want footer and policy links in the application flow to work,
   so that compliance and support pages remain reachable.
5. As a maintainer, I want the application flow to reuse site-level design
   primitives where practical, so that future site polish does not fork across
   two styling systems.
6. As a maintainer, I want the offline application prototype behaviour preserved,
   so that style work does not introduce production API calls.
7. As a reviewer, I want website links checked against generated routes, so that
   restored content links do not silently point at missing local pages.
8. As an existing customer, I want account login entry to remain inside the
   rebuilt site shell, so that I do not leave the local prototype unexpectedly.

## Implementation Decisions

- Keep the application flow as a Vue island inside the Astro site.
- Preserve the current route sequence and copy unless a link or obvious typo fix
  is required for parity or correctness.
- Prefer using the shared site shell, tokens, button classes, typography, and
  footer/header conventions over duplicating scoped application-only styles.
- If the full marketing header is too heavy for the application flow, use a
  simplified application header that still inherits the same brand tokens,
  logo treatment, spacing, and responsive polish.
- Keep the application footer legally complete and visually aligned with the
  site footer. Avoid maintaining a separate footer language unless necessary.
- Treat `site/docs/live-application-capture/` as the reference for application
  journey sequence, fields, copy, and offline limitations.
- Treat the restored Astro website pages and global CSS as the visual reference.
- Verify links through the generated route set, not only by checking physical
  files, because content pages are rendered by the catch-all route.
- Internal links should prefer local rebuilt-site paths when a matching route
  exists. External links should remain external only when they intentionally
- Existing-customer login links should resolve to a local `/login/` route. The
  login form should be visually present but inert, with no live authentication,
  form submission, or Anchor-platform call.
- External links should remain external only when they intentionally leave the
  rebuilt site, such as Trustpilot, Open Banking, GoCardless, debt-advice,
  regulator, credit-reference, or social links.
- Do not call production proposal, payment-card, bank-account, or Open Banking
  APIs from the local application prototype.

## Testing Decisions

- Run the site build as the first correctness gate.
- Smoke the `/apply/` journey manually through at least the first, middle, and
  final states after styling changes.
- Check desktop and mobile screenshots for `/`, `/instalment-loan/`, `/apply/`,
  `/faq/`, and `/contact/`.
- Verify the application flow has no broken layout at narrow mobile widths,
  especially progress navigation, paired fields, footer links, modals, and action
  buttons.
- Audit links from site header, footer, application footer, application body,
  restored content pages, and side CTAs.
- Verify `/login/` renders inside the shared site shell and that its login
  buttons do not navigate, submit, or make external requests.
- For internal links, compare against Astro physical routes plus content-driven
  routes generated from scraped content data.
- For external links, check that they are intentionally external and use the
  correct canonical destination.

## Acceptance Criteria

- `/apply/` looks visually related to the restored website, not like a separate
  Bootstrap-era application.
- Existing application-flow behaviour still works locally and remains offline.
- Primary and secondary actions follow restored-site button treatment.
- Form controls, cards, panels, progress UI, modal, and footer use the restored
  site’s rhythm, typography, colors, and responsive constraints.
- All customer-facing internal website links resolve to generated local routes.
- Header, footer, and restored existing-customer login links resolve to
  `/login/`, not `https://monthlyadvanceloans.anchor.co.uk/Login`.
- `/login/` renders a site-aligned existing-customer login surface whose actual
  login controls are inert.
- External links are deliberate and documented by category.
- The site builds successfully.
- No source outside the website/application-flow surface is changed unless a tiny
  link or command-surface adjustment is required.

## Out of Scope

- Real loan submission, payment-card, bank-account, Open Banking, or production
  API integration.
- Real account authentication, password reset, account dashboards, or
  Anchor-platform integration.
- Changing the lending decision engine or widget runtime.
- Redesigning the restored marketing website.
- Rewriting the application journey into a multi-route backend app.
- Replacing validated application copy merely for taste.

## Further Notes

Current starting observations:

- The application page mounts the Vue journey directly and does not use the
  shared site layout.
- The restored website uses Bricolage Grotesque, Plus Jakarta Sans, ink/teal/sand
  tokens, amber apply CTAs, and shared header/footer components.
- Content pages are generated from scraped content through the catch-all route,
  so link checking must include both physical Astro pages and content records.
- The prior website/widget architecture decision recommends keeping the site as
  the stable host and embedding interactive product surfaces through narrow
  islands rather than turning the whole site into the volatile app runtime.
