import { describe, expect, it } from "vitest";

import { navOfferForReply } from "./navOffer";

describe("navOfferForReply", () => {
  it("offers the application when the reply names the application form", () => {
    const offer = navOfferForReply(
      "You can start on the application form whenever you're ready.",
      "/",
    );
    expect(offer).toEqual({
      label: "Take me to the application",
      path: "/apply/",
    });
  });

  it("offers the homepage when the reply names it", () => {
    const offer = navOfferForReply(
      "The homepage has an overview of our loans.",
      "/faq/",
    );
    expect(offer?.path).toBe("/");
  });

  it("suppresses the offer on the page it points to", () => {
    expect(
      navOfferForReply("Just fill in the application form here.", "/apply/"),
    ).toBeNull();
    expect(
      navOfferForReply("Just fill in the application form here.", "/apply"),
    ).toBeNull();
  });

  it("prefers the earlier whitelist entry when several pages are named", () => {
    const offer = navOfferForReply(
      "The application form and the FAQs both cover eligibility.",
      "/",
    );
    expect(offer?.path).toBe("/apply/");
  });

  it("returns null when no known page is named", () => {
    expect(
      navOfferForReply("Happy to explain how our instalment loans work.", "/"),
    ).toBeNull();
  });
});
