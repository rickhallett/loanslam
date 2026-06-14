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

    expect(topMatch("I cannot afford my repayments")).toMatchObject({
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

    expect(topMatch("Should I enter an IVA for this debt?")).toMatchObject({
      itemId: "can-you-give-me-debt-advice",
      servingMode: "excluded",
    });

    expect(topMatch("Is a debt plan better than an IVA?")).toMatchObject({
      itemId: "can-you-give-me-debt-advice",
      servingMode: "excluded",
    });
  });

  it("routes eligibility coaching to the excluded eligibility outcome item", () => {
    for (const query of [
      "What should I say to definitely get approved?",
      "Will my application be accepted?",
      "Am I likely to be approved?",
    ]) {
      expect(topMatch(query)).toMatchObject({
        itemId: "will-my-application-be-accepted",
        servingMode: "excluded",
      });
    }

    expect(topMatch("Has my loan been approved?")).toMatchObject({
      servingMode: "handoff_account_specific",
    });
  });

  it("still routes stated IVA or debt-management events to vulnerability handling", () => {
    expect(topMatch("I'm setting up an IVA")).toMatchObject({
      itemId: "considering-debt-management-or-iva",
      servingMode: "route_vulnerability",
    });

    expect(
      topMatch("Should I contact you because I am struggling with debt?"),
    ).toMatchObject({
      servingMode: "route_vulnerability",
    });

    expect(
      topMatch("Should I enter an IVA because I cannot pay?"),
    ).toMatchObject({
      servingMode: "route_vulnerability",
    });

    expect(topMatch("I can't make this month's payment.")).toMatchObject({
      itemId: "cant-pay-this-month",
      servingMode: "route_vulnerability",
    });
  });

  it("finds complaint escalation before weak lexical answer matches", () => {
    expect(topMatch("I want to complain")).toMatchObject({
      itemId: "i-want-to-make-a-complaint",
      servingMode: "route_vulnerability",
    });

    expect(topMatch("This service is unacceptable")).toMatchObject({
      itemId: "i-want-to-make-a-complaint",
      servingMode: "route_vulnerability",
    });
  });

  it("does not boost vulnerability items without item-specific evidence", () => {
    const match = topMatch("Do I need a job to apply?");

    expect(match.servingMode).toBe("answer");
    expect(match.itemId).not.toBe("lost-job-or-redundancy");
  });

  it("does not route vague generic help language from stop-word noise", () => {
    for (const query of [
      "I got a message and I do not know what I am meant to do.",
      "Need help",
      "I need help with my loan",
    ]) {
      const [match] = retrieveMatches(query, corpus);

      expect(match?.servingMode).not.toBe("route_vulnerability");
      expect(match?.servingMode).not.toBe("handoff_account_specific");
    }
  });

  it("does not promote lab-observed filler words into policy routes", () => {
    for (const query of [
      "I think I want a loan but I don't really know how this works.",
      "I don't understand that, can you say it simpler?",
      "What else can I ask about?",
      "What fields are still missing?",
    ]) {
      const [match] = retrieveMatches(query, corpus);

      expect(match?.servingMode).not.toBe("route_vulnerability");
      expect(match?.servingMode).not.toBe("handoff_account_specific");
      expect(match?.servingMode).not.toBe("excluded");
    }
  });

  it("requires strong evidence before selecting safety or advice routes", () => {
    for (const query of [
      "I can't find the ticket, that is not a hardship thing.",
      "The operator pasted so into the chat.",
      "Can I make a payment now?",
      "Can you give me my balance reference? This is not debt advice.",
      "Is this a French service?",
    ]) {
      const [match] = retrieveMatches(query, corpus);

      expect(match?.servingMode).not.toBe("route_vulnerability");
      expect(match?.servingMode).not.toBe("excluded");
    }
  });

  it("requires account-specific evidence before selecting handoff routes", () => {
    for (const query of [
      "I can't find the ticket, that is not a hardship thing.",
      "The operator pasted so into the chat.",
      "Can you give it to me?",
    ]) {
      const [match] = retrieveMatches(query, corpus);

      expect(match?.servingMode).not.toBe("handoff_account_specific");
    }

    expect(topMatch("Can I make a payment now?")).toMatchObject({
      itemId: "make-a-payment-on-my-account",
      servingMode: "handoff_account_specific",
    });

    expect(topMatch("Can you give me my balance reference?")).toMatchObject({
      itemId: "what-is-my-balance",
      servingMode: "handoff_account_specific",
    });
  });

  it("handles complaint and hardship negation before route selection", () => {
    for (const query of [
      "I'm not complaining, I'm just asking if this is a French service.",
      "This is not a complaint, I just need to know how to apply.",
      "I'm not saying I cannot pay. I just need the ticket reference.",
      "No hardship, I only want to make a payment now.",
    ]) {
      const [match] = retrieveMatches(query, corpus);

      expect(match?.servingMode).not.toBe("route_vulnerability");
    }

    expect(
      topMatch("I'm not saying I cannot pay, but I have lost my job."),
    ).toMatchObject({
      itemId: "lost-job-or-redundancy",
      servingMode: "route_vulnerability",
    });
  });

  it("maps natural application wording to the public application FAQ", () => {
    expect(topMatch("I'm looking at applying.")).toMatchObject({
      itemId: "how-do-i-apply",
      servingMode: "answer",
    });

    expect(
      topMatch(
        "Why do you need to pass me to the Loanslam team? I'm just asking generally how applying works.",
      ),
    ).toMatchObject({
      itemId: "how-do-i-apply",
      servingMode: "answer",
    });
  });

  it("treats application-start wording as a public FAQ before account-status routing", () => {
    for (const query of [
      "Where do I start an application?",
      "How do I start an application?",
      "I want to start an application",
    ]) {
      expect(topMatch(query)).toMatchObject({
        itemId: "how-do-i-apply",
        servingMode: "answer",
      });
    }

    expect(topMatch("Can I get an application status update?")).toMatchObject({
      itemId: "whats-the-status-of-my-application",
      servingMode: "handoff_account_specific",
    });
  });

  it("keeps strong account-specific payment-date routing after filler removal", () => {
    expect(topMatch("What is my next payment date?")).toMatchObject({
      itemId: "whats-my-next-payment-date",
      servingMode: "handoff_account_specific",
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
