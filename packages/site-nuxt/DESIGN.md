---
name: Loanslam site-nuxt
description: Believable UK consumer-lending marketing site wrapping a support-deflection concierge chat
colors:
  ink-deepest: "#042129"
  ink-dark: "#062e38"
  ink-mid: "#0a4150"
  ink: "#10333c"
  teal: "#00879b"
  teal-bright: "#18a2b5"
  teal-soft: "#51c3d3"
  teal-tint: "#cdeef3"
  teal-wash: "#e9f6f8"
  sand: "#faf7f1"
  sand-deep: "#f1ebdf"
  amber: "#f7a823"
  amber-deep: "#ee8f0f"
  green: "#44a06d"
  green-wash: "#ecf7f0"
  body-text: "#3d5a62"
  muted-text: "#64818a"
  on-dark: "#c2dde3"
  on-dark-muted: "#7da6ae"
  line: "#e2ddd2"
  line-cool: "#d8eaee"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, Plus Jakarta Sans Variable, sans-serif"
    fontSize: "clamp(2.6rem, 6vw, 4.6rem)"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, Plus Jakarta Sans Variable, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque Variable, Plus Jakarta Sans Variable, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Plus Jakarta Sans Variable, system-ui, -apple-system, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Plus Jakarta Sans Variable, system-ui, -apple-system, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 800
    letterSpacing: "0.22em"
rounded:
  sm: "8px"
  md: "16px"
  lg: "28px"
  pill: "999px"
spacing:
  xs: "0.5rem"
  sm: "0.85rem"
  md: "1.4rem"
  lg: "2rem"
  xl: "3.5rem"
  section: "clamp(3.5rem, 8vw, 6.5rem)"
components:
  button-apply:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink-deepest}"
    rounded: "{rounded.pill}"
    padding: "0.9rem 1.9rem"
  button-apply-hover:
    backgroundColor: "{colors.amber-deep}"
  button-teal:
    backgroundColor: "{colors.teal}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0.9rem 1.9rem"
  button-teal-hover:
    backgroundColor: "{colors.ink-mid}"
  button-ghost:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.9rem 1.9rem"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "1.7rem"
  faq-item:
    backgroundColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0"
---

# Design System: Loanslam site-nuxt

## 1. Overview

**Creative North Star: "The Confident Duck"**

Calm on the surface, capable underneath. The system takes its cue from the site's own mascot and pond-ripple hero decoration: deep ink-teal water at the bookends (hero, footer, page heads), a warm sand shoreline for the body of every page, and a single bright accent — the duck's beak — reserved for the one thing that matters, taking action. Nothing here is trying to look clever or trend-driven; it's trying to look like a real, calm, well-run UK lender that happens to also be a little charming. That's the whole brief: **believability first**, warmth second, decoration never.

This system explicitly rejects the predatory-lender playbook (urgency countdown timers, alarm-red palettes, guilt-trip copy) and the generic SaaS-cream AI-default look (tinted near-white body, gradient-text hero, uniform eyebrow-kicker sections). It also rejects legacy-bank stiffness — dense grey tables with no personality. The concierge chat that lives on top of this system should read as ambient customer support, not as "the product being sold."

**Key Characteristics:**
- Deep ink-teal bookends against a warm sand body — the "water and shore" structure repeats on every page.
- One accent color, amber, spent almost exclusively on the single primary action (Apply).
- Fully rounded, pill-shaped buttons; generous 16–28px radii everywhere else. Nothing sharp.
- Soft, ambient shadows that only appear on things that float above the page.
- Bricolage Grotesque display type carries all the personality; Plus Jakarta Sans stays quiet and legible in body copy.

## 2. Colors

Two dark ink-teal tones bookend a warm sand field; teal is the brand's living color, amber is spent only where the user should act.

### Primary
- **Brand Teal** (`#00879b`): the site's core identity color — links, active nav states, the secondary "teal" button, teal-toned focus rings on the FAQ accordion.
- **Bright Teal** (`#18a2b5`) / **Soft Teal** (`#51c3d3`): mid-tint accents — the `::selection` highlight, hover glows, decorative ticker text.
- **Teal Tint** (`#cdeef3`) / **Teal Wash** (`#e9f6f8`): pale backgrounds for badges, the FAQ "+" icon chip, table header fills inside prose content.

### Secondary
- **Beak Amber** (`#f7a823`): reserved for the single primary action across the whole site — the "Apply" button, wherever it appears (header, hero, footer, inline in prose). Its hover state deepens to **Deep Amber** (`#ee8f0f`).

