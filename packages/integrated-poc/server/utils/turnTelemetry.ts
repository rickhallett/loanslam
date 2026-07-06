import type {
  ConversationState,
  DemoDisplayTelemetry,
  ValidatedTurnResult,
} from "@loanslam/contracts";

import { ipocHandoffFields } from "../../shared/ipoc";

// Content-free decision telemetry for the sm-devtools stakeholder panel.
// Mirrors core/src/lab/demoDisplay.ts telemetryForTurnResult /
// telemetryForStructuredIntake (the consumer contract is frozen by
// review-host/public/devtools.js); only decision metadata travels — never
// customer words, assistant copy, or collected PII values (D043).

type IpocTelemetryInput =
  | {
      source: "turn";
      result: ValidatedTurnResult;
      turn: number;
    }
  | {
      source: "structured-intake";
      state: ConversationState;
      submittedFields: string[];
      turn: number;
    };

export function buildIpocTelemetry(
  input: IpocTelemetryInput,
): DemoDisplayTelemetry {
  if (input.source === "structured-intake") {
    return {
      type: "turn-telemetry",
      turn: input.turn,
      proposedAction: "create_ticket",
      finalAction: "create_ticket",
      servingMode: null,
      actionChanged: false,
      overrides: [
        {
          code: "handoff_intake_complete",
          fromAction: "request_handoff_intake",
          toAction: "create_ticket",
        },
      ],
      safetyFlags: [...input.state.safetyFlags],
      retrieval: { count: 0, topScore: 0, matches: [] },
      signal: {
        status: "disabled",
        primaryIntent: null,
        recommendedServingMode: null,
        uncertainty: null,
        comparison: null,
      },
      intake: {
        collected: input.submittedFields.filter((field) =>
          (ipocHandoffFields as readonly string[]).includes(field),
        ) as DemoDisplayTelemetry["intake"]["collected"],
        requested: [],
        handoffPending: false,
      },
      uiPrimitive: "handoff_confirmation",
      source: input.source,
    };
  }

  const trace = input.result.trace;
  return {
    type: "turn-telemetry",
    turn: input.turn,
    proposedAction: trace.proposedAction,
    finalAction: input.result.finalAction,
    servingMode:
      trace.effectiveServingMode ?? trace.selectedServingMode ?? null,
    actionChanged: trace.proposedAction !== input.result.finalAction,
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
      collected: collectedFieldNames(input.result.state),
      requested: [...input.result.state.requestedFields],
      handoffPending: input.result.state.handoffPending,
    },
    uiPrimitive: input.result.ui.primitive,
    source: input.source,
  };
}

function collectedFieldNames(
  state: ConversationState,
): DemoDisplayTelemetry["intake"]["collected"] {
  return ipocHandoffFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(state.collectedFacts, field),
  ) as DemoDisplayTelemetry["intake"]["collected"];
}
