import type { RetrievedMatch, TurnPlan } from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { standardHandoffFields } from "./policy";
import { validateTurnPlan } from "./validator";

const answerMatch: RetrievedMatch = {
  itemId: "answer-1",
  score: 12,
  servingMode: "answer",
  matchedTerms: ["apply"],
  item: {
    id: "answer-1",
    question: "How do I apply?",
    serving_mode: "answer",
    answer_text: "You can apply online.",
    links: [{ label: "Apply", url: "https://www.loanslam.example/apply" }],
  },
};

const handoffMatch: RetrievedMatch = {
  itemId: "balance-1",
  score: 10,
  servingMode: "handoff_account_specific",
  matchedTerms: ["balance"],
  item: {
    id: "balance-1",
    question: "What is my balance?",
    serving_mode: "handoff_account_specific",
    route_reason: "A current balance is account-specific.",
  },
};

const changeRequestMatch: RetrievedMatch = {
  itemId: "change-payment-date",
  score: 10,
  servingMode: "handoff_account_specific",
  matchedTerms: ["change", "payment", "date"],
  item: {
    id: "change-payment-date",
    question: "Can I change my payment date?",
    serving_mode: "handoff_account_specific",
    route_reason:
      "Changing a repayment date is a change to the customer's account.",
    tags: ["repayment-date", "change", "account-specific", "handoff"],
  },
};

const vulnerabilityMatch: RetrievedMatch = {
  itemId: "hardship-1",
  score: 10,
  servingMode: "route_vulnerability",
  matchedTerms: ["hardship"],
  item: {
    id: "hardship-1",
    question: "I cannot pay this month",
    serving_mode: "route_vulnerability",
    route_reason: "Repayment difficulty is a vulnerability signal.",
  },
};

const excludedMatch: RetrievedMatch = {
  itemId: "apr-1",
  score: 10,
  servingMode: "excluded",
  matchedTerms: ["apr"],
  item: {
    id: "apr-1",
    question: "What APR will I personally get?",
    serving_mode: "excluded",
    route_reason: "Personalised pricing must not be served by the bot.",
  },
};

function plan(overrides: Partial<TurnPlan> = {}): TurnPlan {
  return {
    action: "answer",
    customerMessage: "You can apply online.",
    ui: {
      primitive: "message",
      message: "You can apply online.",
      links: [],
    },
    reasonCode: "test_plan",
    collectedFacts: {},
    requestedFields: [],
    grounding: {
      citedItemIds: ["answer-1"],
      servingMode: "answer",
      confidence: "supported",
    },
    safetyFlags: [],
    traceSummary: "Test plan.",
    ...overrides,
  };
}

function handoffPlan(overrides: Partial<TurnPlan> = {}): TurnPlan {
  return plan({
    action: "request_handoff_intake",
    customerMessage:
      "I cannot handle that directly in chat. I can pass this to the Loanslam team.",
    ui: {
      primitive: "intake_form",
      message:
        "I cannot handle that directly in chat. I can pass this to the Loanslam team.",
      fields: [...standardHandoffFields],
    },
    requestedFields: [...standardHandoffFields],
    grounding: null,
    safetyFlags: [],
    traceSummary: "Route to the team.",
    ...overrides,
  });
}

function refusalPlan(overrides: Partial<TurnPlan> = {}): TurnPlan {
  return plan({
    action: "refuse",
    customerMessage: "I cannot answer that in chat.",
    ui: {
      primitive: "safe_fallback",
      message: "I cannot answer that in chat.",
      links: [],
    },
    requestedFields: [],
    grounding: null,
    safetyFlags: [],
    traceSummary: "Refused excluded substance.",
    ...overrides,
  });
}

