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

  it("does not offer navigation from markdown links alone", () => {
    expect(
      navOfferForReply(
        "I can share this link: [application form](https://apply.loanslam.co.uk/step-one/step-one.html)",
        "/",
      ),
    ).toBeNull();
  });

  it("does not offer application navigation from refusal copy", () => {
    expect(
      navOfferForReply(
        "I cannot answer that in chat. I can signpost general information or pass this to the LoanSlam team. application form",
        "/",
      ),
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

  it("offers page-anchored destinations only on explicit page mentions", () => {
    expect(
      navOfferForReply("Our loans are powered by Open Banking.", "/"),
    ).toBeNull();
    expect(
      navOfferForReply("The Open Banking page explains how it works.", "/"),
    ).toEqual({
      label: "Take me to the Open Banking page",
      path: "/open-banking/",
    });
    expect(
      navOfferForReply("The instalment loans page covers the product.", "/"),
    ).toEqual({
      label: "Take me to the instalment loans page",
      path: "/instalment-loan/",
    });
    expect(
      navOfferForReply(
        "The Open Banking page explains how it works.",
        "/open-banking/",
      ),
    ).toBeNull();
  });
});
