import { describe, expect, it } from "vitest";

import { isApplicationHost as compatIsApplicationHost } from "./sitePolicy";
import {
  isApplicationHost,
  normalizeSitePath,
  resolveSiteRouteUrl,
  rewriteLinks,
} from "./siteRoutePolicy";

describe("siteRoutePolicy", () => {
  it("recognizes current and legacy application hosts", () => {
    expect(isApplicationHost("apply.loanslam.co.uk")).toBe(true);
    expect(isApplicationHost("applyloansbymal.co.uk")).toBe(true);
    expect(isApplicationHost("www.loansbymal.co.uk")).toBe(false);
  });

  it("normalizes known site paths and legacy aliases only", () => {
    expect(normalizeSitePath("/news/how-can-i-boost-my-credit-score")).toBe(
      "/news/how-can-i-boost-my-credit-score/",
    );
    expect(normalizeSitePath("/faqs/")).toBe("/faq/");
    expect(normalizeSitePath("/covid-19-help/")).toBeNull();
  });

  it("rewrites first-party content links through the shared policy", () => {
    expect(
      rewriteLinks(
        'Apply at https://applyloansbymal.co.uk/start and read <a href="https://loansbymal.co.uk/faqs/">FAQs</a>.',
      ),
    ).toBe('Apply at /apply/ and read <a href="/faq/">FAQs</a>.');
  });

  it("does not mask stale first-party content links", () => {
    expect(rewriteLinks("Read https://loansbymal.co.uk/no-such-page/")).toBe(
      "Read https://loansbymal.co.uk/no-such-page/",
    );
  });

  it("returns discriminated route-policy outcomes", () => {
    expect(
      resolveSiteRouteUrl(new URL("https://loansbymal.co.uk/open-banking/")),
    ).toMatchObject({
      kind: "local_route",
      target: "site",
      path: "/open-banking/",
      preservesUrlSuffix: true,
    });
    expect(
      resolveSiteRouteUrl(new URL("https://loansbymal.co.uk/no-such-page/")),
    ).toMatchObject({
      kind: "unknown_first_party_path",
      target: "site",
      sourcePath: "/no-such-page/",
    });
    expect(
      resolveSiteRouteUrl(new URL("https://www.moneyhelper.org.uk/")),
    ).toMatchObject({
      kind: "external_url",
      sourceHost: "moneyhelper.org.uk",
    });
  });

  it("keeps the old import path as a compatibility wrapper", () => {
    expect(compatIsApplicationHost("apply.loanslam.co.uk")).toBe(true);
  });
});
