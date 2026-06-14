import { randomUUID } from "node:crypto";

import type {
  ConversationState,
  CorpusItem,
  IntakeField,
  PlannerMetadata,
  ServingMode,
  TurnPlanner,
  TurnPlan,
  ValidatorOverride,
  ValidatedTurnResult,
} from "@loanslam/contracts";

import {
  allowedActions,
  allowedUiPrimitives,
  buildFallbackCopy,
  hasHandoffSafetyFlag,
  hasVulnerabilitySafetyFlag,
  policyVersion,
  standardHandoffFields,
} from "./policy";
import { retrieveMatches } from "./retriever";
import { type ValidatedPlanFragment, validateTurnPlan } from "./validator";

export interface ProcessTurnInput {
  state: ConversationState;
  userMessage: string;
  planner: TurnPlanner & { metadata?: PlannerMetadata };
  corpus: readonly CorpusItem[];
  now?: Date;
  idFactory?: () => string;
  journeyId?: string;
  turnIndex?: number;
}

export async function processTurn({
  state,
  userMessage,
  planner,
  corpus,
  now = new Date(),
  idFactory = randomUUID,
  journeyId,
  turnIndex,
}: ProcessTurnInput): Promise<ValidatedTurnResult> {
  const requestRef = idFactory();
  const inboundMessageId = idFactory();
  const outboundMessageId = idFactory();
  const traceId = idFactory();
  const createdAt = now.toISOString();
  const retrievedMatches = retrieveMatches(userMessage, corpus);
  const plannerInput = {
    conversationState: state,
    userMessage,
    retrievedMatches,
    allowedActions,
    allowedUiPrimitives,
    policyVersion,
  };

  const { plan, validated: policyValidated } = await planAndValidateTurn({
    planner,
    plannerInput,
    retrievedMatches,
    userMessage,
    stateSafetyFlags: state.safetyFlags,
  });
  const validated = applyHandoffStateRules(state, policyValidated, userMessage);
  const effectiveServingMode = deriveEffectiveServingMode(validated);
  const nextState = mergeState({
    state,
    userMessage,
    inboundMessageId,
    outboundMessageId,
    createdAt,
    customerMessage: validated.customerMessage,
    collectedFacts: validated.collectedFacts,
    requestedFields: validated.requestedFields,
    safetyFlags: validated.safetyFlags,
    finalAction: validated.finalAction,
  });

  const trace = {
    traceId,
    ...(journeyId ? { journeyId } : {}),
    turnIndex: turnIndex ?? state.history.length,
    conversationRef: state.conversationRef,
    requestRef,
    inboundMessageId,
    outboundMessageId,
    planner: planner.metadata ?? defaultPlannerMetadata,
    policyVersion,
    retrievedMatches,
    selectedServingMode: validated.selectedServingMode,
    effectiveServingMode,
    selectedRouteReason: validated.selectedRouteReason,
    proposedAction: plan.action,
    finalAction: validated.finalAction,
    validatorOverrides: validated.validatorOverrides,
    safetyFlags: validated.safetyFlags,
    customerMessage: validated.customerMessage,
    createdAt,
  };

  return {
    conversationRef: state.conversationRef,
    requestRef,
    state: nextState,
    plan,
    finalAction: validated.finalAction,
    ui: validated.ui,
    customerMessage: validated.customerMessage,
    validatorOverrides: validated.validatorOverrides,
    trace,
  };
}

function deriveEffectiveServingMode(
  validated: ValidatedPlanFragment,
): ServingMode | null {
  if (validated.finalAction === "answer") {
    return "answer";
  }

  if (validated.finalAction === "refuse") {
    return validated.selectedServingMode === "excluded" ? "excluded" : null;
  }

  if (
    validated.finalAction === "request_handoff_intake" ||
    validated.finalAction === "create_ticket" ||
    validated.finalAction === "escalate"
  ) {
    if (
      validated.selectedServingMode === "route_vulnerability" ||
      hasVulnerabilitySafetyFlag(validated.safetyFlags)
    ) {
      return "route_vulnerability";
    }

    if (validated.selectedServingMode === "excluded") {
      return "excluded";
    }

    if (
      validated.selectedServingMode === "handoff_account_specific" ||
      hasHandoffSafetyFlag(validated.safetyFlags)
    ) {
      return "handoff_account_specific";
    }

    return "handoff_account_specific";
  }

  return null;
}

