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

export const standardHandoffFields = [
  "fullName",
  "dateOfBirth",
  "address",
  "phone",
  "email",
  "situationSummary",
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
  /\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*code|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|payment\s+credentials?)\b/i;

const credentialCollectionPattern =
  /\b(send|share|provide|enter|give|confirm|tell|submit|type|write)\b.{0,80}\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*code|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|payment\s+credentials?)\b/i;

const credentialWarningPattern =
  /\b(never|do\s+not|don't|dont|should\s+not|must\s+not)\s+(send|share|provide|enter|give|confirm|tell|submit|type|write)\b.{0,80}\b(sort\s*code|account\s*number|iban|card\s*(number|details)?|cvv|cvc|security\s*code|online\s+banking\s+(login|password|credentials)|bank\s+(details?|login|password)|payment\s+credentials?)\b/i;

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

const languageBarrierPattern =
  /\b(english\s+(is\s+)?(hard|difficult|not\s+good)|english\s+hard\s+for\s+me|my\s+english\s+(is\s+)?(bad|poor|not\s+good)|i\s+(do\s+not|don't|dont|can't|cant|cannot)\s+(speak|read|write|understand)\s+english|not\s+much\s+english)\b/i;

const complaintNegationPattern =
  /\b(?:i\s*(?:am|'m|m)?\s+)?not\s+(?:trying\s+to\s+)?complain(?:ing)?\b|\bnot\s+(?:a\s+|formal\s+)?complaint\b|\bno\s+(?:complaint|formal\s+complaint)\b|\bnot\s+(?:trying\s+to\s+)?(?:make|raise|file)\s+(?:a\s+|formal\s+)?complaint\b/i;

const complaintNegationScrubPattern =
  /\b(?:i\s*(?:am|'m|m)?\s+)?not\s+(?:trying\s+to\s+)?complain(?:ing)?\b|\bnot\s+(?:a\s+|formal\s+)?complaint\b|\bno\s+(?:complaint|formal\s+complaint)\b|\bnot\s+(?:trying\s+to\s+)?(?:make|raise|file)\s+(?:a\s+|formal\s+)?complaint\b/gi;

const complaintRouteSignalPattern =
  /\b(?:want|need|would\s+like)\s+to\s+(?:make|raise|file)\s+(?:a\s+|formal\s+)?complaint\b|\b(?:make|raise|file)\s+(?:a\s+|formal\s+)?complaint\b|\bformal\s+complaint\b|\btreat\s+this\s+as\s+(?:a\s+)?complaint\b|\bthis\s+is\s+(?:a\s+)?complaint\b|\bcomplain(?:t|ing)?\b|\b(?:not\s+happy|unhappy)\b|\bunacceptable\b|\bescalate\s+(?:this|an?\s+issue)\b/i;

const hardshipNegationPattern =
  /\bnot\s+(?:saying|claiming|telling\s+you|meaning)\s+(?:that\s+)?(?:i\s+(?:am\s+)?)?(?:can't|cannot|cant|unable\s+to)\s+pay\b|\bnot\s+(?:in\s+)?(?:a\s+)?(?:hardship|financial\s+difficulty|struggling\s+financially)\b|\bno\s+(?:hardship|financial\s+difficulty|difficulty\s+paying|problem\s+paying)\b/i;

const hardshipNegationScrubPattern =
  /\bnot\s+(?:saying|claiming|telling\s+you|meaning)\s+(?:that\s+)?(?:i\s+(?:am\s+)?)?(?:can't|cannot|cant|unable\s+to)\s+pay\b|\bnot\s+(?:in\s+)?(?:a\s+)?(?:hardship|financial\s+difficulty|struggling\s+financially)\b|\bno\s+(?:hardship|financial\s+difficulty|difficulty\s+paying|problem\s+paying)\b/gi;

const paymentHardshipPattern =
  /\b(can't|cannot|cant|unable\s+to|not\s+able\s+to|struggling\s+to)\s+pay\b|\b(can't|cannot|cant|unable\s+to|not\s+able\s+to|struggling\s+to)\s+(?:afford|cover|make)\b.{0,50}\b(payment|repayment|instalment|installment|direct\s+debit|rent|bills?)\b/i;

const activeInsolvencyOrDebtPlanPattern =
  /\b(i\s*(am|'m)|i\s+have|i've|already|currently)\b.{0,80}\b(setting\s+up|going\s+into|entered|entering|started|starting)\b.{0,80}\b(iva|debt\s+management|insolvency)\b/i;

const hardshipRouteSignalPattern =
  /\b(afford|arrears?|fallen\s+behind|financial\s+difficulty|hardship|lost\s+(?:my\s+)?(?:job|income|work)|made\s+redundant|redundancy|money\s+(?:is\s+)?(?:really\s+)?tight|priority\s+bills?|rent|struggling\s+financially|struggling\s+with\s+money|gambling\s+(?:problem|addiction)|gambled\s+away)\b/i;

const distressRouteSignalPattern =
  /\b(bereavement|can't\s+cope|cant\s+cope|crisis|desperate|mental\s+health|passed\s+away|seriously\s+ill|suicide|worried\s+about\s+my\s+loan)\b/i;

const accessibilityNeedPattern =
  /\b(i\s+(can't|cant|cannot|struggle\s+to)\s+(read|see|type)|screen\s+reader|large\s+print|easy\s+read|dyslexia|learning\s+difficulty|disability|disabled)\b/i;

const internalDataExposurePattern =
  /\b(show|give|send|dump|display|reveal|print|list|export)\b.{0,100}\b(trace|traces|hidden\s+(prompt|instruction|instructions|internal|internals)|system\s+prompt|developer\s+message|customer\s+data|other\s+customers?|conversation\s+logs?|audit\s+logs?|internal\s+(state|data|notes|reasoning|log|logs))\b|\b(ignore\s+(the\s+)?policy|bypass\s+(compliance|policy|rules)|compliance\s+bypass|pretend\s+you\s+are\s+(staff|admin|agent))\b/i;

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

export function detectLanguageBarrier(text: string): boolean {
  return languageBarrierPattern.test(text);
}

export function detectComplaintNegation(text: string): boolean {
  return complaintNegationPattern.test(text);
}

export function detectComplaintRouteSignal(text: string): boolean {
  return complaintRouteSignalPattern.test(
    text.replace(complaintNegationScrubPattern, " "),
  );
}

export function detectHardshipNegation(text: string): boolean {
  return hardshipNegationPattern.test(text);
}

export function detectHardshipRouteSignal(text: string): boolean {
  const scrubbed = text.replace(hardshipNegationScrubPattern, " ");

  return (
    paymentHardshipPattern.test(scrubbed) ||
    activeInsolvencyOrDebtPlanPattern.test(scrubbed) ||
    hardshipRouteSignalPattern.test(scrubbed)
  );
}

export function detectDistressRouteSignal(text: string): boolean {
  return distressRouteSignalPattern.test(text);
}

export function detectVulnerabilityRouteSignal(text: string): boolean {
  return (
    detectComplaintRouteSignal(text) ||
    detectHardshipRouteSignal(text) ||
    detectDistressRouteSignal(text) ||
    detectAccessibilityNeed(text)
  );
}

export function detectAccessibilityNeed(text: string): boolean {
  return accessibilityNeedPattern.test(text);
}

export function detectInternalDataExposureRequest(text: string): boolean {
  return internalDataExposurePattern.test(text);
}

export function buildFallbackCopy(reason: string): {
  action: "fallback";
  customerMessage: string;
  ui: UiPlan;
} {
  const customerMessage =
    "I cannot answer that safely from the information available here. I can pass this to the Loanslam team so they can help.";

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
    "I cannot share internal traces, hidden instructions, or customer data in chat. I can help with general Loanslam questions or pass a request to the team.";

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
    "I cannot handle that directly in chat. I can collect a few contact details and pass this to the Loanslam team.";

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

export function buildVulnerabilityCopy(reason: string): {
  action: "request_handoff_intake";
  customerMessage: string;
  ui: UiPlan;
  requestedFields: IntakeField[];
} {
  const customerMessage =
    "I am sorry you are dealing with this. I can pass this to the Loanslam team so a person can help you carefully.";

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
    "I cannot answer that in chat. I can signpost general information or pass this to the Loanslam team.";

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
