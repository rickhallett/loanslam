# Concierge Persistence 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge-persistence-01 / Arc:
  concierge2-arc-001 / Campaign: demo-concierge-002 (D046)

## Change

Transcript and session refs persist in sessionStorage (per-tab); restored
transcripts are text-only (no interactive UiPlans resurrected); reset clears
the store. Server-side concierge sessions continue across full page loads.

## Proof

`scripts/dc2-003-persistence-proof.mjs`, live model: 4/4
(`artifacts/demo-concierge/dc2-003-persistence/`).

- Conversation on /faq/, full page load to /instalment-loan/: transcript
  restored (3/3 messages), customer turn retained.
- "What did I say my name was?" -> "You said your name was Horatio. You're
  currently on the instalment loan page..." — session continuity and page
  awareness in one reply (`restored-after-reload.png`).
- Reset + reload -> single welcome message (storage cleared).
- `just verify` exit 0 (recorded at slice commit).