### Tertiary
- **Confirm Green** (`#44a06d`) with **Green Wash** (`#ecf7f0`): success/checklist affordance only — the checkmark bullet in benefit lists. Never used for CTAs or navigation.

### Neutral
- **Deepest Ink** (`#042129`) / **Dark Ink** (`#062e38`) / **Mid Ink** (`#0a4150`): the "deep water" bookend backgrounds — hero section, dark `.section--dark` blocks, page-head banners, footer.
- **Ink** (`#10333c`): heading and high-emphasis text color on light backgrounds.
- **Body Text** (`#3d5a62`): default paragraph color — deliberately darker than a typical "muted gray" to hold contrast against the sand body.
- **Muted Text** (`#64818a`): secondary/small-print text only (`.small`), never body copy.
- **On Dark** (`#c2dde3`) / **On Dark Muted** (`#7da6ae`): text colors used inside ink-toned sections.
- **Warm Sand** (`#faf7f1`) / **Deep Sand** (`#f1ebdf`): the page body background and its slightly deeper card/section variant.
- **Line** (`#e2ddd2`) / **Cool Line** (`#d8eaee`): hairline borders — warm-toned on light sand sections, cool-toned around cards/tables/FAQ items.

### Named Rules
**The One Accent Rule.** Amber exists for exactly one purpose: telling the visitor where to click to apply. If a second element on the same view is amber, one of them is wrong.

## 3. Typography

**Display Font:** Bricolage Grotesque Variable (with Plus Jakarta Sans Variable, sans-serif fallback)
**Body Font:** Plus Jakarta Sans Variable (with system-ui, -apple-system, sans-serif fallback)

**Character:** A geometric, slightly quirky display face paired with a calm, highly legible humanist body face — the pairing does the "confident but approachable" work by itself before a single color is applied.

### Hierarchy
- **Display** (800, `clamp(2.6rem, 6vw, 4.6rem)`, line-height 1.06): page `h1`s — hero headlines, page-head titles. Tight `-0.02em` tracking, `text-wrap: balance`.
- **Headline** (800, `clamp(2rem, 4vw, 3rem)`, line-height 1.06): `h2`s — section titles.
- **Title** (700, `1.25rem`, line-height 1.25): `h3`s — card/FAQ-summary/component-level headings.
- **Body** (400, `1.0625rem`, line-height 1.65): default paragraph text, capped at ~46rem (`.prose`) for long-form content.
- **Label** (800, `0.78rem`, letter-spacing `0.22em`, uppercase, teal): the `.overline` kicker and `.page-head .crumb` breadcrumb — used sparingly, not stamped above every section.

### Named Rules
**The Balanced Headline Rule.** Every `h1`–`h3` uses `text-wrap: balance`; long prose uses `text-wrap: pretty`. No orphaned words in a headline, ever.

## 4. Elevation

Ambient, not structural. Surfaces are flat by default — cards, the sand body, section blocks carry no shadow at rest. Shadow exists only to lift something that is genuinely floating above the page: a dropdown nav menu, the mobile nav panel, the hero's quote/calculator card, the chat launcher button. It should never be applied as a default "give this card some depth" treatment.

### Shadow Vocabulary
- **Ambient Small** (`box-shadow: 0 1px 2px rgba(4,33,41,0.05), 0 2px 8px rgba(4,33,41,0.06)`): the default resting shadow for `.card` and `.faq-item` — barely-there, just enough to separate white cards from the sand background.
- **Ambient Medium** (`box-shadow: 0 24px 50px -20px rgba(4,33,41,0.35)`): floating/overlaying elements — the nav dropdown, the mobile nav panel, the hero quote card.

### Named Rules
**The Floating-Only Rule.** If an element sits flush in the page flow, it gets Ambient Small or nothing. Ambient Medium is reserved for things that visually detach from the layout (dropdowns, overlays, the one hero card).

## 5. Components

Tactile and rounded, never sharp — every interactive surface is either a full pill or carries a generous 8–28px radius, and buttons lift 2px on hover rather than changing shape.

### Buttons
- **Shape:** full pill (`border-radius: 999px`), `0.9rem 1.9rem` padding, `2px` transparent border reserved for state.
- **Apply (primary action)** — `background: #f7a823` (beak amber), `color: #042129`, `box-shadow: 0 10px 24px -10px rgba(238,143,15,0.65)`; hover deepens to `#ee8f0f`.
- **Teal (secondary brand action)** — `background: #00879b`, `color: #fff`; hover deepens to `#0a4150`.
- **Ghost (tertiary, on light)** — white fill, `border: 2px solid #e2ddd2`, `color: #10333c`; hover shifts border/text to teal.
- **Ghost-dark (tertiary, on dark sections)** — transparent fill, `border: 2px solid rgba(255,255,255,0.35)`; hover solidifies border to white.
- **Hover/Focus:** `transform: translateY(-2px)` on hover, back to `0` on active — a physical "lift and press" rather than a color-only change.

