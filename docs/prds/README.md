# PRDs, specs, and campaign cards

This directory holds only **live** product contracts and the cards for
campaigns or arcs that are currently authorized and in flight.

There is no tracked `closed/` directory. As of the 2026-07-07 markdown
pruning pass (`2026-07-06-markdown-context-pruning-spec.md`), closed cards are
guilty-until-proven-innocent: their substance either already lives in
`docs/core-product-decision-log.yaml` / an active roadmap, or it doesn't need
to survive as tracked context. Git history is the fallback for provenance,
not a retained `closed/` directory.

When a campaign or arc closes, flip the card's status line to `closed`, fold
any durable decision into `docs/core-product-decision-log.yaml` if one
doesn't already exist there, then remove the card from this directory rather
than moving it to a `closed/` subfolder.