function applyHandoffStateRules(
  state: ConversationState,
  validated: ValidatedPlanFragment,
  userMessage: string,
): ValidatedPlanFragment {
  const extractedFacts = shouldApplyExtractedHandoffFacts(state, validated)
    ? extractHandoffFacts(userMessage)
    : {};
  const currentValidated =
    Object.keys(extractedFacts).length === 0
      ? validated
      : {
          ...validated,
          collectedFacts: {
            ...extractedFacts,
            ...validated.collectedFacts,
          },
        };
  const facts = {
    ...state.collectedFacts,
    ...currentValidated.collectedFacts,
  };
  const missingStandardFields = standardHandoffFields.filter(
    (field) => !hasCollectedHandoffField(facts, field),
  );

  if (
    state.lastAction === "create_ticket" &&
    missingStandardFields.length === 0 &&
    isCompletedHandoffFollowUp(userMessage)
  ) {
    return buildCompletedHandoffFragment(
      state,
      currentValidated,
      "completed_handoff_follow_up",
      "A completed handoff follow-up should preserve the completed handoff state.",
    );
  }

  if (
    shouldCompleteHandoffNow(
      state,
      currentValidated,
      extractedFacts,
      userMessage,
    ) &&
    missingStandardFields.length === 0
  ) {
    return buildCompletedHandoffFragment(
      state,
      currentValidated,
      "handoff_intake_complete",
      "All requested handoff intake fields are present in conversation state.",
    );
  }

  if (state.handoffPending && hasAnyStandardHandoffFact(extractedFacts)) {
    return buildMissingHandoffFragment(
      currentValidated,
      missingStandardFields,
      "handoff_intake_progress_preserved",
      "A pending handoff turn collected intake facts but still needs more standard fields.",
    );
  }

  if (currentValidated.finalAction === "create_ticket") {
    if (missingStandardFields.length === 0) {
      return currentValidated;
    }

    return buildMissingHandoffFragment(
      currentValidated,
      missingStandardFields,
      "handoff_intake_incomplete",
      "A ticket cannot be created until every standard handoff field is present.",
    );
  }

  if (
    currentValidated.finalAction !== "request_handoff_intake" ||
    currentValidated.ui.primitive !== "intake_form"
  ) {
    return currentValidated;
  }

  if (missingStandardFields.length === 0) {
    return buildCompletedHandoffFragment(
      state,
      currentValidated,
      "handoff_intake_complete",
      "All requested handoff intake fields are present in conversation state.",
    );
  }

  const customerMessage = buildHandoffIntakeMessage(missingStandardFields);

  if (sameIntakeFields(currentValidated.ui.fields, missingStandardFields)) {
    return {
      ...currentValidated,
      customerMessage,
      ui: {
        ...currentValidated.ui,
        message: customerMessage,
      },
      requestedFields: missingStandardFields,
    };
  }

  return {
    ...currentValidated,
    customerMessage,
    ui: {
      ...currentValidated.ui,
      message: customerMessage,
      fields: missingStandardFields,
    },
    requestedFields: missingStandardFields,
  };
}

function buildCompletedHandoffFragment(
  state: ConversationState,
  validated: ValidatedPlanFragment,
  code: string,
  reason: string,
): ValidatedPlanFragment {
  const customerMessage = buildCompletedHandoffMessage(validated.safetyFlags);
  const override: ValidatorOverride = {
    code,
    reason,
    fromAction: validated.finalAction,
    toAction: "create_ticket",
  };

  return {
    ...validated,
    finalAction: "create_ticket",
    customerMessage,
    ui: {
      primitive: "handoff_confirmation",
      message: customerMessage,
      reference: state.conversationRef,
    },
    requestedFields: [],
    validatorOverrides: [...validated.validatorOverrides, override],
  };
}

function buildMissingHandoffFragment(
  validated: ValidatedPlanFragment,
  missingFields: readonly IntakeField[],
  code: string,
  reason: string,
): ValidatedPlanFragment {
  const customerMessage = buildHandoffIntakeMessage(missingFields);
  const override: ValidatorOverride = {
    code,
    reason,
    fromAction: validated.finalAction,
    toAction: "request_handoff_intake",
  };

  return {
    ...validated,
    finalAction: "request_handoff_intake",
    customerMessage,
    ui: {
      primitive: "intake_form",
      message: customerMessage,
      fields: [...missingFields],
    },
    requestedFields: [...missingFields],
    validatorOverrides: [...validated.validatorOverrides, override],
  };
}

