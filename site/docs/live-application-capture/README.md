# Apply Loans By MAL Journey Capture

Captured from `https://applyloansbymal.co.uk/step-one/step-one.html` on 2026-06-20 with Chrome DevTools MCP.

## Capture Summary

- `dom/*.snapshot.txt` contains browser accessibility-tree snapshots.
- `dom/*.dom.json` contains extracted headings, controls, visible text, options, and current values.
- `retention-2026-07-06.md` records the raw source and screenshot files that
  were removed from the git index.

Raw downloaded HTML/JavaScript and screenshot receipts are local-only capture
artifacts. They are ignored by git and should not be used as the source of truth
for the application flow.

## Route Map

The live scripts show this route sequence:

1. `step-one/step-one.html` - applicant details, income, employment, postcode/address lookup, information-use consent.
2. `step-two/step-two.html` - approved borrowing amount, requested loan amount, loan term, repayment date.
3. `step-three/step-three.html` - loan offer review: advance, monthly repayment, repayments, total costs, interest, APR.
4. `step-six/step-six.html` - read and sign four required documents, including the loan agreement.
5. `step-four/step-four.html` - bank account and Direct Debit authorisation.
6. `step-seven/step-seven.html` - affordability check: purpose, dependants, household contribution questions, future-affordability confirmation.
7. `step-five/step-five.html` - debit card backup payment method.
8. `step-eight/step-eight.html` - Open Banking explainer and consent handoff.
9. `step-eight/open-banking.html` - completed application / verify account screen.

Most backend updates can redirect to `application-declined/application-declined.html`.

## Live Browser Notes

- Step one was filled with fake capture values only.
- The postcode lookup uses Addressy. `SW1A 1AA` opened a "Select Address" modal with options such as "Buckingham Palace, London SW1A 1AA".
- Selecting the first Addressy option populated city but left Address Line 1 empty in the captured session, so Address Line 1 was filled manually as "Buckingham Palace".
- Submitting the fake applicant redirected to `application-declined/application-declined.html`.
- Direct route loading allowed browser capture for steps two, three, four, six, seven, eight, and open banking.
- `step-five` redirected back to step one when loaded directly. Its raw source
  capture was removed from git; treat the absence of a DOM/screenshot receipt as
  a capture limitation.
- Several direct-route captures include backend/session artefacts, for example zero loan figures or `30th December 1899` repayment dates. Treat those as capture limitations, not intended customer copy.

## Implementation Rule

The local Vue SPA mirrors the journey and copy but must not call production proposal, payment-card, bank-account, or Open Banking APIs. It is an offline/static customer-journey prototype.

## Local SPA Verification

Local SPA screenshots are no longer committed here. Regenerate local visual
receipts from the current `packages/site-nuxt` surface when a site slice needs
them.
