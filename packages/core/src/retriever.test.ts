import type { CorpusItem } from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { retrieveMatches } from "./retriever";

describe("lexical retrieval", () => {
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

  it("does not route on bare cant when the message is not about repayment difficulty", () => {
    const items: CorpusItem[] = [
      {
        id: "cant-pay",
        question: "I can't make this month's payment.",
        question_variants: ["I can't afford my repayment this month"],
        serving_mode: "route_vulnerability",
        route_reason: "Repayment difficulty routes to vulnerability intake.",
        tags: ["cant-pay", "hardship", "vulnerability"],
      },
    ];

    expect(retrieveMatches("I cant find my ticket.", items)).toEqual([]);
  });

  it("still routes genuine payment difficulty after dropping bare cant", () => {
    const items: CorpusItem[] = [
      {
        id: "cant-pay",
        question: "I can't make this month's payment.",
        question_variants: ["I can't afford my repayment this month"],
        serving_mode: "route_vulnerability",
        route_reason: "Repayment difficulty routes to vulnerability intake.",
        tags: ["cant-pay", "hardship", "vulnerability"],
      },
    ];

    expect(
      retrieveMatches("I can't afford my repayment this month.", items).map(
        (match) => match.itemId,
      ),
    ).toEqual(["cant-pay"]);
  });
});
