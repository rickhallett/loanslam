import {
  turnActionSchema,
  uiPrimitiveSchema,
  type ApprovedLink,
  type IntakeField,
  type SafetyFlag,
  type TurnAction,
  type UiPlan,
  type UiPrimitive,
} from "@loanslam/contracts";

export const policyVersion = "phase0-turnplanner-policy-v1";

export const allowedActions = [...turnActionSchema.options];
export const allowedUiPrimitives = [...uiPrimitiveSchema.options];

// The "handoff family": the three actions that route a turn into human handoff
// (collect intake, raise a ticket, or escalate). Named once so the recurring
// three-way action check reads as a single concept rather than being
// re-derived at each call site.
export const handoffFamilyActions = [
  "request_handoff_intake",
  "create_ticket",
  "escalate",
] as const satisfies readonly TurnAction[];

export function isHandoffFamilyAction(action: TurnAction | undefined): boolean {
  if (action === undefined) {
    return false;
  }
  const familyActions: readonly TurnAction[] = handoffFamilyActions;
  return familyActions.includes(action);
}

export const standardHandoffFields = [
  "fullName",
  "dateOfBirth",
  "postcode",
  "email",
  "phone",
] as const satisfies readonly IntakeField[];

export const vulnerabilitySafetyFlags = [
  "vulnerability",
  "distress",
  "hardship",
  "complaint",
  "legal_threat",
  "accessibility_need",
] as const satisfies readonly SafetyFlag[];

export const handoffSafetyFlags = [
  "account_specific_request",
  "change_request",
] as const satisfies readonly SafetyFlag[];

const uiPrimitivesByAction = {
  answer: ["message"],
  ask_clarifying_question: ["clarifying_prompt", "choice_list"],
  request_handoff_intake: ["intake_form"],
  create_ticket: ["handoff_confirmation"],
  escalate: ["intake_form", "handoff_confirmation"],
  refuse: ["safe_fallback"],
  fallback: ["safe_fallback"],
} as const satisfies Record<TurnAction, readonly UiPrimitive[]>;

const forbiddenCredentialTermPattern =
  /\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*(code|answer)|one[-\s]?time\s*(pass)?code|\botp\b|passcode|pin|password|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|banking\s+app\s+screenshot|payment\s+credentials?)\b/i;

const credentialCollectionPattern =
  /\b(send|share|provide|enter|give|confirm|tell|submit|type|write|upload|attach)\b.{0,80}\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*(code|answer)|one[-\s]?time\s*(pass)?code|\botp\b|passcode|pin|password|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|banking\s+app\s+screenshot|payment\s+credentials?)\b/i;

