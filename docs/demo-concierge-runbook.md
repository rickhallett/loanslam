# Demo Concierge Runbook

Live URL: https://mal-demo.up.railway.app/contact/

The apply-journey concierge demo (campaign demo-concierge-001, D045). A
stakeholder can run this cold in about four minutes. Everything entered is
synthetic test data on a prototype site.

## The demo, step by step

1. **Open /contact/.** The page now starts with the assistant route finder.
   Click **Start with the assistant** to open the chat panel. This starts in
   the existing validated support chat (grounded answers, safe handoffs); the
   topic buttons on the page only prime the conversation and must not jump
   straight to contact capture.
2. **Ask an apply question.** Type "How do I apply for a loan?" The grounded
   FAQ answer arrives with a quick action: **Take me to the application**.
3. **Click it.** The site navigates to the application form; the chat stays
   open with the conversation intact and introduces the form.
4. **Fill a couple of fields** — monthly income, first name — then ask the
   chat: "What have I filled in so far?" It answers from the live form state
   (step, entered values, what's still blank). Ask about any field ("What
   does the employment status field want?") for situational help. This is
   the frontier-model concierge: full intelligence, house voice.
5. **The graceful exit.** Say "This is getting difficult — can I talk to a
   person?" The concierge offers the support team with a quick action;
   clicking it routes back through the validated engine, which serves the
   standard intake form and captures a ticket — the same proven handoff
   machinery as the support chat.

Rehearse before the demo (the exact choreography above, headless):

    node scripts/concierge-rehearsal.mjs

6/6 beats green against the live URL is the go signal.

## Talking points

- One assistant across the whole journey: deflection and safe handoffs on
  the support side, full-intelligence form help on the apply side, and every
  transition is a visible, deliberate seam.
- The contact page is assistant-first, but it is still the validated engine
  surface. It can answer grounded support questions and route safely; it does
  not receive the DOM/page snapshot that concierge mode receives.
- The concierge sees the form as the customer fills it — answers name the
  step, the entered values, and what's left.
- The validated engine still owns anything account-shaped: account questions
  and the difficulty path always land in the human handoff with a ticket.

## Scope and honest limits (D045)

- The concierge is a demo-only surface: no validator or grounding rule; its
  guardrails are a system-prompt no-promises instruction plus voice. It is
  deliberately not compliance-hardened — that is a recorded, temporary
  decision with a named revert path, not an oversight.
- Exposure controls, not content controls: per-IP rate limits (40 sessions /
  120 messages per 5 minutes — sized for up to four stakeholders sharing one
  venue IP; override with `CONCIERGE_RATE_SESSIONS` / `CONCIERGE_RATE_MESSAGES`
  service variables) and a kill switch.
- Sessions are in-memory server-side, but a redeploy no longer shows: the
  widget reseeds a fresh session from its own transcript and continues
  (demo-resilience-001, proven live with a mid-conversation redeploy).
  Replies stream into the panel as they generate.
- Do not circulate the URL beyond stakeholders.

## Operations

- Kill switch (instant off, support chat unaffected): set
  `CONCIERGE_KILL_SWITCH=1` on the `loanslam-site-nuxt` service variables and
  redeploy; set back to `0` to restore. Proven live 2026-07-02.
- Redeploy: `npm run site-nuxt-build && node scripts/site-nuxt-deploy-pack.mjs`,
  then copy the `.railway-pack` contents to a directory OUTSIDE the repo and
  from there: `railway up --ci -p <project-id> -s loanslam-site-nuxt
  -e production`. (Since 2026-07-02 the Railway CLI walks up to the git root
  when run inside a repo, uploading the whole workspace instead of the pack;
  running from outside the repo with explicit flags avoids it.)
- Model: `gpt-5.5` (`CONCIERGE_MODEL` variable to override).
- Post-demo: D045 names the revert path — kill switch, then route deletion.
  Productizing any concierge behavior is a new decision-log entry.