### Cards / Containers
- **Corner Style:** 16px radius (`--radius`), 28px (`--radius-lg`) for larger feature containers.
- **Background:** solid white against the sand/ink page background — cards are always the lightest thing in their section.
- **Shadow Strategy:** Ambient Small at rest (see Elevation); never heavier unless the card is genuinely floating (the hero quote card uses Ambient Medium).
- **Border:** 1px `#d8eaee` (cool line) hairline.
- **Internal Padding:** `1.7rem`.

### Inputs / Fields
- **Style:** the hero calculator's range inputs and the FAQ `<details>` disclosure are the primary interactive form patterns; both use the same cool-line borders and teal focus/hover accenting as buttons.
- **Focus:** teal-tinted glow/border shift, consistent with the button and nav hover language.

### Navigation
- **Style:** sticky header, `rgba(255,255,255,0.92)` with `backdrop-filter: blur(10px)`, hairline bottom border. Nav links are 600-weight, `0.97rem`, ink-colored, with an 8px-radius teal-wash hover background.
- **Dropdown:** absolute-positioned panel, white background, cool-line border, 12px radius, Ambient Medium shadow.
- **Mobile:** checkbox-driven slide-down panel (no JS), full-width stacked links, actions moved below the list.

### Accordion (FAQ)
- **Style:** white `.faq-item` cards (16px radius, Ambient Small, cool-line border) that gain a teal border when `[open]`.
- **Marker:** a circular `+`/`–` glyph — teal-wash background normally, flipping to amber-filled and rotating 180° when open. This amber flip is a deliberate, singular exception to the "amber is only for Apply" rule — treat it as the one other sanctioned use, not a precedent for more.

### Chat Concierge (signature component)
- **Launcher:** a fixed 60px teal circle (`#00879b`), bottom-right, with a crossfading chat/close glyph pair (opacity + quarter-turn rotation) so it reads as one morphing control. Amber focus ring (`#f7a823`) for keyboard access.
- **Panel:** 20px-radius white panel, its own internal palette (deep teal `#1a8787`/`#12343b` headers, `#f0b429` accent) that runs close to but not identical to the root token set — a known drift worth converging over time (see Don'ts).
- **Character:** should read as customer support that happens to be embedded in the page, not as a separate "AI product" screaming for attention.

## 6. Do's and Don'ts

### Do:
- **Do** spend amber (`#f7a823`/`#ee8f0f`) on exactly one thing per view: the Apply action (the FAQ accordion's open-state `+`/`–` flip is the sole sanctioned exception).
- **Do** keep every button a full pill (`border-radius: 999px`) and every card/panel in the 8–28px radius range. Nothing sharp-cornered.
- **Do** keep shadows ambient and rare — Ambient Small on resting cards, Ambient Medium only on things that genuinely float (dropdowns, overlays, the hero quote card).
- **Do** use the ink-teal/sand bookend structure (`--ink-900`/`--ink-950` dark sections framing a `--sand-50` body) on any new page — it's the site's core rhythm.
- **Do** honor `prefers-reduced-motion` on every new animation, matching the existing button/ticker/scroll-reveal fallbacks.
- **Do** keep the concierge chat visually calm and secondary to the page content — it supports the journey, it isn't the hero.

### Don't:
- **Don't** introduce a countdown timer, urgency banner, or alarm-red/orange palette anywhere — that's the predatory-lender aesthetic this system is explicitly built to avoid.
- **Don't** default to a cream/sand near-white body "because AI landing pages do" without the brand's own teal-tinted intent — this sand (`#faf7f1`) is a deliberate shoreline color in a specific ink-teal/amber system, not a generic warm-neutral default.
- **Don't** add gradient text, glassmorphism-as-decoration, or a tiny uppercase tracked eyebrow above every section — none of those exist in this system today and none should be added by reflex.
- **Don't** use `border-left`/`border-right` as a colored accent stripe; the one `.notice` component that does this today is legacy and should not be used as a template for new components.
- **Don't** let the chat widget's own hard-coded palette (`#1a8787`, `#f0b429`, `#12343b`) drift further from the root custom properties (`--teal-500`, `--amber-400`, `--ink-900`) — new chat-widget work should converge toward the root tokens rather than adding a third variant.
- **Don't** make the concierge launcher/panel visually louder than the primary Apply CTA — it supports the journey, it doesn't compete with the one true call to action.
