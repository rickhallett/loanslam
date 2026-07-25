# Campaign Workflow Protocol

Date: 2026-07-02
Status: active

This document is the canonical execution workflow for new multi-arc work. It
supersedes the per-arc batch-authorization mechanics defined in the (now
archived) integrated-poc arc-004 agenda card and its sibling cards as the
default authorization unit. New work is authorized at the campaign level
under this protocol.

Unchanged by this document:

- `docs/core-product-decision-log.yaml` stays the canonical record of product
  decisions. Campaigns are authorized and steered through it, never around it.
- The bounded tuning loop and dispatcher chains in
  `docs/loanslam-operator/06-workflows.md` still govern work *inside* an arc.
  This protocol governs the level above: how arcs are grouped, authorized,
  and closed.
- All existing human gates in the roadmaps (deviation from parity, retiring
  live services, secrets/DNS, auth/PII/CRM, write-capable account flows)
  remain in force. A campaign authorization never implies passage through
  them.

## Why the arc model is superseded

The per-arc cadence (one agenda card, one green-light, one closeout report
per arc) was designed when the human checkpoint was the primary quality
mechanism. The verification fabric has since matured past that assumption:

- Behavior claims are proven by full integration batteries against real
  engines and live URLs, not static tests (Evidence And Test Discipline).
- Site route and UI proof receipts make visual/content regressions auditable
  without keeping raw screenshots or retired parity scripts in git.
- Per-slice proof receipts, `just gate-slice`, `just verify`, and
  `just branch-risk` already run without human eyes.
- Arcs ipoc-003/004 and sitenuxt-001/002 completed under batch authorization
  with zero mid-arc human interventions that a machine gate had not already
  forced.

The human review between arcs was, in practice, re-approving a direction the
decision log had already accepted. Campaigns remove that redundant loop while
keeping every gate that is irreducibly human.

## Units of work

| Unit | Definition | Authorized by | Verified by |
| --- | --- | --- | --- |
| Slice | One atomic, receipt-producing change (existing definition) | Campaign card | Machine gates + committed receipt |
| Arc | An ordered chain of slices with one objective and one write scope | Campaign card | Arc-close gate run + receipts |
| Campaign | An ordered set of arcs toward one named outcome, ending at a human event or decision point | One D-entry + one campaign card | Campaign closeout report to human |

A campaign should end at something only a human can do or decide (a
stakeholder demo, a retirement execution, a new product-surface decision).
If a proposed campaign has no such endpoint, it is probably just an arc.

## The campaign card

One card per campaign, in `docs/prds/`, named
`<date>-<epic-or-cross>-campaign-<nnn>-card.md`. It replaces the N per-arc
agenda cards and contains:

1. **Authorization line** — the D-entry that green-lit it, date, and the
   campaign's single human checkpoint (its endpoint).
2. **Outcome** — the named end state, one paragraph.
3. **Arc chain** — table of arcs, each with objective, slice chain, and
   write scope. Roadmap chains stay per-arc in the epic roadmap files;
   cross-epic campaigns list the roadmaps they touch.
4. **Contract defaults** — any behavior/scope defaults the agent will apply,
   all vetoable at authorization time (the D042/D043 pattern).
5. **Non-goals and preserved human gates** — explicit list; anything not
   listed as in-scope is out.
6. **Proof bar** — per arc, plus the campaign-close bar.
7. **Stop conditions** — see below; these halt the campaign, not the slice.

Commit label shape gains one segment:
`Epic: <epic> / Slice: <label> / Arc: <arc> / Campaign: <campaign> /
Human checkpoint: campaign-closeout`.

## Human touchpoints

Exactly four kinds, extending the digest-and-ping model one level up:

| # | Touchpoint | When | Human decides |
| --- | --- | --- | --- |
| 1 | Campaign authorization | Once, before any code | Accept/veto the card and its contract defaults; recorded as a D-entry |
| 2 | Never-suppressed stop | On any stop condition | Discard / hand-fix / rule the exception; campaign resumes or dies |
| 3 | Drafted decision | When work surfaces a genuine product decision | Accept/veto a drafted D-entry; only dependent slices block meanwhile |
| 4 | Campaign closeout | Once, at the endpoint | Review the closeout report; take the human action the campaign prepared |

