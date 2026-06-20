# Application Flow Link Audit - 2026-06-20

Scope: rebuilt static site output after moving `/apply/` into the Astro site shell.

Built output audit:

- Command: static HTML href scan over `site/dist/` after `npm run build`.
- Pages scanned: 25 HTML files.
- Distinct internal paths: 29.
- Broken internal links: 0.
- Invalid links: 0.

Internal route decisions:

- Restored `loansbymal.co.uk` links are rewritten to local paths only when the
  generated Astro route set contains the matching page.
- Old `/faqs/` links rewrite to `/faq/`.
- Old application-host links under `applyloansbymal.co.uk` rewrite to `/apply/`.
- Old Anchor login links under `monthlyadvanceloans.anchor.co.uk/Login` rewrite
  to `/login/`.
- Scraped Cloudflare email-protection links rewrite to `/contact/`.

Intentional external categories:

- Reviews and review-provider legal/privacy material: Trustpilot.
- Payment and banking providers referenced inside the application journey:
  GoCardless and Open Banking.
- Debt advice, hardship, gambling, mental-health, and specialist support:
  MoneyHelper, StepChange, National Debtline, Mind, Samaritans, GamCare,
  GamStop, Talk to Frank, Alcohol Change UK, Action Fraud, and Inbest.
- Credit-reference, credit-score, and eligibility education: Experian, Equifax,
  TransUnion, ClearScore, Credit Karma, CheckMyFile, MoneySavingExpert, and
  Compare the Market.
- Government, regulator, and statutory-information links: GOV.UK, FCA,
  Financial Ombudsman, Your Vote Matters, Google Analytics opt-out,
  All About Cookies, and Your Online Choices.
- Legacy live-site article fallbacks for scraped content whose target articles
  are not present in the generated route set:
  `https://loansbymal.co.uk/news/understanding-the-apr-on-a-personal-loan/`
  and `https://loansbymal.co.uk/news/consolidating-debt-with-a-personal-loan/`.
