import type { CorpusItem } from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { retrieveMatches } from "./retriever";

describe("lexical retrieval", () => {
  it("does not treat generic website-page words as route evidence", () => {
    const pricingItem: CorpusItem = {
      id: "personal-price",
      question: "What APR will I personally get?",
      serving_mode: "excluded",
      route_reason:
        "The soft quote on the first two pages of the application provides this with no impact on the customer's credit score.",
      links: [
        {
          label: "application form",
          href: "https://apply.loanslam.co.uk/step-one/step-one.html",
        },
      ],
    };

    expect(
      retrieveMatches("what pages are on this website", [pricingItem]),
    ).toEqual([]);
  });

  it("still matches substantive terms when a customer says page", () => {
    const paymentItem: CorpusItem = {
      id: "manual-payment",
      question: "Can I make a manual payment?",
      serving_mode: "answer",
      answer_text: "The team can help with payment options.",
      tags: ["payment"],
    };

    expect(
      retrieveMatches("I need the payment page", [paymentItem]).map(
        (match) => match.itemId,
      ),
    ).toEqual(["manual-payment"]);
  });

  it("uses deterministic item id ordering for tied scores", () => {
    const tiedItems: CorpusItem[] = [
      {
        id: "tie-b",
        question: "Shared phrase",
        serving_mode: "answer",
        answer_text: "Shared phrase.",
      },
      {
        id: "tie-a",
        question: "Shared phrase",
        serving_mode: "answer",
        answer_text: "Shared phrase.",
      },
    ];

    expect(
      retrieveMatches("shared", tiedItems).map((match) => match.itemId),
    ).toEqual(["tie-a", "tie-b"]);
  });
});