describe("validateTurnPlan", () => {
  it("overrides an answer with no cited answer grounding", () => {
    const result = validateTurnPlan(
      plan({ grounding: null }),
      [answerMatch],
      {},
    );

    expect(result.finalAction).toBe("fallback");
    expect(result.ui.primitive).toBe("safe_fallback");
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "answer_grounding_missing",
        fromAction: "answer",
        toAction: "fallback",
      }),
    );
  });

  it("overrides an answer citing a non-answer item according to serving mode", () => {
    const result = validateTurnPlan(
      plan({
        grounding: {
          citedItemIds: ["balance-1"],
          servingMode: "handoff_account_specific",
          confidence: "supported",
        },
      }),
      [handoffMatch],
      {},
    );

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.ui).toMatchObject({
      primitive: "intake_form",
      fields: standardHandoffFields,
    });
    expect(result.selectedServingMode).toBe("handoff_account_specific");
    expect(result.selectedRouteReason).toBe(
      "A current balance is account-specific.",
    );
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "non_answer_citation_blocked",
        toAction: "request_handoff_intake",
      }),
    );
  });

  it("allows an answer citing a retrieved answer item", () => {
    const result = validateTurnPlan(plan(), [answerMatch], {});

    expect(result.finalAction).toBe("answer");
    expect(result.customerMessage).toBe("You can apply online.");
    expect(result.validatorOverrides).toEqual([]);
    expect(result.selectedServingMode).toBe("answer");
  });

  it("prioritizes a top retrieved non-answer policy route over cited answer copy", () => {
    const result = validateTurnPlan(plan(), [handoffMatch, answerMatch], {});

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.selectedServingMode).toBe("handoff_account_specific");
    expect(result.selectedRouteReason).toBe(
      "A current balance is account-specific.",
    );
  });

  it("does not let a lower-ranked non-answer match override a cited answer", () => {
    const result = validateTurnPlan(plan(), [answerMatch, excludedMatch], {});

    expect(result.finalAction).toBe("answer");
    expect(result.selectedServingMode).toBe("answer");
    expect(result.validatorOverrides).toEqual([]);
  });

  it("overrides vulnerability matches and safety flags before normal answers", () => {
    const byRetrieval = validateTurnPlan(
      plan(),
      [vulnerabilityMatch, answerMatch],
      {},
    );
    const byFlag = validateTurnPlan(
      plan({ safetyFlags: ["legal_threat"] }),
      [answerMatch],
      {},
    );

    for (const result of [byRetrieval, byFlag]) {
      expect(result.finalAction).toBe("request_handoff_intake");
      expect(result.ui.primitive).toBe("intake_form");
      expect(result.safetyFlags.length).toBeGreaterThan(0);
      expect(result.validatorOverrides).toContainEqual(
        expect.objectContaining({
          code: expect.stringMatching(/vulnerability|safety/),
          toAction: "request_handoff_intake",
        }),
      );
    }
  });

  it("does not route to handoff when a vulnerability item is only a lower-ranked retrieval candidate", () => {
    // A calm, answerable question whose top/cited match is an answer item must not
    // inherit a vulnerability route from an unrelated vulnerability item swept into
    // the broad retrieval candidate set. Vulnerability routes only when it is the
    // selected/top match or the planner sets a genuine vulnerability-family flag.
    const result = validateTurnPlan(
      plan(),
      [answerMatch, vulnerabilityMatch],
      {},
    );

    expect(result.finalAction).toBe("answer");
    expect(result.selectedServingMode).toBe("answer");
    expect(result.validatorOverrides).toEqual([]);
    expect(result.safetyFlags).not.toContain("vulnerability");
  });

  it("overrides forbidden credential requests and never requests forbidden fields", () => {
    const result = validateTurnPlan(
      plan({
        action: "request_handoff_intake",
        customerMessage:
          "Please send your sort code, account number, and CVV so we can update this.",
        ui: {
          primitive: "intake_form",
          message:
            "Please send your sort code, account number, and CVV so we can update this.",
          fields: ["fullName", "email"],
        },
        requestedFields: ["fullName", "email"],
      }),
      [handoffMatch],
      {},
    );

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.customerMessage).not.toMatch(/sort code|account number|cvv/i);
    expect(result.ui).toMatchObject({
      primitive: "intake_form",
      fields: standardHandoffFields,
    });
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "forbidden_credential_request_blocked",
      }),
    );
  });

  it("treats requests for bank details as forbidden credential collection", () => {
    const result = validateTurnPlan(
      handoffPlan({
        customerMessage: "Please send your bank details so we can update this.",
        ui: {
          primitive: "intake_form",
          message: "Please send your bank details so we can update this.",
          fields: ["fullName", "email"],
        },
        requestedFields: ["fullName", "email"],
      }),
      [handoffMatch],
      {},
    );

    expect(result.customerMessage).not.toMatch(/bank details/i);
    expect(result.safetyFlags).toContain("forbidden_credentials");
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "forbidden_credential_request_blocked",
      }),
    );
  });

  it("allows safe warnings not to share credentials", () => {
    const result = validateTurnPlan(
      plan({
        customerMessage:
          "Open Banking is secure. Never share online banking passwords or card details in chat.",
        ui: {
          primitive: "message",
          message:
            "Open Banking is secure. Never share online banking passwords or card details in chat.",
          links: [],
        },
      }),
      [answerMatch],
      {},
    );

    expect(result.finalAction).toBe("answer");
    expect(result.validatorOverrides).toEqual([]);
  });

  it("overrides promised account-specific values and outcomes", () => {
    const result = validateTurnPlan(
      plan({
        customerMessage:
          "Your balance is GBP 425 and your approval is guaranteed today.",
        ui: {
          primitive: "message",
          message:
            "Your balance is GBP 425 and your approval is guaranteed today.",
          links: [],
        },
      }),
      [handoffMatch],
      {},
    );

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.customerMessage).not.toContain("GBP 425");
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "account_specific_promise_blocked",
      }),
    );
  });

  it("accepts a compliant account-specific handoff without counting a validator rescue", () => {
    const result = validateTurnPlan(handoffPlan(), [changeRequestMatch], {});

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.selectedServingMode).toBe("handoff_account_specific");
    expect(result.safetyFlags).toEqual(
      expect.arrayContaining(["account_specific_request", "change_request"]),
    );
    expect(result.validatorOverrides).toEqual([]);
  });

  it("does not treat safe handoff wording as an account-specific promise", () => {
    const result = validateTurnPlan(
      handoffPlan({
        customerMessage:
          "I cannot change your payment date in chat, but I can pass this to the team.",
        ui: {
          primitive: "intake_form",
          message:
            "I cannot change your payment date in chat, but I can pass this to the team.",
          fields: standardHandoffFields,
        },
      }),
      [changeRequestMatch],
      {},
    );

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.validatorOverrides).toEqual([]);
  });

  it("still blocks definite account-specific promises in handoff copy", () => {
    const result = validateTurnPlan(
      handoffPlan({
        customerMessage: "Your payment date has been changed.",
        ui: {
          primitive: "intake_form",
          message: "Your payment date has been changed.",
          fields: standardHandoffFields,
        },
      }),
      [changeRequestMatch],
      {},
    );

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.customerMessage).not.toMatch(/has been changed/i);
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "account_specific_promise_blocked",
      }),
    );
  });

  it("blocks active promises to change account settings", () => {
    const result = validateTurnPlan(
      handoffPlan({
        customerMessage: "We will move your payment date for you.",
        ui: {
          primitive: "intake_form",
          message: "We will move your payment date for you.",
          fields: standardHandoffFields,
        },
      }),
      [changeRequestMatch],
      {},
    );

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.customerMessage).not.toMatch(/move your payment date/i);
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "account_specific_promise_blocked",
      }),
    );
  });

  it("blocks contracted active promises to change account settings", () => {
    const result = validateTurnPlan(
      handoffPlan({
        customerMessage: "I'll update your payment date for you.",
        ui: {
          primitive: "intake_form",
          message: "I'll update your payment date for you.",
          fields: standardHandoffFields,
        },
      }),
      [changeRequestMatch],
      {},
    );

    expect(result.customerMessage).not.toMatch(/update your payment date/i);
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "account_specific_promise_blocked",
      }),
    );
  });

  it("blocks first-person account-change promises", () => {
    const result = validateTurnPlan(
      handoffPlan({
        customerMessage: "I've changed your payment date.",
        ui: {
          primitive: "intake_form",
          message: "I've changed your payment date.",
          fields: standardHandoffFields,
        },
      }),
      [changeRequestMatch],
      {},
    );

    expect(result.customerMessage).not.toMatch(/changed your payment date/i);
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "account_specific_promise_blocked",
      }),
    );
  });

  it("accepts a compliant vulnerability handoff without counting a validator rescue", () => {
    const result = validateTurnPlan(handoffPlan(), [vulnerabilityMatch], {});

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.selectedServingMode).toBe("route_vulnerability");
    expect(result.safetyFlags).toContain("vulnerability");
    expect(result.validatorOverrides).toEqual([]);
  });

  it("accepts a compliant excluded refusal without counting a validator rescue", () => {
    const result = validateTurnPlan(refusalPlan(), [excludedMatch], {});

    expect(result.finalAction).toBe("refuse");
    expect(result.selectedServingMode).toBe("excluded");
    expect(result.validatorOverrides).toEqual([]);
  });

  it("does not accept excluded refusal that still gives regulated advice", () => {
    const result = validateTurnPlan(
      refusalPlan({
        customerMessage: "You should enter an IVA for this debt.",
        ui: {
          primitive: "safe_fallback",
          message: "You should enter an IVA for this debt.",
          links: [],
        },
      }),
      [excludedMatch],
      {},
    );

    expect(result.finalAction).toBe("refuse");
    expect(result.customerMessage).not.toMatch(/should enter/i);
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "non_answer_citation_blocked",
      }),
    );
  });

  it("does not accept excluded refusal that explains regulated IVA effects", () => {
    const result = validateTurnPlan(
      refusalPlan({
        customerMessage:
          "I cannot advise you, but an IVA lets you make one affordable monthly payment and may write off some debt.",
        ui: {
          primitive: "safe_fallback",
          message:
            "I cannot advise you, but an IVA lets you make one affordable monthly payment and may write off some debt.",
          links: [],
        },
      }),
      [excludedMatch],
      {},
    );

    expect(result.customerMessage).not.toMatch(/affordable monthly payment/i);
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "non_answer_citation_blocked",
      }),
    );
  });

  it("routes vulnerability safety flags ahead of excluded refusal", () => {
    const result = validateTurnPlan(
      refusalPlan({
        safetyFlags: ["distress"],
      }),
      [excludedMatch],
      {},
    );

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.ui.primitive).toBe("intake_form");
    expect(result.safetyFlags).toEqual(
      expect.arrayContaining(["distress", "vulnerability"]),
    );
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "safety_flag_route_to_handoff",
        toAction: "request_handoff_intake",
      }),
    );
  });

  it("flags obvious sensitive overshare from the inbound customer message", () => {
    const result = validateTurnPlan(handoffPlan(), [handoffMatch], {
      userMessage:
        "Here are my bank details and date of birth, please fix my payment.",
    });

    expect(result.safetyFlags).toEqual(
      expect.arrayContaining(["forbidden_credentials", "sensitive_overshare"]),
    );
  });

  it("flags natural sensitive overshare phrasing from the inbound customer message", () => {
    const result = validateTurnPlan(handoffPlan(), [handoffMatch], {
      userMessage:
        "My DOB is 1 January 1980 and my account number is 12345678.",
    });

    expect(result.safetyFlags).toEqual(
      expect.arrayContaining(["forbidden_credentials", "sensitive_overshare"]),
    );
  });

  it("preserves language-barrier signals without forcing handoff", () => {
    const result = validateTurnPlan(
      plan({
        action: "ask_clarifying_question",
        customerMessage: "I can help. What would you like to do?",
        ui: {
          primitive: "clarifying_prompt",
          message: "I can help. What would you like to do?",
          questions: ["What would you like help with?"],
        },
        grounding: null,
      }),
      [answerMatch],
      {
        userMessage: "English hard for me.",
      },
    );

    expect(result.finalAction).toBe("ask_clarifying_question");
    expect(result.safetyFlags).toContain("language_barrier");
    expect(result.validatorOverrides).toEqual([]);
  });

  it("routes strong accessibility needs through the existing human handoff lane", () => {
    const result = validateTurnPlan(plan(), [answerMatch], {
      userMessage: "I cannot read the form because of my disability.",
    });

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.safetyFlags).toEqual(
      expect.arrayContaining(["accessibility_need", "vulnerability"]),
    );
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "safety_flag_route_to_handoff",
        toAction: "request_handoff_intake",
      }),
    );
  });

  it("overrides promised outcomes even when an answer item is retrieved", () => {
    const result = validateTurnPlan(
      plan({
        customerMessage:
          "Your application is approved and your funds will arrive today.",
        ui: {
          primitive: "message",
          message:
            "Your application is approved and your funds will arrive today.",
          links: [],
        },
      }),
      [answerMatch],
      {},
    );

    expect(result.finalAction).toBe("fallback");
    expect(result.customerMessage).not.toMatch(/approved|today/i);
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "account_specific_promise_blocked",
      }),
    );
  });

  it("blocks forbidden credential facts before they reach state", () => {
    const result = validateTurnPlan(
      plan({
        action: "request_handoff_intake",
        customerMessage: "I can pass this to the team.",
        ui: {
          primitive: "intake_form",
          message: "I can pass this to the team.",
          fields: ["fullName", "email"],
        },
        collectedFacts: {
          sortCode: "00-00-00",
          accountNumber: "12345678",
        },
        requestedFields: ["fullName", "email"],
      }),
      [handoffMatch],
      {},
    );

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.collectedFacts).toEqual({});
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "forbidden_credential_request_blocked",
      }),
    );
  });

  it("preserves excluded route reason when overriding", () => {
    const result = validateTurnPlan(
      plan({
        grounding: {
          citedItemIds: ["apr-1"],
          servingMode: "excluded",
          confidence: "supported",
        },
      }),
      [excludedMatch],
      {},
    );

    expect(result.finalAction).toBe("refuse");
    expect(result.selectedServingMode).toBe("excluded");
    expect(result.selectedRouteReason).toBe(
      "Personalised pricing must not be served by the bot.",
    );
  });

  it("forces excluded matches to refusal even when the plan asks a substantive clarification", () => {
    const result = validateTurnPlan(
      plan({
        action: "ask_clarifying_question",
        customerMessage:
          "What APR range would you like me to compare against other lenders?",
        ui: {
          primitive: "clarifying_prompt",
          message:
            "What APR range would you like me to compare against other lenders?",
          questions: ["Which lender should I compare Loanslam with?"],
        },
        grounding: null,
      }),
      [excludedMatch],
      {},
    );

    expect(result.finalAction).toBe("refuse");
    expect(result.customerMessage).not.toMatch(/compare against/i);
    expect(result.selectedRouteReason).toBe(
      "Personalised pricing must not be served by the bot.",
    );
  });

  it("safely overrides a UI primitive that does not match the final action", () => {
    const result = validateTurnPlan(
      plan({
        action: "answer",
        ui: {
          primitive: "intake_form",
          message: "Give us your contact details.",
          fields: ["fullName"],
        },
      }),
      [answerMatch],
      {},
    );

    expect(result.finalAction).toBe("fallback");
    expect(result.ui.primitive).toBe("safe_fallback");
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "ui_action_mismatch",
      }),
    );
  });
});
