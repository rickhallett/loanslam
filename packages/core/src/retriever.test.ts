import type { CorpusItem } from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { loadCorpusFromFile } from "./corpus";
import { retrieveMatches } from "./retriever";

const corpus = loadCorpusFromFile().items;

function topMatch(query: string) {
  const [match] = retrieveMatches(query, corpus);

  expect(match).toBeDefined();
  return match;
}

describe("lexical retrieval", () => {
  it("finds answer corpus items for Open Banking and application questions", () => {
    expect(topMatch("Is open banking safe for my bank login?")).toMatchObject({
      itemId: "what-is-open-banking",
      servingMode: "answer",
    });

    expect(topMatch("Where can I apply online for a loan?")).toMatchObject({
      itemId: "how-do-i-apply",
      servingMode: "answer",
    });
  });

  it("finds handoff corpus items for account-specific status and balance", () => {
    expect(topMatch("Can I get an application status update?")).toMatchObject({
      itemId: "whats-the-status-of-my-application",
      servingMode: "handoff_account_specific",
    });

    expect(topMatch("What's my current balance?")).toMatchObject({
      itemId: "what-is-my-balance",
      servingMode: "handoff_account_specific",
    });
  });

  it("finds vulnerability corpus items for repayment hardship", () => {
    expect(topMatch("I can't pay this month, money is tight")).toMatchObject({
      itemId: "cant-pay-this-month",
      servingMode: "route_vulnerability",
    });

    expect(
      topMatch("I'm in hardship and struggling financially"),
    ).toMatchObject({
      itemId: "struggling-financially-general",
      servingMode: "route_vulnerability",
    });
  });

  it("finds excluded corpus items for APR and debt advice", () => {
    expect(topMatch("What APR rate will I personally get?").servingMode).toBe(
      "excluded",
    );

    expect(topMatch("Can you give me debt advice?")).toMatchObject({
      itemId: "can-you-give-me-debt-advice",
      servingMode: "excluded",
    });
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

  it("does not use a score threshold that drops weak lexical evidence", () => {
    const matches = retrieveMatches("cooling", corpus);

    expect(matches[0]).toMatchObject({
      itemId: "what-is-the-cooling-off-period",
      servingMode: "answer",
    });
    expect(matches[0]?.score).toBeGreaterThan(0);
    expect(matches[0]?.matchedTerms).toContain("cooling");
  });
});
