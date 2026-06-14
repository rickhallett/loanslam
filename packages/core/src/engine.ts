import { randomUUID } from "node:crypto";

import type {
  ConversationState,
  CorpusItem,
  IntakeField,
  PlannerMetadata,
  TurnPlanner,
  TurnPlan,
  ValidatorOverride,
  ValidatedTurnResult,
} from "@loanslam/contracts";

import {
  allowedActions,
  allowedUiPrimitives,
  buildFallbackCopy,
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
  const validated = applyHandoffIntakeProgress(state, policyValidated);
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

function applyHandoffIntakeProgress(
  state: ConversationState,
  validated: ValidatedPlanFragment,
): ValidatedPlanFragment {
  if (
    validated.finalAction !== "request_handoff_intake" ||
    validated.ui.primitive !== "intake_form"
  ) {
    return validated;
  }

  const facts = {
    ...state.collectedFacts,
    ...validated.collectedFacts,
  };
  const requestedFields = uniqueIntakeFields([
    ...validated.ui.fields,
    ...validated.requestedFields,
  ]);
  const missingFields = requestedFields.filter(
    (field) => !hasCollectedHandoffField(facts, field),
  );

  if (missingFields.length === 0) {
    const customerMessage = buildCompletedHandoffMessage(validated.safetyFlags);
    const override: ValidatorOverride = {
      code: "handoff_intake_complete",
      reason:
        "All requested handoff intake fields are present in conversation state.",
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

  const customerMessage = buildHandoffIntakeMessage(missingFields);

  if (sameIntakeFields(validated.ui.fields, missingFields)) {
    return {
      ...validated,
      customerMessage,
      ui: {
        ...validated.ui,
        message: customerMessage,
      },
      requestedFields: missingFields,
    };
  }

  return {
    ...validated,
    customerMessage,
    ui: {
      ...validated.ui,
      message: customerMessage,
      fields: missingFields,
    },
    requestedFields: missingFields,
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

function uniqueIntakeFields(fields: readonly IntakeField[]): IntakeField[] {
  return standardHandoffFields.filter((field) => fields.includes(field));
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
