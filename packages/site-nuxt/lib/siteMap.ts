// Curated site map: the single source of truth for what the concierge is
// told exists on the site. Data, not scraping — the rendered DOM is a
// projection of the content config, so the map is maintained here and a
// drift test (siteMap.test.ts) pins it against the content records. Pages a
// normal customer should never be steered to (decline landing, stale
// campaign pages) are excluded deliberately.

export interface SitePage {
  path: string;
  name: string;
  hint?: string;
}

export const sitePages: SitePage[] = [
  { path: "/", name: "homepage" },
  { path: "/apply/", name: "application form", hint: "the loan application journey" },
  { path: "/faq/", name: "FAQs" },
  { path: "/contact/", name: "contact page", hint: "support team and contact options" },
  {
    path: "/open-banking/",
    name: "Open Banking page",
    hint: "what Open Banking is, AccountScore, safety",
  },
  {
    path: "/instalment-loan/",
    name: "instalment loans page",
    hint: "the product explained",
  },
  { path: "/about-us/", name: "about us" },
  { path: "/about-us/personal-loans/", name: "personal loans guide" },
  { path: "/about-us/credit-score/", name: "credit score guide" },
  { path: "/existing-customers/", name: "existing customers" },
  { path: "/extra-support/", name: "extra support", hint: "accessibility and extra help" },
  { path: "/complaints/", name: "complaints" },
  { path: "/positive-outcomes/", name: "positive outcomes" },
  { path: "/login/", name: "customer login" },
  { path: "/privacy-policy/", name: "privacy policy" },
  { path: "/terms-and-conditions/", name: "terms and conditions" },
];

// Content records that exist but stay off the customer-facing map.
export const excludedContentSlugs = new Set(["sorry", "covid-19-help"]);

export function siteMapLines(): string {
  return sitePages
    .map((page) => `- ${page.name} ${page.path}${page.hint ? ` (${page.hint})` : ""}`)
    .join("\n");
}
