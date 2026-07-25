# PRD: Contact Page Review Widget Parity

## Status

Unchecked handoff PRD. This document prepares the implementation slice but does
not verify or implement it.

## Problem Statement

The restored website contact page is currently a static styled contact page.
The existing review demo has a better interaction model for the same customer
problem: a floating assistant, a vertical set of contact routes, a frost effect
over the page while the widget is open, context-aware contact highlighting after
the widget closes, and an opt-in engine diagram for reviewers.

The website should get that interaction model without inheriting the review
mock's prototype styling. The customer-facing page must remain a Loans by MAL
website page, not a LoanSlam review mock.

## Solution

Update the website contact page so it behaves like the review demo, but uses the
restored website's visual language.

The contact routes should be presented vertically, matching the review mock's
layout shape: new-loan support, repayment difficulty/vulnerability support, and
existing-loan update or settlement support. The page should keep the real Loans
by MAL phone, SMS, and email details already used by the website contact page.

Embed or adapt the existing review widget presentation so the assistant can open
from the contact page, frost the page background while expanded, and preserve the
same host/widget protocol. When the query string includes `devtools=true`, show
the same engine decision diagram used by the review demo, styled or positioned
so it belongs on the website page. Without that query param, no engine diagram
should appear.

## User Stories

1. As a customer, I want the contact options to be stacked vertically, so that I
   can scan the right number without comparing three equal cards.
2. As a customer taking out a new loan, I want the new-loan support number,
   text, and email to be obvious, so that I do not contact the wrong team.
3. As a customer struggling with repayments, I want the support route to stand
   out when the assistant points me there, so that I can get help quickly.
4. As an existing customer, I want settlement and detail-update contact routes
   clearly separated from new-loan support, so that I reach the right team.
5. As a customer using the assistant, I want the page behind the widget to frost
   while the widget is expanded, so that focus stays on the conversation.
6. As a customer closing the assistant, I want the relevant contact block to be
   highlighted, so that I can act on the assistant's recommendation.
7. As a reviewer, I want `devtools=true` to show the engine decision diagram, so
   that I can see how the assistant routed the conversation.
8. As a reviewer, I want devtools off by default, so that the customer-style page
   remains clean in normal demos.
9. As a maintainer, I want the contact-page behaviour to reuse the review
   widget protocol where possible, so that demo behaviour does not fork.
10. As a maintainer, I want the page styled with restored website tokens, so
    that the review mock does not visually leak into the public site.

## Implementation Decisions

- Treat the review demo as the behavioural reference, not the visual reference.
- Treat the restored website as the visual reference: site header, footer,
  typography, ink/teal/sand/amber palette, button treatment, spacing, card
  radius, and responsive rhythm.
- Preserve the current website contact details unless a product owner explicitly
  corrects them.
- Keep the three contact route categories aligned with the review host protocol:
  general/new loan, vulnerability or repayment difficulty, and existing-loan
  handoff/update/settlement.
- Keep the assistant protocol content-free across the host boundary. Host
  messages may carry coarse route context and engine decision telemetry, but not
  customer message text, assistant prose, or PII.
- Keep the frost overlay active only while the widget panel is open.
- Apply contact-block highlighting only after the widget closes, matching the
  review demo's focus model.
- Gate the engine diagram strictly on `devtools=true`.
- Avoid changing the core engine, review widget behaviour, or contact routing
  semantics unless required to mount the existing behaviour on the website page.
- Prefer extracting or reusing small host-side behaviour instead of copying a
  second divergent loader and devtools implementation.

## Testing Decisions

- Build the website after implementation.
- Run the review demo or inspect the existing review host to compare behaviour
  before changing the website page.
- Verify the website contact page with no query params: no devtools panel, page
  uses website styling, assistant opens, frost appears, frost click closes.
- Verify the website contact page with `devtools=true`: engine diagram appears
  and updates from widget telemetry.
- Verify the widget still opens automatically when ready only if that remains
  the intended review-widget behaviour; otherwise document any deliberate change.
- Verify a general support turn, repayment difficulty turn, and account-specific
  handoff turn promote the matching vertical contact block after close.
- Verify desktop and mobile layouts for contact routes, widget panel, launcher,
  frost overlay, and engine diagram.
- Verify keyboard/focus basics: launcher focus state, close action, and no
  inaccessible hidden panel trap.

## Acceptance Criteria

- The website contact page presents contact numbers in a vertical route layout.
- The page keeps Loans by MAL website styling rather than review mock styling.
- The assistant widget presentation works on the website contact page with the
  same host/widget protocol as the review demo.
- Opening the widget frosts the page background; closing removes the frost.
- After the widget identifies a contact route and closes, the matching contact
  block is promoted while the others are de-emphasised.
- `devtools=true` overlays the same engine decision diagram used by the review
  demo.
- Without `devtools=true`, the engine diagram is absent.
- Existing customer-facing contact functionality remains otherwise identical:
  phone links, SMS links, email links, and support copy still work.
- No core engine routing behaviour changes are introduced in this slice.

## Out of Scope

- Changing contact numbers or support email addresses.
- Redesigning the whole website contact page beyond this interaction pattern.
- Changing the review widget conversation UI or engine API.
- Adding production chat persistence beyond the existing demo-safe flow.
- Turning the website into a full app runtime.

## Further Notes

Current starting observations:

- `just review` starts the engine on 8788, the review widget on 5175, and the
  review host/contact page on 5181.
- The current website contact page already has the real vertical data model
  available as three channel entries, but renders them as a three-column card
  grid.
- The review host has the desired vertical contact route layout and uses
  `data-type` values for `new-loan`, `vulnerability`, and `update-settle`.
- The review host loader owns the floating launcher, iframe panel, frost
  backdrop, context reveal, close-on-frost-click, and content-free postMessage
  protocol.
- The review host devtools script self-gates on `devtools=true` and renders the
  engine decision state machine from content-free turn telemetry.
