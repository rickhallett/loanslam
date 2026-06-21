import type {
  ConversationState,
  DemoDisplayTelemetry,
  DemoHostContext,
  DemoTurnResponse,
  IntakeField,
  SafetyFlag,
  TurnAction,
  UiPlan,
  ValidatedTurnResult,
} from "@loanslam/contracts";

import { standardHandoffFields } from "../policy";

const VULNERABLE_FLAGS = new Set<SafetyFlag>([
  "vulnerability",
  "distress",
  "hardship",
  "accessibility_need",
  "language_barrier",
  "legal_threat",
  "complaint",
]);

const HANDOFF_ACTIONS = new Set<TurnAction>([
  "request_handoff_intake",
  "create_ticket",
  "escalate",
]);

export function mapTurnResultToDemoResponse({
  result,
  turn,
  continuationToken,
}: {
  result: ValidatedTurnResult;
  turn: number;
  continuationToken?: string | undefined;
}): DemoTurnResponse {
  const customerMessage = sanitizeCustomerMessageForDemo({
    message: result.customerMessage,
    state: result.state,
  });

  return {
    conversationRef: result.conversationRef,
    requestRef: result.requestRef,
    customerMessage,
    ui: sanitizeUiForDemo({
      ui: result.ui,
      state: result.state,
      fallbackMessage: customerMessage,
    }),
    terminalSession: isTerminalResult(result.finalAction, result.ui),
    hostContext: hostContextForState({
      state: result.state,
      finalAction: result.finalAction,
      ui: result.ui,
    }),
    telemetry: telemetryForTurnResult({ result, turn }),
    ...(continuationToken ? { continuationToken } : {}),
  };
}

export function mapStructuredIntakeToDemoResponse({
  conversationRef,
  state,
  finalAction,
  ui,
  customerMessage,
  turn,
  continuationToken,
}: {
  conversationRef: string;
  state: ConversationState;
  finalAction: "create_ticket";
  ui: UiPlan;
  customerMessage: string;
  reference: string;
  turn: number;
  continuationToken?: string | undefined;
}): DemoTurnResponse {
  const safeMessage = buildSafeHandoffConfirmation({
    state,
    customerMessage,
  });
  const safeUi: UiPlan = {
    primitive: "handoff_confirmation",
    message: safeMessage,
  };

  return {
    conversationRef,
    customerMessage: safeMessage,
    ui: sanitizeUiForDemo({
      ui: safeUi,
      state,
      fallbackMessage: safeMessage,
    }),
    terminalSession: true,
    hostContext: hostContextForState({
      state,
      finalAction,
      ui,
    }),
    telemetry: telemetryForStructuredIntake({
      state,
      finalAction,
      ui,
      turn,
    }),
    ...(continuationToken ? { continuationToken } : {}),
  };
}

function telemetryForTurnResult({
  result,
  turn,
}: {
  result: ValidatedTurnResult;
  turn: number;
}): DemoDisplayTelemetry {
  const trace = result.trace;

  return {
    type: "turn-telemetry",
    turn,
    proposedAction: trace.proposedAction,
    finalAction: result.finalAction,
    servingMode:
      trace.effectiveServingMode ?? trace.selectedServingMode ?? null,
    actionChanged: trace.proposedAction !== result.finalAction,
    overrides: trace.validatorOverrides.map((override) => ({
      code: override.code,
      fromAction: override.fromAction ?? null,
      toAction: override.toAction,
    })),
    safetyFlags: [...trace.safetyFlags],
    retrieval: {
      count: trace.retrievedMatches.length,
      topScore: trace.retrievedMatches.reduce(
        (max, match) => Math.max(max, match.score),
        0,
      ),
      matches: trace.retrievedMatches.slice(0, 6).map((match) => ({
        itemId: match.itemId,
        score: match.score,
        servingMode: match.servingMode,
      })),
    },
    signal: {
      status: trace.shadowSignalStatus ?? "disabled",
      primaryIntent: trace.shadowSignalBundle?.primaryIntent ?? null,
      recommendedServingMode:
        trace.shadowSignalBundle?.recommendedServingMode ?? null,
      uncertainty: trace.shadowSignalBundle?.uncertainty ?? null,
      comparison: trace.shadowSignalComparison?.status ?? null,
    },
    intake: {
      collected: collectedFieldNames(result.state),
      requested: [...result.state.requestedFields],
      handoffPending: result.state.handoffPending,
    },
    uiPrimitive: result.ui.primitive,
    source: "turn",
  };
}

