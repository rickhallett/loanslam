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

/**
 * [NODE:policy-core]
 * Deterministic policy constants, regex backstops, and approved fallback copy.
 * Grep `[NODE:policy-` to find hard safety decisions outside the model.
 */

export const policyVersion = "phase0-turnplanner-policy-v1";

export const allowedActions = [...turnActionSchema.options];
export const allowedUiPrimitives = [...uiPrimitiveSchema.options];

/**
 * [NODE:policy-handoff-fields]
 * Canonical intake fields for Phase 0 handoff simulations and lab sessions.
 */
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
  /\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*code|security\s+answer|one[-\s]?time\s+(pass\s*)?(code|codes|passcode|passcodes)|otp|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|payment\s+credentials?|banking\s+app\s+screenshot|screenshot\s+of\s+(my\s+)?banking\s+app|screenshot\s+from\s+(my\s+)?bank(ing)?\s+app)\b/i;

const credentialCollectionPattern =
  /\b(send|share|provide|enter|give|confirm|tell|submit|type|write|upload|take)\b.{0,80}\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*code|security\s+answer|one[-\s]?time\s+(pass\s*)?(code|codes|passcode|passcodes)|otp|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|payment\s+credentials?|banking\s+app\s+screenshot|screenshot\s+of\s+(my\s+)?banking\s+app|screenshot\s+from\s+(my\s+)?bank(ing)?\s+app)\b/i;

