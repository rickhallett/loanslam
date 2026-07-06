# PRD: Site and Chat Widget Integration Architecture

> **Historical record.** This PRD is no longer active architecture guidance.
> D012-D016 in `docs/core-product-decision-log.yaml` supersede it: the
> Integrated POC becomes the next deployable surface, and the widget-adapter
> architecture remains transitional code due for sunset.

## Problem Statement

The project needs to bring a redesigned website and the chat-widget prototype
together without damaging either surface. The current branch implementation of
the website is poor enough that the visible site should be restored from the
known-good redesign before further product work continues.

At the same time, the chat widget is not just a standalone support bot. The
long-term product direction is a journey-aware assistant that can appear across
the customer website, understand where the customer is in the journey, remember
recent page-level context, and help move the customer into relevant next steps
such as application sections or future loan forms.

The architectural tension is that the bot needs to stay fast and lean during
rapid iteration, while the customer experience will eventually require tight UX
integration with the website. The current WordPress website also imposes a hard
iframe deployment requirement, even though the future rebuilt website does not.

## Solution

Use one chat-widget core with multiple host adapters.

The widget should be designed as a portable journey-aware component that speaks
to a small host contract. The current WordPress site can embed it through an
iframe adapter. The future rebuilt website can mount it natively as a Vue island
or equivalent interactive island inside the site shell.

The website should remain the stable host for customer-facing content and page
structure. The bot should own conversation UX, local widget state, and chat
runtime interaction, but should not force the whole website to become a
full-stack app unless the broader customer journey genuinely becomes an app-like
experience.

The host/widget contract should cover page context, recent customer journey
context, host-triggered configuration, widget-triggered navigation requests,
analytics events, and future journey actions. Iframe messaging is a transport
implementation for WordPress, not the widget's core architecture.

## User Stories

1. As a customer, I want the assistant to be available from any relevant website
   page, so that I can ask for help without leaving my current journey.
2. As a customer, I want the assistant to understand which page I am on, so that
   I do not need to restate obvious context.
3. As a customer, I want the assistant to account for pages I recently viewed,
   so that support feels connected to my actual journey.
4. As a customer, I want the assistant to guide me to the right section of the
   website, so that I can continue instead of reading generic instructions.
5. As a customer, I want the assistant to help me reach future application
   sections, so that chat can become part of the application journey rather than
   a separate support channel.
6. As a customer on the current WordPress website, I want the assistant to work
   without being broken by WordPress styling or scripts, so that the prototype
   can be deployed safely before the new website exists.
7. As a stakeholder, I want the rebuilt website to preserve the known-good
   design and copy first, so that integration work does not accidentally redesign
   the product surface.
8. As a developer, I want the chat widget to iterate quickly, so that prompt,
   retrieval, handoff, and conversation-state changes can be tested without
   rebuilding the whole website architecture.
9. As a developer, I want a native integration path for the future website, so
   that the final customer journey is not constrained by iframe limitations.
10. As a developer, I want iframe deployment to remain available for WordPress,
    so that the current website can host the prototype with strong isolation.
11. As a developer, I want one shared widget core, so that WordPress iframe
    deployment and native new-site deployment do not fork product behavior.
12. As a developer, I want a small host contract, so that page awareness and
    journey actions are explicit rather than hidden DOM coupling.
13. As a developer, I want host adapters to own transport details, so that the
    widget core does not become iframe-specific.
14. As a developer, I want the future website to mount the widget directly where
    appropriate, so that page context, theme, routing, and UX actions are simpler.
15. As an operator, I want analytics events from both iframe and native embeds,
    so that prototype evidence can be compared across hosts.
16. As a maintainer, I want the marketing site and bot runtime to have clear
    ownership boundaries, so that changes to one do not unexpectedly break the
    other.
17. As a maintainer, I want the architecture to support separate deployable
    surfaces where useful, so that the website and product app are not forced to
    release together before that is necessary.
