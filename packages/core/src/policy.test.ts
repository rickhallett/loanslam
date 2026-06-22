import type {
  ConversationState,
  CorpusItem,
  TurnPlanner,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { processTurn } from "./engine";
import {
  containsForbiddenCredentialTerm,
  detectCredentialBoundaryRequest,
  detectForbiddenCredentialRequest,
  detectPaymentLinkRequest,
  detectSecondaryBorrowingAdviceRequest,
  detectSensitiveOvershare,
  standardHandoffFields,
} from "./policy";

const noCorpus: CorpusItem[] = [];

function state(): ConversationState {
  return {
    conversationRef: "conv-policy-test",
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
  };
}

function idFactory() {
  const ids = ["request-1", "inbound-1", "outbound-1", "trace-1"];

  return () => {
    const id = ids.shift();
    if (!id) {
      throw new Error("unexpected id request");
    }

    return id;
  };
}

function vulnerabilityHandoffPlanner(): TurnPlanner {
  return {
    async planTurn() {
      return {
        action: "request_handoff_intake",
        customerMessage:
          "I can pass this to the LoanSlam team so a person can help.",
        ui: {
          primitive: "intake_form",
          message: "I can pass this to the LoanSlam team so a person can help.",
          fields: [...standardHandoffFields],
        },
        reasonCode: "vulnerability_handoff",
        collectedFacts: {},
        requestedFields: [...standardHandoffFields],
        grounding: null,
        safetyFlags: ["vulnerability", "distress"],
        traceSummary: "Customer may need careful support.",
      };
    },
  };
}

const urgentSafetyFixtures = [
  {
    name: "regex catches direct self-harm language",
    text: "I might hurt myself tonight if this keeps going.",
    expectedFinalAction: "escalate",
    expectedLayer: "regex",
    expectedCopy: /crisis support|emergency services/i,
  },
  {
    name: "regex catches direct medical-emergency language",
    text: "I have chest pain and can't breathe.",
    expectedFinalAction: "escalate",
    expectedLayer: "regex",
    expectedCopy: /urgent medical help|emergency services/i,
  },
  {
    name: "regex negation suppresses reassurance without suppressing handoff",
    text: "I am not suicidal but I am stressed about the loan.",
    expectedFinalAction: "request_handoff_intake",
    expectedLayer: "regex_negation",
    expectedCopy: /person who can help/i,
  },
  {
    name: "regex still catches a separate risk after reassurance",
    text: "I am not suicidal, but if this gets worse I might hurt myself.",
    expectedFinalAction: "escalate",
    expectedLayer: "regex",
    expectedCopy: /crisis support|emergency services/i,
  },
  // known gap: covered by judge
  {
    name: "paraphrased self-harm distress currently stays on handoff copy",
    text: "I do not want to be here anymore and I cannot see a way out.",
    expectedFinalAction: "request_handoff_intake",
    expectedLayer: "judge",
    expectedCopy: /person who can help/i,
  },
  // known gap: covered by judge
  {
    name: "paraphrased medical crisis currently stays on handoff copy",
    text: "I feel like I am dying and need help with this payment.",
    expectedFinalAction: "request_handoff_intake",
    expectedLayer: "judge",
    expectedCopy: /person who can help/i,
  },
] as const;

const policyPredicateFixtures = [
  {
    name: "credential offer catches online-banking credentials",
    text: "I can send you my online banking login and password.",
    expected: true,
    expectedLayer: "regex",
    guard: "detectSensitiveOvershare + containsForbiddenCredentialTerm",
    detect: (text: string) =>
      detectSensitiveOvershare(text) && containsForbiddenCredentialTerm(text),
  },
  {
    name: "credential boundary catches banking-app screenshot upload",
    text: "Can I upload a screenshot of my banking app?",
    expected: true,
    expectedLayer: "regex",
    guard: "detectCredentialBoundaryRequest",
    detect: detectCredentialBoundaryRequest,
  },
  {
    name: "outbound credential request catches card verification copy",
    text: "Please enter your card number and CVV so I can verify the payment.",
    expected: true,
    expectedLayer: "regex",
    guard: "detectForbiddenCredentialRequest",
    detect: detectForbiddenCredentialRequest,
  },
  // known gap: covered by judge
  {
    name: "credential offer misses banking-app screen without screenshot wording",
    text: "I can paste my banking app screen here if that helps.",
    expected: false,
    expectedLayer: "judge",
    guard: "detectCredentialBoundaryRequest",
    detect: detectCredentialBoundaryRequest,
  },
  {
    name: "payment-link request catches direct creation request",
    text: "Can you generate a payment link for me right now?",
    expected: true,
    expectedLayer: "regex",
    guard: "detectPaymentLinkRequest",
    detect: detectPaymentLinkRequest,
  },
  // known gap: covered by judge
  {
    name: "payment-link request misses checkout-url paraphrase",
    text: "Can you text me the checkout URL so I can pay?",
    expected: false,
    expectedLayer: "judge",
    guard: "detectPaymentLinkRequest",
    detect: detectPaymentLinkRequest,
  },
  {
    name: "secondary-borrowing advice catches another-lender wording",
    text: "Should I borrow from another lender to repay this?",
    expected: true,
    expectedLayer: "regex",
    guard: "detectSecondaryBorrowingAdviceRequest",
    detect: detectSecondaryBorrowingAdviceRequest,
  },
  // known gap: covered by judge
  {
    name: "secondary-borrowing advice misses payday-loan paraphrase",
    text: "Would taking out a payday loan elsewhere help me cover this payment?",
    expected: false,
    expectedLayer: "judge",
    guard: "detectSecondaryBorrowingAdviceRequest",
    detect: detectSecondaryBorrowingAdviceRequest,
  },
] as const;

describe("policy guard paraphrase coverage", () => {
  for (const fixture of urgentSafetyFixtures) {
    it(`${fixture.expectedLayer}: ${fixture.name}`, async () => {
      const result = await processTurn({
        state: state(),
        userMessage: fixture.text,
        planner: vulnerabilityHandoffPlanner(),
        corpus: noCorpus,
        now: new Date("2026-06-21T10:00:00.000Z"),
        idFactory: idFactory(),
      });

      expect(result.finalAction).toBe(fixture.expectedFinalAction);
      expect(result.customerMessage).toMatch(fixture.expectedCopy);

      if (fixture.expectedFinalAction === "escalate") {
        expect(result.validatorOverrides).toContainEqual(
          expect.objectContaining({
            code: "urgent_safety_escalation_copy",
          }),
        );
      } else {
        expect(result.validatorOverrides).not.toContainEqual(
          expect.objectContaining({
            code: "urgent_safety_escalation_copy",
          }),
        );
      }
    });
  }

  for (const fixture of policyPredicateFixtures) {
    it(`${fixture.expectedLayer}: ${fixture.guard} - ${fixture.name}`, () => {
      expect(fixture.detect(fixture.text)).toBe(fixture.expected);
    });
  }
});
