import { describe, expect, it } from "vitest";

import { pages, pathFromLink, posts } from "./content";
import { navOfferPaths } from "./navOffer";
import {
  customerContentPages,
  excludedContentSlugs,
  siteMapLines,
  sitePages,
} from "./siteMap";

// Bespoke Nuxt routes that have no content record behind them.
const BESPOKE_PATHS = new Set(["/apply/", "/login/", "/news/"]);

describe("siteMap", () => {
  it("covers every customer-facing route from the Nuxt inventory", () => {
    const mapped = new Set(sitePages.map((p) => p.path));
    for (const record of pages) {
      if (excludedContentSlugs.has(record.slug)) continue;
      expect(mapped, `content page ${record.slug} missing from siteMap`).toContain(
        pathFromLink(record.link),
      );
    }
    for (const post of posts) {
      expect(mapped, `news post ${post.slug} missing from siteMap`).toContain(
        pathFromLink(post.link),
      );
    }
    for (const path of BESPOKE_PATHS) {
      expect(mapped, `bespoke route ${path} missing from siteMap`).toContain(path);
    }
  });

  it("lists no page that neither content, news, nor a bespoke route backs", () => {
    const contentPaths = new Set(pages.map((r) => pathFromLink(r.link)));
    const postPaths = new Set(posts.map((r) => pathFromLink(r.link)));
    for (const page of sitePages) {
      const backed =
        contentPaths.has(page.path) ||
        postPaths.has(page.path) ||
        BESPOKE_PATHS.has(page.path);
      expect(backed, `siteMap entry ${page.path} has no backing page`).toBe(true);
    }
  });

  it("keeps excluded pages off the map", () => {
    const mapped = new Set(sitePages.map((p) => p.path));
    for (const slug of excludedContentSlugs) {
      const record = pages.find((r) => r.slug === slug);
      if (record) expect(mapped).not.toContain(pathFromLink(record.link));
    }
  });

  it("uses the same non-bespoke page inventory as the catch-all route", () => {
    const slugs = new Set(customerContentPages.map((page) => page.slug));
    expect(slugs).not.toContain("home");
    expect(slugs).not.toContain("faq");
    expect(slugs).not.toContain("contact");
    expect(slugs).not.toContain("instalment-loan");
    for (const slug of excludedContentSlugs) {
      expect(slugs).not.toContain(slug);
    }
  });

  it("backs every navigation offer with a mapped page", () => {
    const mapped = new Set(sitePages.map((p) => p.path));
    for (const offerPath of navOfferPaths) {
      expect(mapped, `nav offer ${offerPath} missing from siteMap`).toContain(offerPath);
    }
  });

  it("renders one plain-text line per page", () => {
    const lines = siteMapLines().split("\n");
    expect(lines).toHaveLength(sitePages.length);
    for (const line of lines) expect(line).toMatch(/^- .+ \//);
  });
});
