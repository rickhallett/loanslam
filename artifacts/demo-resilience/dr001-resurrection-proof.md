# dr-001 Session Resurrection Proof

Date: 2026-07-02

- Epic: demo-resilience / Slice: session-resurrection-01 / Arc:
  resilience-arc-001 / Campaign: demo-resilience-001 (D047)

## Change

On a 404 from the concierge messages route (in-memory session lost to a
restart/redeploy), the widget opens a fresh session, replays its
sessionStorage transcript as text-only context (`resumeTranscript`,
validated server-side, capped at the history limit), and retries the turn
once. The replayed transcript is context only — never re-executed UI. The
trailing customer turn is dropped from the replay (it is sent as the new
turn) and the WELCOME line is filtered as UI, not conversation.

Implementation note: this slice was authored in a prior session that ended
before its proof ran; this session verified the work unchanged against a
fresh production-mode build and committed it.

## Proof (local production-mode build under secrets, port 3641)

`node scripts/dr001-resurrection-proof.mjs` — 4/4:

- session-established: concierge session created on /faq/
- lost-session-404s: missing session returns 404
- resurrected-recall: "You said your name was Perdita, and you were
  curious about a small loan for a piano." — earlier fact recalled across
  the destroyed session
- no-duplicate-turns: 2 customer turns rendered (expected 2)

Screenshot: `artifacts/demo-resilience/dr001-resurrection/resurrected.png`.

Contact battery unregressed: `node scripts/sitenuxt-chat-battery.mjs`
9/9 (session-create, engine-account-question-handoff, lookup-not-exposed,
cancel-handoff, post-cancel-grounded-answer, handoff-ticket,
intake-validation, intake-capture, cancel-unknown-session).