function buildCompletedHandoffMessage(
  safetyFlags: readonly ConversationState["safetyFlags"][number][],
): string {
  if (hasVulnerabilitySafetyFlag(safetyFlags)) {
    return "Thanks. I have the details needed to pass this to the Loanslam team so a person can help you carefully.";
  }

  return "Thanks. I have the details needed to pass this to the Loanslam team.";
}

const handoffFieldLabels = {
  fullName: "your full name",
  dateOfBirth: "your date of birth",
  address: "your address",
  phone: "your phone number",
  email: "your email address",
  situationSummary: "a short summary of what you need help with",
} as const satisfies Record<IntakeField, string>;

function buildHandoffIntakeMessage(
  missingFields: readonly IntakeField[],
): string {
  const fields = missingFields.map((field) => handoffFieldLabels[field]);
  const firstField = fields[0];

  if (firstField === undefined) {
    return "I have the details needed to pass this to the Loanslam team.";
  }

  const needText =
    missingFields.length === standardHandoffFields.length
      ? "I need"
      : "I still need";

  return `To pass this to the Loanslam team, ${needText} ${formatList(fields)}. Let's start with ${firstField}.`;
}

function shouldApplyExtractedHandoffFacts(
  state: ConversationState,
  validated: ValidatedPlanFragment,
): boolean {
  return (
    state.handoffPending ||
    validated.finalAction === "request_handoff_intake" ||
    validated.finalAction === "create_ticket" ||
    validated.finalAction === "escalate"
  );
}

function shouldCompleteHandoffNow(
  state: ConversationState,
  validated: ValidatedPlanFragment,
  extractedFacts: Record<string, string>,
  userMessage: string,
): boolean {
  if (!state.handoffPending) {
    return false;
  }

  return (
    validated.finalAction === "create_ticket" ||
    validated.finalAction === "request_handoff_intake" ||
    validated.finalAction === "escalate" ||
    validated.finalAction === "fallback" ||
    hasAnyStandardHandoffFact(extractedFacts) ||
    isCompletedHandoffFollowUp(userMessage)
  );
}

function extractHandoffFacts(message: string): Record<string, string> {
  const facts: Record<string, string> = {};

  captureFact(message, facts, "fullName", [
    /\bfull name\s*:\s*([^.\n]+)/i,
    /\bmy name is\s+([^,.\n]+)/i,
  ]);
  captureFact(message, facts, "dateOfBirth", [
    /\bdate of birth\s*:\s*([^.\n]+)/i,
    /\bmy dob is\s+([^,.\n]+)/i,
  ]);
  captureFact(message, facts, "address", [
    /\baddress\s*:\s*([\s\S]*?)(?=\.\s*(?:phone|email|situation summary)\s*:|$)/i,
    /\baddress is\s+([\s\S]*?)(?=\s+if that is enough|\.|$)/i,
  ]);
  captureFact(message, facts, "phone", [
    /\bphone\s*:\s*([^.\n]+)/i,
    /\bmy phone is\s+([^,.\n]+)/i,
  ]);
  captureFact(message, facts, "email", [
    /\bemail\s*:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /\bmy email is\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ]);
  captureFact(message, facts, "situationSummary", [
    /\bsituation summary\s*:\s*([\s\S]+)$/i,
    /\band i want to\s+([\s\S]*?)(?=\.|$)/i,
  ]);

  return facts;
}

function captureFact(
  message: string,
  facts: Record<string, string>,
  field: IntakeField,
  patterns: readonly RegExp[],
): void {
  if (facts[field]) {
    return;
  }

  for (const pattern of patterns) {
    const value = cleanFactValue(message.match(pattern)?.[1]);

    if (value) {
      facts[field] = value;
      return;
    }
  }
}

function cleanFactValue(value: string | undefined): string {
  return (
    value
      ?.replace(/\s+/g, " ")
      .replace(/[.,;:\s]+$/g, "")
      .trim() ?? ""
  );
}

function hasAnyStandardHandoffFact(facts: Record<string, string>): boolean {
  return standardHandoffFields.some((field) => Boolean(facts[field]?.trim()));
}

