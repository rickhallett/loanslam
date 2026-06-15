export interface ScenarioPlan {
  customerGoal: string;
  firstCustomerMessage: string;
  terminalCondition: string;
  constraints: string[];
  syntheticHandoffDetails: string;
  blockedInputs: string[];
  willSendTurns: false;
}

const syntheticHandoffDetails =
  "Full name: Alex Test. Date of birth: 1 January 1990. Address: 1 Test Street, London, SW1A 1AA. Phone: 07123 456789. Email: alex.test@example.com. Situation summary: please help with my account request.";

const baseConstraints = [
  "Use direct lab API calls only.",
  "Send exactly one customer message, then inspect the response and full session before choosing another turn.",
  "Use clearly synthetic handoff details only.",
  "Do not provide bank credentials, card data, payment credentials, or real customer PII.",
];

export function planScenario(brief: string): ScenarioPlan {
  const normalizedBrief = brief.trim();

  if (!normalizedBrief) {
    throw new Error("Scenario brief must be a non-empty string.");
  }

  const lower = normalizedBrief.toLowerCase();
  const blockedInputs = detectBlockedInputs(lower);
  const classification = classifyBrief(lower);
  const firstCustomerMessage =
    blockedInputs.length > 0
      ? "I need help with my account, but I should not share bank or card details here."
      : classification.firstCustomerMessage;

  return {
    customerGoal: classification.customerGoal,
    firstCustomerMessage,
    terminalCondition: classification.terminalCondition,
    constraints:
      blockedInputs.length > 0
        ? [
            ...baseConstraints,
            "Rewrite any requested credential-sharing turn into a safe handoff request.",
          ]
        : baseConstraints,
    syntheticHandoffDetails,
    blockedInputs,
    willSendTurns: false,
  };
}

function classifyBrief(brief: string): {
  customerGoal: string;
  firstCustomerMessage: string;
  terminalCondition: string;
} {
  if (
    brief.includes("update") ||
    brief.includes("change") ||
    brief.includes("balance") ||
    brief.includes("settlement") ||
    brief.includes("repayment date") ||
    brief.includes("status")
  ) {
    return {
      customerGoal: "Route an account-specific or change request to handoff.",
      firstCustomerMessage: accountFirstMessage(brief),
      terminalCondition:
        "Stop when the session has finalAction=create_ticket or a clear handoff/intake route with account-specific serving mode.",
    };
  }

  if (
    brief.includes("hardship") ||
    brief.includes("cannot afford") ||
    brief.includes("struggling") ||
    brief.includes("vulnerable") ||
    brief.includes("distress")
  ) {
    return {
      customerGoal:
        "Route hardship or vulnerability support before normal routing.",
      firstCustomerMessage: "I cannot afford my repayment this month.",
      terminalCondition:
        "Stop when the trace shows route_vulnerability or a vulnerability safety flag with safe human support copy.",
    };
  }

  if (
    brief.includes("complaint") ||
    brief.includes("legal") ||
    brief.includes("formal")
  ) {
    return {
      customerGoal:
        "Route complaint or legal-threat language safely to human support.",
      firstCustomerMessage:
        "I want to make a complaint and I want it treated formally.",
      terminalCondition:
        "Stop when the trace shows complaint or legal-threat evidence and the customer copy preserves human handling.",
    };
  }

  if (
    brief.includes("iva") ||
    brief.includes("debt management") ||
    brief.includes("debt plan")
  ) {
    return {
      customerGoal: "Refuse or signpost an excluded regulated-advice topic.",
      firstCustomerMessage: "Should I enter an IVA for this debt?",
      terminalCondition:
        "Stop when selectedServingMode=excluded and the answer does not recommend a debt solution.",
    };
  }

  return {
    customerGoal: "Answer a grounded public or operational FAQ.",
    firstCustomerMessage: faqFirstMessage(brief),
    terminalCondition:
      "Stop when finalAction=answer and selectedServingMode=answer with grounded customer-facing copy.",
  };
}

function accountFirstMessage(brief: string): string {
  if (brief.includes("phone")) {
    return "I need to update the phone number on my account.";
  }

  if (brief.includes("email")) {
    return "I need to update the email address on my account.";
  }

  if (brief.includes("balance")) {
    return "What is my balance?";
  }

  if (brief.includes("settlement")) {
    return "What is my settlement figure today?";
  }

  if (brief.includes("repayment date")) {
    return "Can you change my repayment date to next Friday?";
  }

  if (brief.includes("status")) {
    return "Can you tell me if my application has been approved?";
  }

  return "I need to change something on my loan application.";
}

function faqFirstMessage(brief: string): string {
  if (brief.includes("apply") || brief.includes("application")) {
    return "How do I apply online?";
  }

  if (brief.includes("credit score") || brief.includes("quote")) {
    return "Will checking a quote affect my credit score?";
  }

  return "What is LoanSlam?";
}

function detectBlockedInputs(brief: string): string[] {
  const checks: Array<[string, RegExp]> = [
    ["bank credentials", /\bbank (login|password|credential)s?\b/],
    ["card data", /\b(card number|cvv|cvc)\b/],
    ["payment credentials", /\bpayment credential/],
    ["sort code", /\bsort code\b/],
    ["account number", /\baccount number\b/],
  ];

  return checks
    .filter(([, pattern]) => pattern.test(brief))
    .map(([label]) => label);
}
