import type {
  ConversationState,
  SafetyFlag,
  ValidatedTurnResult,
} from "@loanslam/contracts";

/**
 * postMessage bridge between the embedded widget and the host page loader.
 *
 * Mirrors the protocol the host loader expects: the widget announces `ready`,
 * reports a coarse `session-context` after each turn so the page can surface the
 * right contact route, and can request the panel close. Only protocol-level
 * signals cross the boundary — never message content.
 */

export type HostContext = "vulnerability" | "handoff" | "general";

const VULNERABLE_FLAGS = new Set<SafetyFlag>([
  "vulnerability",
  "distress",
  "hardship",
  "accessibility_need",
  "language_barrier",
  "legal_threat",
  "complaint",
]);

const HANDOFF_ACTIONS = new Set([
  "request_handoff_intake",
  "create_ticket",
  "escalate",
]);

export function contextForTurn(result: ValidatedTurnResult): HostContext {
  if (result.state.safetyFlags.some((flag) => VULNERABLE_FLAGS.has(flag))) {
    return "vulnerability";
  }

  if (
    result.state.handoffPending ||
    HANDOFF_ACTIONS.has(result.finalAction) ||
    result.ui.primitive === "handoff_confirmation"
  ) {
    return "handoff";
  }

  return "general";
}

function postToHost(message: object): void {
  const type = (message as { type?: string }).type;
  if (type === "turn-telemetry") {
    // eslint-disable-next-line no-console
    console.log(
      "[sm-devtools] widget posting telemetry; embedded =",
      window.parent !== window,
    );
  }
  if (window.parent !== window) {
    window.parent.postMessage(message, "*");
  }
}

export function announceReady(): void {
  postToHost({ type: "ready" });
}

export function sendContext(context: HostContext): void {
  postToHost({ type: "session-context", context });
}

/**
 * Content-free decision telemetry for the host's engine-internals panel.
 *
 * This extends the same boundary the coarse `session-context` already crosses:
 * only *decision metadata* travels — action names, serving mode, override
 * codes, safety-flag names, retrieval ids/scores, signal intent. Never the
 * customer's words, the assistant copy, collected PII values, or the matched
 * query terms (which are derived from what the customer typed).
 */
const STANDARD_HANDOFF_FIELDS = [
  "fullName",
  "dateOfBirth",
  "postcode",
  "email",
  "phone",
] as const;

type ServingModeSignal = ValidatedTurnResult["trace"]["selectedServingMode"];
type TurnActionSignal = ValidatedTurnResult["finalAction"];

export interface TurnTelemetry {
  type: "turn-telemetry";
  turn: number;
  proposedAction: TurnActionSignal;
  finalAction: TurnActionSignal;
  servingMode: ServingModeSignal;
  actionChanged: boolean;
  overrides: Array<{
    code: string;
    fromAction: string | null;
    toAction: string;
  }>;
  safetyFlags: SafetyFlag[];
  retrieval: {
    count: number;
    topScore: number;
    matches: Array<{ itemId: string; score: number; servingMode: string }>;
  };
  signal: {
    status: string;
    primaryIntent: string | null;
    recommendedServingMode: ServingModeSignal;
    uncertainty: number | null;
    comparison: string | null;
  };
  intake: {
    collected: string[];
    requested: string[];
    handoffPending: boolean;
  };
  uiPrimitive: string;
  source: "turn" | "structured-intake";
}

function collectedFieldNames(state: ConversationState): string[] {
  return STANDARD_HANDOFF_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(state.collectedFacts, field),
  );
}

export function sendTurnTelemetry(
  result: ValidatedTurnResult,
  turn: number,
): void {
  const trace = result.trace;
  postToHost({
    type: "turn-telemetry",
    turn,
    proposedAction: trace.proposedAction,
    finalAction: result.finalAction,
    servingMode: trace.selectedServingMode ?? null,
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
  } satisfies TurnTelemetry);
}

export function sendIntakeTelemetry(
  result: {
    finalAction: string;
    ui: { primitive: string };
    state: ConversationState;
  },
  turn: number,
): void {
  postToHost({
    type: "turn-telemetry",
    turn,
    proposedAction: result.finalAction as TurnActionSignal,
    finalAction: result.finalAction as TurnActionSignal,
    servingMode: null,
    actionChanged: false,
    overrides: [],
    safetyFlags: [...result.state.safetyFlags],
    retrieval: { count: 0, topScore: 0, matches: [] },
    signal: {
      status: "disabled",
      primaryIntent: null,
      recommendedServingMode: null,
      uncertainty: null,
      comparison: null,
    },
    intake: {
      collected: collectedFieldNames(result.state),
      requested: [...result.state.requestedFields],
      handoffPending: result.state.handoffPending,
    },
    uiPrimitive: result.ui.primitive,
    source: "structured-intake",
  } satisfies TurnTelemetry);
}

export function requestClose(): void {
  postToHost({ type: "close-requested" });
}

export interface HostMessage {
  type: string;
  [key: string]: unknown;
}

export function onHostMessage(
  handler: (message: HostMessage) => void,
): () => void {
  const listener = (event: MessageEvent): void => {
    const data = event.data as unknown;
    if (
      typeof data !== "object" ||
      data === null ||
      typeof (data as { type?: unknown }).type !== "string"
    ) {
      return;
    }
    handler(data as HostMessage);
  };

  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
