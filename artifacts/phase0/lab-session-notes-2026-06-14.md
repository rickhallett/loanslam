# Phase 0 Lab Session Notes - 2026-06-14

## 5a500cbe - Confused Applicant, General Info Before Handoff

- Artifact: `artifacts/phase0/lab-session-5a500cbe-2026-06-14.json`
- Conversation ref: `5a500cbe-251a-4264-9d63-0207a70c2f2b`
- Goal: Test whether a confused first-time applicant can get general public guidance before being pushed into handoff intake.
- Browser/API evidence: UI reset before start; 6 message POSTs all returned `200`; full API dump has 12 history messages and 6 traces.
- Final state: `lastAction=request_handoff_intake`, `handoffPending=true`, all six intake fields still requested, 0 collected facts.
- What happened: The first vague general loan message was routed to `handoff_account_specific` and forced into full handoff intake copy. "Why handoff?" and "what details?" both repeated the same field-list copy. A combined apply/credit-score FAQ turn recovered to a useful `serving_mode=answer` response, but later loan-purpose and "what should I do next if I do not want to give details?" turns fell back to the same intake copy.
- Useful failures: premature handoff for general apply language; handoff rationale not explained; confusion not resolved; stale intake copy repeated across turns; handoff state/safety flags appeared sticky after a public answer turn.
- Regression candidates: first-turn vague applicant should clarify or answer general apply guidance; "why do you need to pass me to the team?" should answer the rationale before requesting fields; "what details?" should answer directly without only repeating boilerplate; public FAQ turns inside a pending handoff should not be swallowed by stale intake state.
- Open product/policy question: Should a pending handoff state be allowed to suspend itself for clearly public FAQ questions, or should it answer the FAQ and then explicitly return to the pending handoff path?
- UI notes: Console showed Vite connect logs, one accessibility issue for an unnamed form field, and one 404 resource error. No failed message POSTs were observed.

## 15c20f7a - Clean Public FAQ Success Path

- Artifact: `artifacts/phase0/lab-session-15c20f7a-2026-06-14.json`
- Conversation ref: `15c20f7a-c5e8-41a7-8aff-10ea68ac7324`
- Goal: Test routine public FAQ answers without creating an unnecessary ticket.
- Browser/API evidence: UI reset before start; 5 customer message POSTs observed in the session; full API dump has 10 history messages and 5 traces. Network evidence: 6 POST entries listed; no listed 4xx/5xx message failures. Console evidence: 1 error-like and 1 warning/issue-like console entries listed.
- Final state: `lastAction=answer`, `handoffPending=false`, requested fields none, 0 collected facts.
- What happened: Action path was answer/answer -> answer/answer -> refuse/excluded -> refuse/excluded -> answer/answer. The run followed the public FAQ flow; final assistant copy started: "You can go to our online application form and start in a few minutes here: https://apply.loanslam.co.uk/step-one/step-one.html. The first two pages give you a personalised quote with no impact on your credit score.".
- Useful failures: Classification `not_reproducible_or_low_value`; no ticket was created by the final turn, so this is mainly positive FAQ evidence unless earlier turns show awkward routing.
- Regression candidates: Keep a fixed public FAQ journey that asserts answerable FAQ turns stay in `serving_mode=answer` and do not request handoff intake. Next-change tag: `no_change_needed`.
- Open product/policy question: Should any application-link or next-step public FAQ ever create a ticket, or should it always answer and stop unless the customer asks about their own account?
- UI notes: 1 error-like and 1 warning/issue-like console entries listed.
