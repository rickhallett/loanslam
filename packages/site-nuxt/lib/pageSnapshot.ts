// DOM-derived page snapshot for the site-wide concierge (D046): route,
// title, headings, a capped text excerpt of the main content, and a bounded
// inventory of the page's links and buttons so the assistant can point at
// what is actually clickable. Same pattern as the form snapshot — read the
// rendered page, touch nothing. All content is the prototype site's own
// synthetic copy.

export interface PageLink {
  label: string;
  href: string;
}

export interface PageSnapshot {
  route: string;
  title: string;
  headings: string[];
  excerpt: string;
  links: PageLink[];
  buttons: string[];
  [key: string]: unknown;
}

const MAX_LINKS = 20;
const MAX_BUTTONS = 10;

function collapse(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function snapshotPage(routePath: string): PageSnapshot {
  const main = document.querySelector("main#main");
  const headings = [...(main?.querySelectorAll("h1, h2") ?? [])]
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 12);
  const excerpt = (main?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);

  const seen = new Set<string>();
  const links: PageLink[] = [];
  for (const anchor of main?.querySelectorAll("a[href]") ?? []) {
    const label = collapse(anchor.textContent).slice(0, 60);
    const href = anchor.getAttribute("href") ?? "";
    if (!label || !href || href.startsWith("#")) continue;
    const key = `${label}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ label, href });
    if (links.length >= MAX_LINKS) break;
  }

  const buttons: string[] = [];
  for (const el of main?.querySelectorAll("button, input[type='submit']") ?? []) {
    const label = collapse(
      "value" in el && el.tagName === "INPUT"
        ? (el as HTMLInputElement).value
        : el.textContent,
    ).slice(0, 60);
    if (!label || buttons.includes(label)) continue;
    buttons.push(label);
    if (buttons.length >= MAX_BUTTONS) break;
  }

  return { route: routePath, title: document.title, headings, excerpt, links, buttons };
}
