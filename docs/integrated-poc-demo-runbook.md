# Integrated POC Demo Runbook

Historical live URL: https://loanslam-ipoc-production.up.railway.app

> Status as of 2026-07-06: the standalone `loanslam-ipoc` Railway deployment is
> a decommission candidate. Do not redeploy it from this repo. Keep the
> `packages/integrated-poc` source because the Nuxt keeper surface still imports
> IPOC server modules directly.

> The apply-journey concierge demo on the Nuxt site has its own runbook:
> `docs/demo-concierge-runbook.md`.

A stakeholder can run this cold in about five minutes. Everything on screen is
synthetic demo data; nothing is a real customer record.

## The demo, step by step

1. **Open the app.** Left pane is the customer journey; right pane is the
   human agent's ticket readback.
2. **Existing-customer lookup.** Click "I'm an existing customer", leave the
   prefilled synthetic details, click "Find my demo record". The assistant
   matches demo record `LS-10001`.
   - To show the safe failure path first: change the date of birth to any
     other value — no data is disclosed and the handoff path stays open.
3. **Read-only account answers.** Click "Next payment date", "Outstanding
   balance", "Loan status". Each answer renders from the server-side mock
   record; the browser never receives the record itself.
4. **The engine boundary (the important part).** Type "What is my outstanding
   balance?" in the message box and click "Send through engine". The
   AI engine — which cannot see the mock record — does not invent an answer;
   it routes to the safe human handoff and a ticket appears.
5. **Handoff capture.** Submit the prefilled demo capture form; the intake
   fields attach to the ticket.
6. **Human agent workflow.** In the right pane: "Start review", add a note,
   "Resolve". The ticket shows status transitions, the note, and the session
   activity trail (lookup and answers).

## Talking points

- The assistant only answers account questions through the sanctioned
  read-only path after a demo identification; the engine itself always hands
  account questions to a human. This boundary is enforced and continuously
  tested (16/16 integration battery against this URL, including a live-engine
  leak check).
- Deflection first, handoff second: general questions get grounded answers;
  account-specific ones get a structured human handoff with context the agent
  can read back.

## Known limitations (deliberate demo properties)

- No auth or rate limiting on the URL (same posture as the existing demo
  site). Do not circulate the URL beyond stakeholders.
- All state is in-memory: tickets and lookups reset on redeploy or restart.
- The mock record set is two synthetic customers; postcodes, balances, and
  dates are invented.
- Answers are limited to next payment date, outstanding balance, and loan
  status (D038).

## Operations

- Local dev: `npm --workspace @loanslam/integrated-poc run dev`.
- Local build: `npm --workspace @loanslam/integrated-poc run build`.
- Historical live verification, if the service still exists before final
  decommission:
  `node scripts/ipoc-integration-battery.mjs --base https://loanslam-ipoc-production.up.railway.app`
- Final Railway service deletion requires a separate explicit destructive
  approval and a fresh inventory receipt.

## Adapter sunset plan (executable, human-gated)

Source: decision log D039 (`docs/core-product-decision-log.yaml`); the
assessment report that produced D039 is archived, not tracked.

- **Trigger:** one completed stakeholder demo run from this runbook on the
  live URL. Until then the demo-adapter stack stays frozen (no new work) but
  alive.
- **On trigger, in order:**
  1. Confirm the stakeholder demo needed nothing from the old demo surface.
  2. Retire `demo-host` and `demo-widget` together: remove the packages, the
     `loanslam-site` embed points that reference them, and any remaining
     historical deploy wiring references.
  3. Decommission or repurpose the `loanslam-site` Railway service only after
     step 2 lands and the site build is green without the demo assets.
  4. Leave `review-host`/`review-widget` untouched — separate product
     decision (D039).
- **Rollback:** the sunset lands as ordinary commits on a feature branch;
  reverting the branch restores the adapter stack. The Railway demo service
  is not deleted until the revert window has passed one promotion cycle.
- **Gate:** every step above is a human green-light; this plan authorizes
  nothing by itself.