18. As a maintainer, I want the option of a monorepo with separate apps, so that
    shared contracts and tooling are possible without collapsing boundaries.
19. As a maintainer, I want to avoid making the full website a Vue app solely for
    the widget, so that the volatile prototype does not dominate the site stack.
20. As a reviewer, I want the host/widget boundary documented, so that future
    implementation decisions can be judged against the intended integration model.

## Implementation Decisions

- Restore the visible website from the known-good redesign before making further
  website design or copy changes.
- Treat the known-good redesign as the website source of truth for the initial
  restoration.
- Prefer a surgical wholesale transplant of visible website files over broad
  repo reset, preserving unrelated project work and infrastructure unless it is
  required for the site to run.
- Keep the marketing website and product/chat surfaces as separately understood
  boundaries.
- Prefer either separate builds or a monorepo with separate apps over a single
  tightly coupled app unless the product journey demands shared runtime state.
- Use Astro or a similar content-first site shell for the rebuilt website unless
  the broader customer journey becomes app-like enough to justify a full-stack
  Vue framework.
- Use a Vue island or bundled widget for native integration on the future
  rebuilt website.
- Use an iframe adapter for the current WordPress deployment because WordPress
  isolation is a hard requirement.
- Do not treat iframe as the core widget architecture.
- Build the widget core against a host API abstraction.
- Implement WordPress iframe integration through a parent-page embed script,
  iframe creation, and structured cross-window messages.
- Implement new-site integration through direct mounting, props, shared stores,
  or direct host adapter functions.
- Keep the shared host contract small and explicit.
- Host-to-widget context should include current path, page type, recent pages,
  visible section when available, and optional intent hints.
- Widget-to-host commands should include navigation, scrolling, opening future
  application steps, and analytics events.
- Theme, sizing, session, and analytics concerns should be part of the adapter
  contract rather than ad hoc widget behavior.
- Iframe transport should validate message origin and message shape.
- The future native adapter should avoid requiring the widget to query arbitrary
  DOM state from the page.
- The bot prototype may remain separately deployable while core behavior is
  volatile, but realistic UX evidence requires embedding it in the real website
  context.

## Testing Decisions

- Test the widget core through the host API abstraction rather than through a
  specific transport implementation.
- Test the WordPress iframe adapter for message validation, context transfer,
  command handling, resize behavior, and analytics event forwarding.
- Test the native new-site adapter for context updates, navigation commands,
  theme/config propagation, and route or section awareness.
- Use integration tests or browser checks to prove the widget can appear across
  representative pages without visual breakage.
- Avoid tests that assert implementation details of the underlying framework.
  Good tests should assert customer-visible behavior and host/widget contract
  behavior.
- Include manual visual verification for the restored website to ensure copy and
  design match the known-good redesign before further changes are made.
- For iframe deployment, test at least one non-localhost browser path because
  iframe, cookie, and cross-origin behavior can differ from local development.

## Out of Scope

- Redesigning website copy or visual design during the restoration pass.
- Reworking the chat model, prompt, retrieval, or handoff policy as part of this
  architecture decision.
- Building future loan application forms in this slice.
- Migrating the current WordPress website itself.
- Committing to a full-stack Vue website before the broader journey requirements
  justify it.
- Making the iframe integration the only long-term integration model.
- Sharing every component between website and widget.
- Solving production authentication, persistence, or compliance data handling in
  this PRD.

## Further Notes

The useful distinction is core versus adapter. The core widget should understand
conversation, journey context, and host capabilities. The adapter should decide
how those capabilities cross the boundary for a specific host.

Iframe is the right answer for the current WordPress deployment because it buys
isolation. Native mounting is the better answer for the rebuilt website because
the target experience depends on page awareness and journey-level UX integration.

The next architectural decision is whether the restored website and the widget
live as separate deployable builds or as separate apps inside one monorepo. The
default recommendation is a monorepo with separate apps if this repository is
becoming the long-term product home, and separate builds if the immediate goal is
the lowest-risk recovery of the website surface.
