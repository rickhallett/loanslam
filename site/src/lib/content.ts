export interface ContentRecord {
  kind: 'page' | 'post';
  slug: string;
  link: string;
  parent: number;
  date: string | null;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  html: string;
}

const mods = import.meta.glob('../data/content/*.json', { eager: true });
const records: ContentRecord[] = Object.values(mods).map(
  (m) => ((m as { default?: ContentRecord }).default ?? m) as ContentRecord,
);

export const pages = records.filter((r) => r.kind === 'page');
export const posts = records
  .filter((r) => r.kind === 'post')
  .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

export function page(slug: string): ContentRecord {
  const found = pages.find((p) => p.slug === slug);
  if (!found) throw new Error(`No scraped page for slug: ${slug}`);
  return found;
}

/** Original absolute URLs become local paths; the old /faqs/ redirect becomes /faq/. */
export function rewriteLinks(html: string): string {
  return html
    .replace(/https?:\/\/(www\.)?applyloansbymal\.co\.uk(?:\/[^"'<\s]*)?/g, '/apply/')
    .replace(/https?:\/\/(www\.)?loansbymal\.co\.uk/g, '')
    .replaceAll('/faqs/', '/faq/');
}

export function stripLeadingH1(html: string): string {
  return html.replace(/^\s*<h1>[\s\S]*?<\/h1>/, '');
}

export function pathFromLink(link: string): string {
  return new URL(link).pathname;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&[a-z]+;|<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Give every h2 an id and return the heading list for an in-page TOC. */
export function withToc(html: string): { html: string; toc: { id: string; label: string }[] } {
  const toc: { id: string; label: string }[] = [];
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner: string) => {
    const label = inner.replace(/<[^>]+>/g, '').trim();
    const id = slugify(label);
    toc.push({ id, label });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
