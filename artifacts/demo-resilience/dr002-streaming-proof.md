# dr-002 Reply Streaming Proof

Date: 2026-07-02

- Epic: demo-resilience / Slice: reply-streaming-01 / Arc:
  resilience-arc-001 / Campaign: demo-resilience-001 (D047)

## Change

Concierge replies stream. The messages route gains an opt-in `stream: true`
that returns SSE text deltas (OpenAI Responses streaming) ending in a
`done` frame carrying the whole reply; non-streaming JSON stays the default
for scripts and API consumers, and the engine path (/contact/) is untouched.
The widget renders deltas into a live bubble — the thinking dots yield at
the first delta — and drops a partial bubble if a stream errors mid-reply so
the transcript (and any dr-001 replay) holds only whole turns. All request
validation (kill switch, rate limit, 404, 400) still resolves before any
bytes stream, so dr-001 resurrection semantics are unchanged. The composer
exposes `data-sending` so harnesses wait for turn-complete rather than
"thinking dots gone" (which streaming made ambiguous); the rehearsal
harness was updated compatibly with both pre- and post-streaming builds.

## Proof (local production-mode build under secrets, port 3641)

- `node scripts/dr002-streaming-proof.mjs` — 3/3: 40 distinct growing
  partial lengths observed in flight; partial text visible with dots gone
  while still sending; final reply complete (866 chars).
  Screenshots: `dr002-streaming/mid-stream.png`, `dr002-streaming/final.png`.
- `node scripts/dr001-resurrection-proof.mjs` — 4/4 unregressed; recall
  works with the streamed reply path.
- `node scripts/sitenuxt-chat-battery.mjs` — 9/9; the non-streaming
  structured engine path is unregressed.
- `node scripts/concierge-rehearsal.mjs http://127.0.0.1:3641` — 6/6 beats
  (full choreography including apply navigation and engine handoff).