There are no scheduled per-arc check-ins. Arc boundaries are machine gates.
Batched digests (existing cadence) continue as information, not as approval
points.

## Machine gates

| Boundary | Gate |
| --- | --- |
| Per commit | `just gate-slice -- --staged` |
| Per slice | Proof bar met; receipt committed; `just verify` for code slices |
| Per arc close | Full integration battery for the touched surface; route/UI proof receipt where the site is in scope; `just branch-risk -- --base dev` |
| Promotion to dev | Battery + route/UI proof on the merged result, plus the consistency check below |

**Consistency check (required before promotion):** roadmap entries, campaign
card, implementation diff, and receipts must agree mechanically — every
completed chain id has a receipt path that exists, every receipt names a
commit that is an ancestor of the merge, and no write scope was exceeded.
Run `just campaign-consistency-check -- <roadmap.yaml> [more.yaml...]`
(`scripts/campaign-consistency-check.mjs`) against every roadmap touched by
the promotion and commit its output with the closeout. No campaign promotes
without a clean run.

## Irreducible human gates

Never covered by campaign authorization, regardless of card wording:

- Intentional user-visible deviation (content, styling, routes, redirects,
  SEO) from an accepted parity contract.
- Retiring, deleting, or cutting over a live service (Astro site,
  widget-adapter, any Railway service, DNS, custom domains).
- Secrets: creating, rotating, or syncing values beyond recorded dry-runs.
- Real auth, PII persistence, CRM, webhooks, or any write-capable account
  flow.
- New product surface (e.g. scoped actions) or spending/reputation exposure
  beyond the stakeholder circle.
- Anything the decision log marks human-gated.

Campaigns may *prepare* work behind these gates (archive branches, deletion
diffs, checklists, drafted D-entries) so the human action is a yes/no, but
must not execute it.

## Decision-surfacing instead of pausing

When in-flight work surfaces a genuine product decision, the agent:

1. Drafts a proposed D-entry (topic, question, proposed answer, evidence)
   and delivers it to the human.
2. Marks only the slices that depend on that decision as blocked in the
   roadmap.
3. Continues all non-dependent slices.

A drafted D-entry is a question, not a decision. It enters the decision log
only when the human accepts it, in their words or with their edits.

## Stop conditions

Stop conditions halt the **campaign** and route to touchpoint 2. They are the
union of the constituent roadmaps' stop conditions, plus:

- The campaign's premise has gone stale: a decision-log entry accepted after
  authorization contradicts the card, or the endpoint event has changed.
- The consistency check fails.
- Two consecutive arcs end without their proof bar met.
- Write scopes of concurrent arcs overlap unexpectedly.

After a stop, resumption requires an explicit human ruling recorded on the
card (a dated line, not a new card).

## Drift control

Long autonomous horizons fail by confidently completing stale plans. Two
mandatory habits:

- **Arc-open re-grounding:** every arc opens by re-reading the decision log
  tail, the campaign card, and the touched roadmaps, and stating (in the arc's
  first commit or receipt) that the premise still holds. A premise that no
  longer holds is a stop condition, not a judgment call.
- **Receipts before narrative:** the closeout report may claim only what a
  committed receipt shows. The existing evidence discipline applies verbatim.

## First campaign

The first instantiation is the pre-demo convergence campaign: merge
`feature/site-nuxt-chat-01` (sitenuxt-arc-003 complete as of 2026-07-02) to
dev and promote, build the promotion consistency check, then a hardening arc
(session-store abstraction with TTL and reset endpoint, access control/rate
limit for the public ipoc surface, and a drafted D-entry for durable
conversation recording). Its endpoint is the stakeholder demo — a human
event. Its card is authored separately under this protocol and green-lit as
a D-entry before work starts.