function formatList(items: readonly string[]): string {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function hasCollectedHandoffField(
  facts: Record<string, string>,
  field: IntakeField,
): boolean {
  const exactValue = facts[field]?.trim();
  const candidateValue = facts[`${field}_candidate`]?.trim();

  return Boolean(exactValue || candidateValue);
}

function sameIntakeFields(
  left: readonly IntakeField[],
  right: readonly IntakeField[],
): boolean {
  return (
    left.length === right.length &&
    left.every((field) => right.includes(field)) &&
    right.every((field) => left.includes(field))
  );
}

function isCompletedHandoffFollowUp(message: string): boolean {
  return completedHandoffFollowUpPattern.test(message);
}

const completedHandoffFollowUpPattern =
  /\b(what\s+(happens|happen|now|next)|what'?s\s+next|what\s+is\s+next|so\s+what\s+happens|what\s+(details|fields)|which\s+(details|fields)|still\s+missing|anything\s+missing|do\s+you\s+need|stored\s+details|hidden\s+state)\b/i;

async function planAndValidateTurn({
  planner,
  plannerInput,
  retrievedMatches,
  userMessage,
  stateSafetyFlags,
}: {
  planner: ProcessTurnInput["planner"];
  plannerInput: Parameters<TurnPlanner["planTurn"]>[0];
  retrievedMatches: ReturnType<typeof retrieveMatches>;
  userMessage: string;
  stateSafetyFlags: ConversationState["safetyFlags"];
}): Promise<{ plan: TurnPlan; validated: ValidatedPlanFragment }> {
  let plan: TurnPlan;

  try {
    plan = await planner.planTurn(plannerInput);
  } catch (error) {
    const reason = "I could not safely choose the next step from this message.";
    const traceReason = plannerFailureReason(error);
    const fallback = buildFallbackCopy(reason);
    plan = {
      action: fallback.action,
      customerMessage: fallback.customerMessage,
      ui: fallback.ui,
      reasonCode: "planner_malformed_output",
      collectedFacts: {},
      requestedFields: [],
      grounding: null,
      safetyFlags: [],
      traceSummary: traceReason,
    };

    return {
      plan,
      validated: {
        plan,
        finalAction: fallback.action,
        ui: fallback.ui,
        customerMessage: fallback.customerMessage,
        requestedFields: [],
        collectedFacts: {},
        validatorOverrides: [
          {
            code: "malformed_plan",
            reason: traceReason,
            toAction: fallback.action,
          },
        ],
        selectedServingMode: null,
        selectedRouteReason: null,
        safetyFlags: [...stateSafetyFlags],
      },
    };
  }

  return {
    plan,
    validated: validateTurnPlan(plan, retrievedMatches, {
      safetyFlags: stateSafetyFlags,
      userMessage,
    }),
  };
}

function plannerFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return `The planner response could not be validated. ${message}`;
}

const defaultPlannerMetadata: PlannerMetadata = {
  provider: "inline",
  model: "inline-test-planner",
  promptVersion: "phase0-task3",
};

function mergeState({
  state,
  userMessage,
  inboundMessageId,
  outboundMessageId,
  createdAt,
  customerMessage,
  collectedFacts,
  requestedFields,
  safetyFlags,
  finalAction,
}: {
  state: ConversationState;
  userMessage: string;
  inboundMessageId: string;
  outboundMessageId: string;
  createdAt: string;
  customerMessage: string;
  collectedFacts: Record<string, string>;
  requestedFields: ConversationState["requestedFields"];
  safetyFlags: ConversationState["safetyFlags"];
  finalAction: ConversationState["lastAction"];
}): ConversationState {
  return {
    ...state,
    history: [
      ...state.history,
      {
        id: inboundMessageId,
        role: "customer",
        content: userMessage,
        createdAt,
      },
      {
        id: outboundMessageId,
        role: "assistant",
        content: customerMessage,
        createdAt,
      },
    ],
    collectedFacts: {
      ...state.collectedFacts,
      ...collectedFacts,
    },
    requestedFields: [...new Set(requestedFields)],
    safetyFlags: [...new Set([...state.safetyFlags, ...safetyFlags])],
    lastAction: finalAction,
    handoffPending:
      state.handoffPending ||
      finalAction === "request_handoff_intake" ||
      finalAction === "escalate" ||
      finalAction === "create_ticket",
  };
}
