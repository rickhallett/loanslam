import { randomUUID } from "node:crypto";

import type {
  ConversationState,
  CorpusItem,
  PlannerMetadata,
  ServingMode,
  SignalExtractor,
  TurnPlanner,
  TurnTrace,
  ValidatedTurnResult,
} from "@loanslam/contracts";

import { processTurn } from "../engine";
import { expandTurn } from "./scenarios";
import type {
  HellWeekScenario,
  HellWeekScenarioEvidence,
  HellWeekTurnEvidence,
} from "./types";

type PlannerWithMetadata = TurnPlanner & { metadata?: PlannerMetadata };

export interface RunHellWeekInput {
  scenarios: readonly HellWeekScenario[];
  corpus: readonly CorpusItem[];
  planner: PlannerWithMetadata;
  signalExtractor?: SignalExtractor;
  /** Max scenarios driven concurrently against the planner. Defaults to 4. */
  concurrency?: number;
  now?: () => Date;
  idFactory?: () => string;
  onScenarioComplete?: (
    evidence: HellWeekScenarioEvidence,
    completed: number,
    total: number,
  ) => void;
}

function routeForScoring(trace: TurnTrace): ServingMode | null {
  return trace.effectiveServingMode ?? trace.selectedServingMode;
}

function toTurnEvidence(
  turnIndex: number,
  userMessage: string,
  result: ValidatedTurnResult,
): HellWeekTurnEvidence {
  const trace = result.trace;
  const signalBundle = trace.signalBundle ?? trace.shadowSignalBundle;
  const signalComparison =
    trace.signalComparison ?? trace.shadowSignalComparison;
  const signalLatencyMs = trace.signalLatencyMs ?? trace.shadowSignalLatencyMs;
  const signalError = trace.signalError ?? trace.shadowSignalError;
  const signalStatus = trace.signalStatus ?? trace.shadowSignalStatus;

  return {
    turnIndex,
    userMessage,
    botMessage: result.customerMessage,
    finalAction: result.finalAction,
    proposedAction: trace.proposedAction,
    selectedServingMode: trace.selectedServingMode,
    effectiveServingMode: trace.effectiveServingMode ?? null,
    routeForScoring: routeForScoring(trace),
    selectedRouteReason: trace.selectedRouteReason ?? null,
    safetyFlags: [...trace.safetyFlags],
    validatorOverrideCodes: trace.validatorOverrides.map(
      (override) => override.code,
    ),
    retrieved: trace.retrievedMatches.slice(0, 3).map((match) => ({
      itemId: match.itemId,
      servingMode: match.servingMode,
      score: match.score,
    })),
    uiPrimitive: result.ui.primitive,
    ...(signalStatus ? { signalStatus } : {}),
    ...(signalBundle
      ? {
          signalPrimaryIntent: signalBundle.primaryIntent,
          signalRecommendedServingMode: signalBundle.recommendedServingMode,
          signalNegatedOrCorrected: signalBundle.negatedOrCorrected,
        }
      : {}),
    ...(signalComparison
      ? { signalComparisonStatus: signalComparison.status }
      : {}),
    ...(typeof signalLatencyMs === "number" ? { signalLatencyMs } : {}),
    ...(signalError ? { signalError } : {}),
    ...(typeof trace.plannerLatencyMs === "number"
      ? { plannerLatencyMs: trace.plannerLatencyMs }
      : {}),
  };
}

function emptyState(conversationRef: string): ConversationState {
  return {
    conversationRef,
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
  };
}

export async function runScenario({
  scenario,
  corpus,
  planner,
  signalExtractor,
  now,
  idFactory = randomUUID,
}: {
  scenario: HellWeekScenario;
  corpus: readonly CorpusItem[];
  planner: PlannerWithMetadata;
  signalExtractor?: SignalExtractor;
  now?: () => Date;
  idFactory?: () => string;
}): Promise<HellWeekScenarioEvidence> {
  const conversationRef = `hellweek-${scenario.id}`;
  const startedAt = Date.now();
  let state = emptyState(conversationRef);
  const turns: HellWeekTurnEvidence[] = [];

  try {
    for (const [turnIndex, rawTurn] of scenario.customerTurns.entries()) {
      const userMessage = expandTurn(rawTurn);
      const result = await processTurn({
        state,
        userMessage,
        planner,
        ...(signalExtractor ? { signalExtractor } : {}),
        corpus,
        now: now ? now() : new Date(),
        idFactory,
        journeyId: scenario.id,
        turnIndex,
      });
      state = result.state;
      turns.push(toTurnEvidence(turnIndex, userMessage, result));
    }

    return {
      scenarioId: scenario.id,
      conversationRef,
      turns,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      scenarioId: scenario.id,
      conversationRef,
      turns,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Drive every scenario through the live, model-backed engine with a bounded
 * concurrency pool. Each scenario gets its own fresh session, so they are fully
 * independent.
 */
export async function runHellWeek({
  scenarios,
  corpus,
  planner,
  signalExtractor,
  concurrency = 4,
  now,
  idFactory,
  onScenarioComplete,
}: RunHellWeekInput): Promise<HellWeekScenarioEvidence[]> {
  const results = new Array<HellWeekScenarioEvidence>(scenarios.length);
  let nextIndex = 0;
  let completed = 0;
  const total = scenarios.length;
  const workerCount = Math.max(1, Math.min(concurrency, total));

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= total) {
        return;
      }

      const scenario = scenarios[index];

      if (!scenario) {
        return;
      }

      const evidence = await runScenario({
        scenario,
        corpus,
        planner,
        ...(signalExtractor ? { signalExtractor } : {}),
        ...(now ? { now } : {}),
        ...(idFactory ? { idFactory } : {}),
      });
      results[index] = evidence;
      completed += 1;
      onScenarioComplete?.(evidence, completed, total);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
