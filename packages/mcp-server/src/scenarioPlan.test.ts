import { describe, expect, it } from "vitest";

import { planScenario } from "./scenarioPlan";

describe("scenario planning", () => {
  it("plans a handoff scenario without sending turns", () => {
    expect(planScenario("customer needs to update phone number")).toMatchObject(
      {
        customerGoal: "Route an account-specific or change request to handoff.",
        firstCustomerMessage:
          "I need to update the phone number on my account.",
        willSendTurns: false,
      },
    );
  });

  it("plans an answerable FAQ scenario", () => {
    expect(planScenario("apply for a loan")).toMatchObject({
      firstCustomerMessage: "How do I apply online?",
      terminalCondition:
        "Stop when finalAction=answer and selectedServingMode=answer with grounded customer-facing copy.",
    });
  });

  it("blocks credential-sharing briefs", () => {
    const plan = planScenario("customer wants to provide card number and CVV");

    expect(plan.blockedInputs).toEqual(["card data"]);
    expect(plan.firstCustomerMessage).not.toContain("CVV");
    expect(plan.constraints).toContain(
      "Rewrite any requested credential-sharing turn into a safe handoff request.",
    );
  });
});