const credentialWarningPattern =
  /\b(never|do\s+not|don't|dont|should\s+not|must\s+not)\s+(send|share|provide|enter|give|confirm|tell|submit|type|write|upload|attach)\b.{0,80}\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*(code|answer)|one[-\s]?time\s*(pass)?code|\botp\b|passcode|pin|password|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|banking\s+app\s+screenshot|payment\s+credentials?)\b/i;

const accountValueStatementPattern =
  /\b(your\s+)?(balance|settlement\s+figure|next\s+payment\s+date|repayment\s+date|interest\s+rate|apr|application\s+result)\s+(is|are|was|were|will\s+be|has\s+been|equals?)\b/i;

const accountChangePromisePattern =
  /\b(your\s+)?(payment\s+date|repayment\s+date|payment\s+change|reduced\s+payment)\b.{0,80}\b(has\s+been|is|will\s+be|was)\s+(changed|moved|set|updated|confirmed|approved)\b|\b(has\s+been|is|will\s+be|was)\s+(changed|moved|set|updated|confirmed|approved)\b.{0,80}\b(your\s+)?(payment\s+date|repayment\s+date|payment\s+change|reduced\s+payment)\b|\b(i('ve|'ll|\s+have|\s+will)?|we('ve|'ll|\s+have|\s+will)?|we|the\s+team)\s+(will\s+)?(change|changed|move|moved|set|updated|update|confirm|confirmed|approve|approved)\b.{0,80}\b(your\s+)?(payment\s+date|repayment\s+date|payment\s+change|reduced\s+payment)\b/i;

const accountMutationPromisePattern =
  /\b(i|we)\s+(am|are|'m|'re)?\s*(going\s+to|will|'ll)\s+(submit|process|action|apply|complete)\b.{0,120}\b(update|change|cancel|withdraw|amend)\b.{0,80}\b(address|phone|email|contact\s+details?|application|account|loan|bank\s+details?)\b|\b(i|we)\s+(am|are|'m|'re)?\s*(going\s+to|will|'ll)\s+(update|change|cancel|withdraw|amend)\b.{0,100}\b(address|phone|email|contact\s+details?|application|account|loan|bank\s+details?)\b/i;

const approvalPromisePattern =
  /\b(your\s+)?(application|loan|request)\s+(is|was|has\s+been|will\s+be)\s+(approved|accepted|guaranteed)\b|\byou\s+(are|were|have\s+been|will\s+be)\s+(approved|accepted|guaranteed)\b|\b(approval|application\s+result)\s+(is|was|has\s+been|will\s+be)\s+(approved|accepted|guaranteed)\b|\b(approved|accepted|guaranteed)\s+(today|now|already)\b|\b(will\s+be\s+paid|will\s+receive\s+funds)\b/i;

const sensitiveOversharePattern =
  /\b(here\s+(are|is)|i\s+(can|could|will|'ll)\s+(send|share|give|provide|upload|attach)|let\s+me\s+(send|share|give|provide|upload|attach))\b.{0,120}\b(bank\s+details?|sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*(code|answer)|one[-\s]?time\s*(pass)?code|\botp\b|passcode|pin|password|online\s+banking\s+(login|password|credentials)|bank\s+(login|password)|banking\s+app\s+screenshot|date\s+of\s+birth|dob)\b|\b(my\s+)?(bank\s+details?|sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*(code|answer)|one[-\s]?time\s*(pass)?code|\botp\b|passcode|pin|password|banking\s+app\s+screenshot|date\s+of\s+birth|dob)\s*(is|are|:)\b/i;

const internalDataExposurePattern =
  /\b(show|give|send|dump|display|reveal|print|list|export)\b.{0,100}\b(trace|traces|hidden\s+(prompt|instruction|instructions|internal|internals)|system\s+prompt|developer\s+message|customer\s+data|other\s+customers?|conversation\s+logs?|audit\s+logs?|internal\s+(state|data|notes|reasoning|log|logs))\b|\b(ignore\s+(the\s+)?policy|bypass\s+(compliance|policy|rules)|compliance\s+bypass|pretend\s+you\s+are\s+(staff|admin|agent))\b/i;

const secondaryBorrowingAdvicePattern =
  /\bshould\s+i\b.{0,80}\bborrow\b.{0,80}\b(another|other|different)\s+lender\b|\bborrow\b.{0,80}\b(another|other|different)\s+lender\b.{0,80}\b(pay|repay|cover|clear)\b/i;

const credentialBoundaryQuestionPattern =
  /\b(?:should|can|could|do)\s+i\b.{0,100}\b(send|share|provide|give|upload|submit|tell|enter)\b.{0,100}\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*(code|answer)|one[-\s]?time\s*(pass)?code|\botp\b|passcode|pin|password|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|banking\s+app\s+screenshot|payment\s+credentials?)\b|\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*(code|answer)|one[-\s]?time\s*(pass)?code|\botp\b|passcode|pin|password|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|banking\s+app\s+screenshot|payment\s+credentials?)\b.{0,100}\b(?:should|can|could|do)\s+i\b.{0,100}\b(send|share|provide|give|upload|submit|tell|enter)\b|\b(?:upload|send|share|attach)\b.{0,80}\b(screenshot|screen\s*shot)\b.{0,80}\b(bank|banking|app|online\s+banking)\b|\b(screenshot|screen\s*shot)\b.{0,80}\b(bank|banking|app|online\s+banking)\b.{0,80}\b(?:upload|send|share|attach)\b/i;

const paymentLinkRequestPattern =
  /\b(send|give|provide|get|need|want|create|generate)\b.{0,80}\bpayment\s+link\b|\bpayment\s+link\b.{0,80}\b(now|right\s+now|send|give|provide|get|need|want|create|generate)\b/i;

export function allowedUiPrimitivesForAction(
  action: TurnAction,
): readonly UiPrimitive[] {
  return uiPrimitivesByAction[action];
}

export function uiMatchesAction(action: TurnAction, ui: UiPlan): boolean {
  return allowedUiPrimitivesForAction(action).includes(ui.primitive);
}

export function hasVulnerabilitySafetyFlag(
  flags: readonly SafetyFlag[],
): boolean {
  const vulnerabilityFlags: readonly SafetyFlag[] = vulnerabilitySafetyFlags;
  return flags.some((flag) => vulnerabilityFlags.includes(flag));
}

export function hasHandoffSafetyFlag(flags: readonly SafetyFlag[]): boolean {
  const routeFlags: readonly SafetyFlag[] = handoffSafetyFlags;
  return flags.some((flag) => routeFlags.includes(flag));
}

export function detectForbiddenCredentialRequest(text: string): boolean {
  if (credentialWarningPattern.test(text)) {
    return false;
  }

  return credentialCollectionPattern.test(text);
}

export function containsForbiddenCredentialTerm(text: string): boolean {
  return forbiddenCredentialTermPattern.test(text);
}

export function detectPromisedAccountValueOrOutcome(text: string): boolean {
  return (
    accountValueStatementPattern.test(text) ||
    accountChangePromisePattern.test(text) ||
    accountMutationPromisePattern.test(text) ||
    approvalPromisePattern.test(text)
  );
}

export function detectSensitiveOvershare(text: string): boolean {
  return sensitiveOversharePattern.test(text);
}

export function detectInternalDataExposureRequest(text: string): boolean {
  return internalDataExposurePattern.test(text);
}

export function detectSecondaryBorrowingAdviceRequest(text: string): boolean {
  return secondaryBorrowingAdvicePattern.test(text);
}

export function detectCredentialBoundaryRequest(text: string): boolean {
  return credentialBoundaryQuestionPattern.test(text);
}

export function detectPaymentLinkRequest(text: string): boolean {
  return paymentLinkRequestPattern.test(text);
}

export function buildFallbackCopy(reason: string): {
  action: "fallback";
  customerMessage: string;
  ui: UiPlan;
} {
  const customerMessage =
    "I cannot answer that safely from the information available here. I can pass this to the LoanSlam team so they can help.";

  return {
    action: "fallback",
    customerMessage,
    ui: {
      primitive: "safe_fallback",
      message: `${customerMessage} ${reason}`,
      links: [],
    },
  };
}

export function buildInternalDataBoundaryCopy(reason: string): {
  action: "refuse";
  customerMessage: string;
  ui: UiPlan;
} {
  const customerMessage =
    "I cannot share internal traces, hidden instructions, or customer data in chat. I can help with general LoanSlam questions or pass a request to the team.";

  return {
    action: "refuse",
    customerMessage,
    ui: {
      primitive: "safe_fallback",
      message: `${customerMessage} ${reason}`,
      links: [],
    },
  };
}

export function buildHandoffCopy(reason: string): {
  action: "request_handoff_intake";
  customerMessage: string;
  ui: UiPlan;
  requestedFields: IntakeField[];
} {
  const customerMessage =
    "I cannot handle that directly in chat. I can collect a few contact details and pass this to the LoanSlam team.";

  return {
    action: "request_handoff_intake",
    customerMessage,
    ui: {
      primitive: "intake_form",
      message: `${customerMessage} ${reason}`,
      fields: [...standardHandoffFields],
    },
    requestedFields: [...standardHandoffFields],
  };
}

export function buildCredentialHandoffCopy(): {
  action: "request_handoff_intake";
  customerMessage: string;
  ui: UiPlan;
  requestedFields: IntakeField[];
} {
  const customerMessage =
    "Do not send bank login details, passwords, sort codes, account numbers, card details, security answers, one-time passcodes, or banking-app screenshots in this chat. I can collect standard contact details and pass this to the LoanSlam team.";

  return {
    action: "request_handoff_intake",
    customerMessage,
    ui: {
      primitive: "intake_form",
      message: customerMessage,
      fields: [...standardHandoffFields],
    },
    requestedFields: [...standardHandoffFields],
  };
}

export function buildPaymentLinkHandoffCopy(): {
  action: "request_handoff_intake";
  customerMessage: string;
  ui: UiPlan;
  requestedFields: IntakeField[];
} {
  const customerMessage =
    "I can't create or send a payment link in this chat. I can collect standard contact details and pass this to the LoanSlam team.";

  return {
    action: "request_handoff_intake",
    customerMessage,
    ui: {
      primitive: "intake_form",
      message: customerMessage,
      fields: [...standardHandoffFields],
    },
    requestedFields: [...standardHandoffFields],
  };
}

export function buildVulnerabilityCopy(reason: string): {
  action: "request_handoff_intake";
  customerMessage: string;
  ui: UiPlan;
  requestedFields: IntakeField[];
} {
  const customerMessage =
    "I am sorry you are dealing with this. I can pass this to the LoanSlam team so a person can help you carefully.";

  return {
    action: "request_handoff_intake",
    customerMessage,
    ui: {
      primitive: "intake_form",
      message: `${customerMessage} ${reason}`,
      fields: [...standardHandoffFields],
    },
    requestedFields: [...standardHandoffFields],
  };
}

export function buildExcludedCopy(
  reason: string,
  links: readonly ApprovedLink[] = [],
): {
  action: "refuse";
  customerMessage: string;
  ui: UiPlan;
} {
  const customerMessage =
    "I cannot answer that in chat. I can signpost general information or pass this to the LoanSlam team.";

  return {
    action: "refuse",
    customerMessage,
    ui: {
      primitive: "safe_fallback",
      message: `${customerMessage} ${reason}`,
      links: [...links],
    },
  };
}

export function buildSecondaryBorrowingBoundaryCopy(): {
  action: "refuse";
  customerMessage: string;
  ui: UiPlan;
} {
  const links = [
    { label: "StepChange", href: "https://www.stepchange.org" },
    {
      label: "MoneyHelper",
      href: "https://www.moneyhelper.org.uk/debt-advice-locator",
    },
  ] as const satisfies readonly ApprovedLink[];
  const customerMessage =
    "I can't advise you on whether to borrow from another lender. Free, impartial debt advice is available from StepChange or MoneyHelper, and the LoanSlam team can discuss your existing account.";

  return {
    action: "refuse",
    customerMessage,
    ui: {
      primitive: "safe_fallback",
      message: customerMessage,
      links: [...links],
    },
  };
}