const credentialOfferPattern =
  /\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*code|security\s+answer|one[-\s]?time\s+(pass\s*)?(code|codes|passcode|passcodes)|otp|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|payment\s+credentials?|banking\s+app\s+screenshot|screenshot\s+of\s+(my\s+)?banking\s+app|screenshot\s+from\s+(my\s+)?bank(ing)?\s+app)\b.{0,100}\b(should\s+i|can\s+i|could\s+i|i\s+can|i\s+could|i\s+will|i'll|let\s+me)\s+(send|share|provide|enter|give|confirm|tell|submit|type|write|upload|take)\b/i;

const credentialWarningPattern =
  /\b(never|do\s+not|don't|dont|should\s+not|must\s+not)\s+(send|share|provide|enter|give|confirm|tell|submit|type|write|upload|take)\b.{0,80}\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*code|security\s+answer|one[-\s]?time\s+(pass\s*)?(code|codes|passcode|passcodes)|otp|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|payment\s+credentials?|banking\s+app\s+screenshot|screenshot\s+of\s+(my\s+)?banking\s+app|screenshot\s+from\s+(my\s+)?bank(ing)?\s+app)\b/i;

const accountValueStatementPattern =
  /\b(your\s+)?(balance|settlement\s+figure|next\s+payment\s+date|repayment\s+date|interest\s+rate|apr|application\s+result)\s+(is|are|was|were|will\s+be|has\s+been|equals?)\b/i;

const accountChangePromisePattern =
  /\b(your\s+)?(payment\s+date|repayment\s+date|payment\s+change|reduced\s+payment)\b.{0,80}\b(has\s+been|is|will\s+be|was)\s+(changed|moved|set|updated|confirmed|approved)\b|\b(has\s+been|is|will\s+be|was)\s+(changed|moved|set|updated|confirmed|approved)\b.{0,80}\b(your\s+)?(payment\s+date|repayment\s+date|payment\s+change|reduced\s+payment)\b|\b(i('ve|'ll|\s+have|\s+will)?|we('ve|'ll|\s+have|\s+will)?|we|the\s+team)\s+(will\s+)?(change|changed|move|moved|set|updated|update|confirm|confirmed|approve|approved)\b.{0,80}\b(your\s+)?(payment\s+date|repayment\s+date|payment\s+change|reduced\s+payment)\b/i;

const accountMutationPromisePattern =
  /\b(i|we)\s+(am|are|'m|'re)?\s*(going\s+to|will|'ll)\s+(submit|process|action|apply|complete)\b.{0,120}\b(update|change|cancel|withdraw|amend)\b.{0,80}\b(address|phone|email|contact\s+details?|application|account|loan|bank\s+details?)\b|\b(i|we)\s+(am|are|'m|'re)?\s*(going\s+to|will|'ll)\s+(update|change|cancel|withdraw|amend)\b.{0,100}\b(address|phone|email|contact\s+details?|application|account|loan|bank\s+details?)\b/i;

const approvalPromisePattern =
  /\b(your\s+)?(application|loan|request)\s+(is|was|has\s+been|will\s+be)\s+(approved|accepted|guaranteed)\b|\byou\s+(are|were|have\s+been|will\s+be)\s+(approved|accepted|guaranteed)\b|\b(approval|application\s+result)\s+(is|was|has\s+been|will\s+be)\s+(approved|accepted|guaranteed)\b|\b(approved|accepted|guaranteed)\s+(today|now|already)\b|\b(will\s+be\s+paid|will\s+receive\s+funds)\b/i;

const sensitiveOversharePattern =
  /\b(here\s+(are|is)|i\s+(can|could|will|'ll)\s+(send|share|give|provide)|let\s+me\s+(send|share|give|provide))\b.{0,120}\b(bank\s+details?|sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*code|online\s+banking\s+(login|password|credentials)|bank\s+(login|password)|date\s+of\s+birth|dob)\b|\b(my\s+)?(bank\s+details?|sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*code|date\s+of\s+birth|dob)\s*(is|are|:)\b/i;

const internalDataExposurePattern =
  /\b(show|give|send|dump|display|reveal|print|list|export)\b.{0,100}\b(trace|traces|hidden\s+(prompt|instruction|instructions|internal|internals)|system\s+prompt|developer\s+message|customer\s+data|other\s+customers?|conversation\s+logs?|audit\s+logs?|internal\s+(state|data|notes|reasoning|log|logs))\b|\b(ignore\s+(the\s+)?policy|bypass\s+(compliance|policy|rules)|compliance\s+bypass|pretend\s+you\s+are\s+(staff|admin|agent))\b/i;

const emergencyCrisisPattern =
  /\b(chest\s+pain|heart\s+attack|stroke|can't\s+breathe|cannot\s+breathe|struggling\s+to\s+breathe|medical\s+emergency|ambulance|a\s*&\s*e|a\s+and\s+e|999|go\s+to\s+hospital|hurt\s+myself|harm\s+myself|kill\s+myself|end\s+my\s+life|suicid(?:e|al)|self[-\s]?harm)\b/i;

export function allowedUiPrimitivesForAction(
  action: TurnAction,
): readonly UiPrimitive[] {
  return uiPrimitivesByAction[action];
}

/**
 * [NODE:policy-ui-action-map]
 * Checks that planner-selected UI primitives are valid for the enforced action.
 */
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

/**
 * [NODE:policy-forbidden-credential-detection]
 * Detects requests to collect bank/card/payment credentials, excluding warnings.
 */
export function detectForbiddenCredentialRequest(text: string): boolean {
  if (credentialWarningPattern.test(text)) {
    return false;
  }

  return (
    credentialCollectionPattern.test(text) || credentialOfferPattern.test(text)
  );
}

export function containsForbiddenCredentialTerm(text: string): boolean {
  return forbiddenCredentialTermPattern.test(text);
}

/**
 * [NODE:policy-account-promise-detection]
 * Detects unsupported account-specific promises or mutations in customer copy.
 */
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

/**
 * [NODE:policy-emergency-crisis-detection]
 * Detects medical emergency or self-harm crisis turns that need urgent copy
 * without opening normal LoanSlam intake.
 */
export function detectEmergencyCrisisRequest(text: string): boolean {
  return emergencyCrisisPattern.test(text);
}

/**
 * [NODE:policy-fallback-copy]
 * Approved safe fallback used when the validator cannot accept a plan.
 */
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

export function buildEmergencyCrisisBoundaryCopy(reason: string): {
  action: "fallback";
  customerMessage: string;
  ui: UiPlan;
} {
  const customerMessage =
    "If this is an immediate medical emergency or you might hurt yourself, call 999 now or go to A&E. I cannot help with emergencies or unrelated requests in this chat.";

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

/**
 * [NODE:policy-credential-safety-copy]
 * Approved handoff copy for forbidden credential or banking screenshot turns.
 */
export function buildCredentialSafetyHandoffCopy(): {
  action: "request_handoff_intake";
  customerMessage: string;
  ui: UiPlan;
  requestedFields: IntakeField[];
} {
  const customerMessage =
    "Do not share bank login details, card details, payment credentials, one-time codes, or banking app screenshots in this chat. I can collect a few contact details and pass this to the LoanSlam team.";

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

/**
 * [NODE:policy-vulnerability-copy]
 * Approved escalation copy for vulnerability-family routes.
 */
export function buildVulnerabilityCopy(reason: string): {
  action: "escalate";
  customerMessage: string;
  ui: UiPlan;
  requestedFields: IntakeField[];
} {
  const customerMessage =
    "I am sorry you are dealing with this. I can pass this to the LoanSlam team so a person can help you carefully.";

  return {
    action: "escalate",
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
