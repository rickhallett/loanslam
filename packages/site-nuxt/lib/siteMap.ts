import { pages, pathFromLink, posts, type ContentRecord } from "./content";

// Curated site map: the concierge sees the same customer-facing route inventory
// the Nuxt app renders. Bespoke Nuxt routes are listed here; content and news
// routes are derived from content records so the prompt cannot silently drift.

export interface SitePage {
  path: string;
  name: string;
  hint?: string;
}

const bespokeContentSlugs = new Set(["home", "faq", "contact", "instalment-loan"]);

// Content records that exist but stay off both the customer-facing map and the
// generic catch-all page route.
export const excludedContentSlugs = new Set(["sorry", "covid-19-help"]);

export const customerContentPages: ContentRecord[] = pages.filter(
  (page) =>
    !bespokeContentSlugs.has(page.slug) &&
    !excludedContentSlugs.has(page.slug),
);

const bespokeSitePages: SitePage[] = [
  { path: "/", name: "homepage" },
  { path: "/apply/", name: "application form", hint: "the loan application journey" },
  { path: "/faq/", name: "FAQs" },
  { path: "/contact/", name: "contact page", hint: "support team and contact options" },
  {
    path: "/instalment-loan/",
    name: "instalment loans page",
    hint: "the product explained",
  },
  { path: "/login/", name: "customer login" },
  { path: "/news/", name: "news hub", hint: "credit score and lending guides" },
];

const contentHints = new Map<string, string>([
  ["open-banking", "what Open Banking is, AccountScore, safety"],
  ["extra-support", "accessibility and extra help"],
]);

function pageName(record: ContentRecord): string {
  if (record.slug === "personal-loans") return "personal loans guide";
  if (record.slug === "credit-score") return "credit score guide";
  return record.title;
}

function sitePageForContent(record: ContentRecord): SitePage {
  return {
    path: pathFromLink(record.link),
    name: pageName(record),
    hint: contentHints.get(record.slug),
  };
}

function sitePageForPost(record: ContentRecord): SitePage {
  return {
    path: pathFromLink(record.link),
    name: record.title,
    hint: "news article",
  };
}

function byPath(a: SitePage, b: SitePage): number {
  return a.path.localeCompare(b.path);
}

export const sitePages: SitePage[] = [
  ...bespokeSitePages,
  ...customerContentPages.map(sitePageForContent).sort(byPath),
  ...posts.map(sitePageForPost).sort(byPath),
];

export function siteMapLines(): string {
  return sitePages
    .map((page) => `- ${page.name} ${page.path}${page.hint ? ` (${page.hint})` : ""}`)
    .join("\n");
}
