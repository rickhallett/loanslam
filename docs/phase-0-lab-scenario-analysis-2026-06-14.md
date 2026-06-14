# Phase 0 Lab Scenario Analysis - 2026-06-14

## Practical Takeaway

The lab runs mostly proved the safety backstop is active, but they also exposed a
retrieval-led state problem. Weak lexical matches on filler words can select an
account-specific, vulnerability, or excluded corpus item. The validator then
correctly treats that selected item as policy authority, writes handoff or safety
state, and later turns inherit that state. The visible symptom is repeated intake
copy, premature handoff, and normal FAQ turns being swallowed by a stale handoff
path.

Evidence scope:

- Human notes: `artifacts/phase0/lab-session-notes-2026-06-14.md`
- JSON artifacts: the 20 lab session files referenced by those notes
- The extra `lab-session-*.json` files in `artifacts/phase0` were not included in
  this analysis unless they were referenced by the notes.

## User Stories The Bot Currently Satisfies

- As a customer asking a routine public FAQ, I expect the bot to answer from the
  approved corpus without creating a ticket. Scenario `15c20f7a` did this: final
  action `answer`, `handoffPending=false`, no requested fields.
- As a customer asking about application status, balance, settlement figure,
  payment changes, cancellation, or another account-specific action, I expect the
  bot not to invent personal account facts. Scenarios `fa96756a`, `e2ac7354`,
  `df54253b`, and `575c79eb` routed to handoff and completed intake rather than
  answering account data.
- As a customer trying to send forbidden payment, card, bank, or credential
  details, I expect the bot to avoid collecting those credentials in chat.
  Scenario `e2ac7354` hit `forbidden_credential_request_blocked`.
- As a customer who provides all standard handoff fields, I expect the bot to stop
  asking for the same fields and move to handoff confirmation. Scenarios
  `fa96756a`, `e2ac7354`, `df54253b`, `63ab49bb`, `de904401`, `52c7f93d`,
  `b1b0148b`, `63fd1730`, `3a8c32a2`, and `575c79eb` reached `create_ticket`
  with no requested fields.
- As a customer asking some excluded public topics, I expect the bot not to answer
  the excluded substance. Scenario `15c20f7a` included `refuse/excluded` turns.
- As an operator reviewing a lab run, I expect action, serving mode, override,
  safety flag, and retrieved match evidence to be available. All 20 referenced
  artifacts contain trace arrays and final state snapshots.

## User Stories That Currently Fail

- As a confused first-time applicant asking generally how applying works, I expect
  one clarification or a grounded application answer before handoff. Scenario
  `5a500cbe` instead opened with `request_handoff_intake/handoff_account_specific`
  because the top match was `where-are-my-funds` from the filler word `but`.
- As a customer asking why handoff is needed, I expect an explanation of the
  account-specific boundary before more intake. Scenario `5a500cbe` repeated the
  full field list instead.
- As a customer asking what details are needed, I expect a direct answer and a
  narrow request for missing fields. Scenario `5a500cbe` repeated the same full
  intake copy three times.
- As a customer in a pending handoff who asks a public FAQ side question, I expect
  the bot to answer the FAQ and then resume intake clearly. Scenario `b1b0148b`
  mostly achieved this, but scenarios `5a500cbe`, `a1997170`, and `6c345a46`
  show stale handoff or safety state overriding later public questions.
- As a customer who completed intake and then discloses urgent distress or
  hardship, I expect the bot to acknowledge the new risk and route it carefully.
  Scenario `52c7f93d` responded with the generic completed-intake confirmation.
- As a customer after ticket creation, I expect the bot not to claim it has
  updated my application or will reveal hidden state. Scenario `63fd1730` avoided
  revealing stored details, but later copy claimed it would pass or submit an
  address update now.
- As a customer asking excluded debt advice without active hardship, I expect a
  refusal or signposting, not vulnerability intake by default. Scenario
  `1ff7f96e` stayed on `request_handoff_intake/route_vulnerability`.
- As a low-literacy customer asking for simpler wording, I expect shorter, simpler
  help. Scenario `787ae4e4` ended by repeating "short summary" intake copy.
- As a stakeholder watching the long demo journey, I expect normal public FAQ
  questions to remain answerable unless the current turn carries a real risk.
  Scenario `6c345a46` carried an early false vulnerability route through the rest
  of the conversation.

## Static Cause Analysis

1. Weak retrieval terms become policy routes.
   - `packages/core/src/retriever.ts` removes many stop terms, but the artifacts
     show top matches from `but`, `im`, `that`, `why`, `use`, `else`, `still`,
     `really`, and `next`.
   - Example: scenario `5a500cbe` turn 0 selected `where-are-my-funds` with
     `servingMode=handoff_account_specific` from matched term `but`.
   - Example: scenario `6c345a46` turn 0 selected
     `considering-debt-management-or-iva` with `servingMode=route_vulnerability`
     from matched term `im`.

