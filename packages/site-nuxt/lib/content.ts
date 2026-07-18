import pageAboutUs from "../data/content/page-about-us.json";
import pageComplaints from "../data/content/page-complaints.json";
import pageContact from "../data/content/page-contact.json";
import pageCovid19Help from "../data/content/page-covid-19-help.json";
import pageCreditScore from "../data/content/page-credit-score.json";
import pageExistingCustomers from "../data/content/page-existing-customers.json";
import pageExtraSupport from "../data/content/page-extra-support.json";
import pageFaq from "../data/content/page-faq.json";
import pageHome from "../data/content/page-home.json";
import pageInstalmentLoan from "../data/content/page-instalment-loan.json";
import pageOpenBanking from "../data/content/page-open-banking.json";
import pagePersonalLoans from "../data/content/page-personal-loans.json";
import pagePositiveOutcomes from "../data/content/page-positive-outcomes.json";
import pagePrivacyPolicy from "../data/content/page-privacy-policy.json";
import pageSorry from "../data/content/page-sorry.json";
import pageTermsAndConditions from "../data/content/page-terms-and-conditions.json";
import postCanIGetAPersonalLoanWithAPoorCreditScore from "../data/content/post-can-i-get-a-personal-loan-with-a-poor-credit-score.json";
import postHowCanIBoostMyCreditScore from "../data/content/post-how-can-i-boost-my-credit-score.json";
import postHowCanICheckMyCreditScoreForFree from "../data/content/post-how-can-i-check-my-credit-score-for-free.json";
import postHowToCheckYourCreditHistory from "../data/content/post-how-to-check-your-credit-history.json";
import postWhatsACreditBuilderCard from "../data/content/post-whats-a-credit-builder-card.json";
import postWillAPersonalLoanAffectMyCreditScore from "../data/content/post-will-a-personal-loan-affect-my-credit-score.json";

export interface ContentRecord {
  kind: "page" | "post";
  slug: string;
  link: string;
  parent: number;
  date: string | null;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  html: string;
}

const records = [
  pageAboutUs,
  pageComplaints,
  pageContact,
  pageCovid19Help,
  pageCreditScore,
  pageExistingCustomers,
  pageExtraSupport,
  pageFaq,
  pageHome,
  pageInstalmentLoan,
  pageOpenBanking,
  pagePersonalLoans,
  pagePositiveOutcomes,
  pagePrivacyPolicy,
  pageSorry,
  pageTermsAndConditions,
  postCanIGetAPersonalLoanWithAPoorCreditScore,
  postHowCanIBoostMyCreditScore,
  postHowCanICheckMyCreditScoreForFree,
  postHowToCheckYourCreditHistory,
  postWhatsACreditBuilderCard,
  postWillAPersonalLoanAffectMyCreditScore,
] as ContentRecord[];

export const pages = records.filter((r) => r.kind === "page");
export const posts = records
  .filter((r) => r.kind === "post")
  .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

export function page(slug: string): ContentRecord {
  const found = pages.find((p) => p.slug === slug);
  if (!found) throw new Error(`No scraped page for slug: ${slug}`);
  return found;
}

export function pathFromLink(link: string): string {
  return new URL(link).pathname;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&[a-z]+;|<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Give every h2 an id and return the heading list for an in-page TOC. */
export function withToc(html: string): {
  html: string;
  toc: { id: string; label: string }[];
} {
  const toc: { id: string; label: string }[] = [];
  const seenIds = new Map<string, number>();
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner: string) => {
    const label = inner.replace(/<[^>]+>/g, "").trim();
    const baseId = slugify(label);
    const seenCount = seenIds.get(baseId) ?? 0;
    seenIds.set(baseId, seenCount + 1);
    const id = seenCount === 0 ? baseId : `${baseId}-${seenCount + 1}`;
    toc.push({ id, label });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}

export function stripLeadingH1(html: string): string {
  return html.replace(/^\s*<h1>[\s\S]*?<\/h1>/, "");
}

export function normalizeContentHeadings(html: string): string {
  return stripLeadingH1(html).replace(/<\/?h1>/g, (tag) =>
    tag.replace("h1", "h2"),
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
