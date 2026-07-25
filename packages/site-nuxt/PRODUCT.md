# Product

## Register

brand

## Users

The literal visitor role is a UK consumer shopping for a personal/instalment loan (home, FAQ, credit-score guides, apply flow). The real audience whose judgment the design must satisfy is a prospective buyer or reviewer role-playing as that borrower: they are assessing whether the site is credible enough to pass as a real lender, and whether the embedded concierge chat actually deflects/triages support questions well. Design quality is evidence for both claims at once — a thin or generic site undermines trust in the underlying engine.

## Product Purpose

Loanslam site-nuxt is the customer-facing "keeper" surface (per `CONTEXT.md`) that wraps a proven support-deflection/triage chat engine (the concierge) in a believable UK consumer-lending journey. It is not a real loan originator: apply/eligibility/credit-score content is FAQ-shaped material, not a functioning sales funnel or decisioning system. Success looks like a stakeholder browsing the site and concluding "this reads like a real lender" while the concierge widget quietly demonstrates deflection value (answers FAQs, hands off cleanly when it can't).

## Brand Personality

Confident, warm-but-credible fintech. Approachable without being juvenile; serious enough to be trusted with money, light enough to not feel like a legacy bank. The existing system (ink-teal + warm sand + reserved amber for actions, rounded pill buttons, the duck mascot, Bricolage Grotesque display type) already nails this — refine and extend it, don't replace it.

## Anti-references

- Predatory/payday-loan aesthetic: countdown urgency timers, red/orange alarm palettes, guilt-trip or high-pressure copy.
- Generic SaaS-cream AI-default styling (see the skill's absolute bans) — this site already has a specific, committed palette; don't drift toward it.
- Legacy-bank stiffness (dense tables, no warmth, no mascot/personality) — that undersells the "approachable" half of the brand.

## Design Principles

- **Believability first**: every surface should read as a real, operating UK consumer lender — trust signals, regulatory small print, realistic FAQ/blog depth — not a demo shell.
- **Deflection is invisible**: the concierge chat is ambient customer support woven into the journey, not a feature being sold at the user; it should never look like "the product" is a chatbot bolted onto a landing page.
- **Trust through restraint**: credibility signals (trust ticker, testimonials, representative examples, plain-English small print) carry more weight than aggressive sales tactics or urgency.
- **Warmth without pressure**: confident and approachable, never high-pressure; the duck mascot and pill-button warmth stay, predatory-lender tropes stay out.
- **One committed system**: reuse the existing ink-teal/sand/amber tokens, Bricolage Grotesque + Plus Jakarta Sans pairing, and established components (cards, FAQ accordion, ticker, page-head) rather than introducing parallel patterns.

## Accessibility & Inclusion

WCAG 2.1 AA. Existing groundwork to preserve and extend: skip link, `prefers-reduced-motion` fallbacks for the ticker/scroll-reveal/button transitions, focus-visible states. No additional stated user needs beyond AA.
