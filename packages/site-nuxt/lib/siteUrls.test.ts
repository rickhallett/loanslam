import { describe, expect, it } from "vitest";

import {
  displaySiteUrl,
  normalizeSitePath,
  rewriteDisplayedSiteUrls,
} from "./siteUrls";

const localOrigin = "http://127.0.0.1:4123";

describe("siteUrls", () => {
  it("normalizes customer-facing site-map paths", () => {
    expect(normalizeSitePath("/apply")).toBe("/apply/");
    expect(normalizeSitePath("/faqs/")).toBe("/faq/");
    expect(normalizeSitePath("/covid-19-help/")).toBeNull();
  });

  it("builds display URLs from the current request origin", () => {
    expect(displaySiteUrl("/open-banking/", localOrigin)).toBe(
      "http://127.0.0.1:4123/open-banking/",
    );
  });

  it("rewrites legacy application hosts to the current origin", () => {
    expect(
      rewriteDisplayedSiteUrls(
        "Start at https://applyloansbymal.co.uk/step-one/step-one.html.",
        localOrigin,
      ),
    ).toBe("Start at http://127.0.0.1:4123/apply/.");
  });

  it("rewrites known Loans by MAL routes and FAQ aliases", () => {
    expect(
      rewriteDisplayedSiteUrls(
        "Read https://loansbymal.co.uk/open-banking/ then https://www.loansbymal.co.uk/faqs/.",
        localOrigin,
      ),
    ).toBe(
      "Read http://127.0.0.1:4123/open-banking/ then http://127.0.0.1:4123/faq/.",
    );
  });

  it("leaves stale internal links untouched instead of masking them as homepage", () => {
    expect(
      rewriteDisplayedSiteUrls(
        "Use https://loansbymal.co.uk/no-such-page today.",
        localOrigin,
      ),
    ).toBe("Use https://loansbymal.co.uk/no-such-page today.");
  });

  it("leaves external advice links alone", () => {
    expect(
      rewriteDisplayedSiteUrls(
        "StepChange is at https://www.stepchange.org/ and MoneyHelper is at https://www.moneyhelper.org.uk.",
        localOrigin,
      ),
    ).toBe(
      "StepChange is at https://www.stepchange.org/ and MoneyHelper is at https://www.moneyhelper.org.uk.",
    );
  });
});
