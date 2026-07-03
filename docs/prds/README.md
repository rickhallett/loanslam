# PRDs, specs, and campaign cards

This directory holds only **live** product contracts and the cards for
campaigns or arcs that are currently authorized and in flight.

Everything whose work has closed moves to [`closed/`](closed/), keeping its
final status line and closeout-receipt pointer. Closed cards are historical
records per `docs/campaign-workflow-protocol.md`; they are never edited after
the move, and nothing in `closed/` is active agent guidance.

When a campaign or arc closes, the closeout flips the card's status line to
`closed` with its receipt path and moves the card here into `closed/`,
updating inbound references outside `artifacts/` (frozen evidence keeps its
original paths).
