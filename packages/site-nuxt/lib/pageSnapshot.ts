// DOM-derived page snapshot for the site-wide concierge (D046): route,
// title, headings, and a capped text excerpt of the main content. Same
// pattern as the form snapshot — read the rendered page, touch nothing.
// All content is the prototype site's own synthetic copy.

export interface PageSnapshot {
  route: string;
  title: string;
  headings: string[];
  excerpt: string;
  [key: string]: unknown;
}

export function snapshotPage(routePath: string): PageSnapshot {
  const main = document.querySelector("main#main");
  const headings = [...(main?.querySelectorAll("h1, h2") ?? [])]
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 12);
  const excerpt = (main?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
  return { route: routePath, title: document.title, headings, excerpt };
}