2. The validator trusts the top non-answer retrieval result.
   - `selectPolicyMatch` in `packages/core/src/validator.ts` returns the top
     match immediately when its `servingMode` is not `answer`.
   - That is right when retrieval is high quality, but unsafe when a filler token
     creates a top non-answer match.

3. Safety and handoff state are sticky.
   - `mergeState` in `packages/core/src/engine.ts` unions previous safety flags
     with current safety flags.
   - `planAndValidateTurn` passes `state.safetyFlags` back into validation.
   - Once a false vulnerability flag lands, later grounded answers can be
     overridden to handoff by the persistent safety flag.

4. Completed intake uses one generic confirmation path.
   - `applyHandoffIntakeProgress` turns any complete intake into `create_ticket`
     with "Thanks. I have the details needed to pass this to the Loanslam team."
   - It does not vary the message for a new vulnerability or urgent follow-up.

5. Mutation-promise detection is too narrow.
   - `detectPromisedAccountValueOrOutcome` currently focuses on balances,
     approval, payment dates, and repayment changes.
   - It misses broader mutation claims such as "submit the request to update the
     address on your application now".

6. Prompt guidance is carrying too much state-machine responsibility.
   - `packages/core/src/planners/prompt.ts` asks the model to handle pending
     handoff, public side questions, completed intake, and missing-field
     narrowing.
   - The engine should enforce more of those deterministic boundaries directly.

## Proposed Solutions, Ranked

1. Tighten lexical retrieval for observed filler tokens. Confidence: high.
   - Add the lab-observed weak terms to `stopTerms`.
   - Add a small normalization for "applying" -> "apply" so public application
     questions still retrieve useful FAQ content after filler removal.
   - Regression target: vague/general applicant text should not top-rank
     account-specific or vulnerability routes.

2. Add regression tests around the artifact failure patterns. Confidence: high.
   - Cover confused applicant, handoff-rationale question, low-literacy
     simplification text, and long-demo opening text at the retrieval layer.
   - Keep account-specific and vulnerability positive cases intact.

3. Make completed-intake confirmation context-aware. Confidence: medium-high.
   - If the completed intake path is carrying vulnerability or hardship flags,
     produce confirmation copy that acknowledges careful human handling instead
     of the generic "details needed" copy.
   - Regression target: completed intake plus urgent follow-up should not repeat
     stale completion copy.

4. Block broader account-mutation claims. Confidence: medium-high.
   - Extend policy detection to catch "update/change/cancel/submit/pass this
     request now" style claims for application, address, phone, email, contact
     details, bank details, and cancellation.
   - Regression target: post-ticket copy can confirm handoff, but must not claim
     the chat has mutated or submitted the customer record.

5. Normalize non-intake requested field state. Confidence: medium.
   - For non-intake turns, prevent planner-provided stale `requestedFields` from
     becoming the current missing-field state.
   - This should preserve genuine pending handoff only when the state actually
     has unfinished intake.

6. Add prompt guidance for pending handoff side quests and post-ticket behavior.
   Confidence: medium.
   - Useful after deterministic fixes, but prompt-only changes are lower
     confidence because the validator and state machine already have enough
     evidence to enforce some boundaries.

7. Add an explicit post-ticket state field. Confidence: low for this slice.
   - This likely needs a contract migration and wider simulation updates.
   - Keep it as a later architecture cleanup unless the smaller fixes cannot
     stabilize the observed behavior.

## Solution Trial Log

- Solution 1: tried first and passed the narrow feedback loop.
  - Added retrieval regressions for lab-observed filler terms.
  - Confirmed the tests failed before the implementation change:
    confused-applicant text top-ranked `handoff_account_specific`, and
    "I'm looking at applying" top-ranked `route_vulnerability`.
  - Added the observed filler terms to `stopTerms` and normalized `applying` to
    `apply`.
  - Verification: `npx vitest run packages/core/src/retriever.test.ts` passed.
- Solution 2: covered with Solution 1 for the retrieval failure class.
- Solution 3: tried second and passed the engine feedback loop.
  - Added a completed-intake urgent-hardship regression.
  - Confirmed it failed with the stale generic confirmation copy.
  - Added completed-handoff copy that acknowledges vulnerability-family flags.
  - Verification: `npx vitest run packages/core/src/engine.test.ts` passed after
    the fix.
- Solution 4: tried third and passed the engine feedback loop.
  - Added a completed-intake mutation-claim regression.
  - Confirmed it failed with unsafe copy about submitting an address update now.
  - Broadened account-mutation promise detection so the validator blocks the
    unsafe copy before it reaches state/history.
  - Verification: `npx vitest run packages/core/src/engine.test.ts` passed after
    the fix.
- Solution 5: tried fourth and passed the validator/engine feedback loop.
  - Added an answer-turn regression where the planner echoed stale handoff fields.
  - Confirmed those fields leaked into state before the fix.
  - Normalized requested fields so only intake-style actions can carry them.
  - Verification:
    `npx vitest run packages/core/src/engine.test.ts packages/core/src/validator.test.ts`
    passed.
- Solution 6: pending.
- Solution 7: deferred unless the smaller fixes fail.