function telemetryForStructuredIntake({
  state,
  finalAction,
  ui,
  turn,
}: {
  state: ConversationState;
  finalAction: "create_ticket";
  ui: UiPlan;
  turn: number;
}): DemoDisplayTelemetry {
  return {
    type: "turn-telemetry",
    turn,
    proposedAction: finalAction,
    finalAction,
    servingMode: null,
    actionChanged: false,
    overrides: [
      {
        code: "handoff_intake_complete",
        fromAction: "request_handoff_intake",
        toAction: finalAction,
      },
    ],
    safetyFlags: [...state.safetyFlags],
    retrieval: { count: 0, topScore: 0, matches: [] },
    signal: {
      status: "disabled",
      primaryIntent: null,
      recommendedServingMode: null,
      uncertainty: null,
      comparison: null,
    },
    intake: {
      collected: collectedFieldNames(state),
      requested: [...state.requestedFields],
      handoffPending: state.handoffPending,
    },
    uiPrimitive: ui.primitive,
    source: "structured-intake",
  };
}

function hostContextForState({
  state,
  finalAction,
  ui,
}: {
  state: ConversationState;
  finalAction: TurnAction;
  ui: UiPlan;
}): DemoHostContext {
  if (state.safetyFlags.some((flag) => VULNERABLE_FLAGS.has(flag))) {
    return "vulnerability";
  }

  if (
    state.handoffPending ||
    HANDOFF_ACTIONS.has(finalAction) ||
    ui.primitive === "handoff_confirmation"
  ) {
    return "handoff";
  }

  return "general";
}

function collectedFieldNames(state: ConversationState): IntakeField[] {
  return standardHandoffFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(state.collectedFacts, field),
  );
}

function isTerminalResult(finalAction: TurnAction, ui: UiPlan): boolean {
  return (
    finalAction === "create_ticket" || ui.primitive === "handoff_confirmation"
  );
}

function sanitizeUiForDemo({
  ui,
  state,
  fallbackMessage,
}: {
  ui: UiPlan;
  state: ConversationState;
  fallbackMessage: string;
}): UiPlan {
  const message = sanitizeCustomerMessageForDemo({
    message: ui.message,
    state,
  });

  if (ui.primitive === "handoff_confirmation") {
    return {
      ...ui,
      message: message === ui.message ? fallbackMessage : message,
    };
  }

  return {
    ...ui,
    message,
  };
}

function sanitizeCustomerMessageForDemo({
  message,
  state,
}: {
  message: string;
  state: ConversationState;
}): string {
  return collectedFactValues(state).reduce((safeMessage, value) => {
    if (!value) {
      return safeMessage;
    }

    return safeMessage.split(value).join("[provided]");
  }, message);
}

function buildSafeHandoffConfirmation({
  state,
  customerMessage,
}: {
  state: ConversationState;
  customerMessage: string;
}): string {
  const redacted = sanitizeCustomerMessageForDemo({
    message: customerMessage,
    state,
  });

  if (redacted !== customerMessage) {
    if (state.safetyFlags.some((flag) => VULNERABLE_FLAGS.has(flag))) {
      return "I've passed this to the LoanSlam team so a person can help you carefully using the contact details you provided.";
    }

    return "I've passed this to the LoanSlam team using the contact details you provided.";
  }

  return redacted;
}

function collectedFactValues(state: ConversationState): string[] {
  return Object.values(state.collectedFacts)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .sort((a, b) => b.length - a.length);
}
