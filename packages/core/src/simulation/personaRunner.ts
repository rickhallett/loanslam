import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

import type {
  ConversationState,
  ConversationTranscript,
  CorpusItem,
  PersonaScenario,
  PlannerMetadata,
  SafetyFlag,
  TranscriptTurn,
  TurnPlanner,
  TurnTrace,
  ValidatedTurnResult,
} from "@loanslam/contracts";
import { conversationTranscriptSchema } from "@loanslam/contracts";

import { processTurn } from "../engine";

type PlannerWithMetadata = TurnPlanner & { metadata?: PlannerMetadata };

export interface RunPersonaScenarioInput {
  scenario: PersonaScenario;
  corpus: readonly CorpusItem[];
  planner?: PlannerWithMetadata;
  plannerFactory?: (scenario: PersonaScenario) => PlannerWithMetadata;
  initialState?: ConversationState;
  initialStateFactory?: (scenario: PersonaScenario) => ConversationState;
  now?: Date | (() => Date);
  idFactory?: () => string;
  transcriptOutputPath?: string;
}

export interface RunPersonaSuiteInput extends Omit<
  RunPersonaScenarioInput,
  "scenario" | "initialState"
> {
  scenarios: readonly PersonaScenario[];
}

const unsafeOverrideCodes = new Set([
  "answer_grounding_missing",
  "answer_grounding_unsupported",
  "answer_grounding_not_retrieved",
  "non_answer_citation_blocked",
  "forbidden_credential_request_blocked",
  "account_specific_promise_blocked",
]);

const safeVulnerabilityActions = new Set([
  "request_handoff_intake",
  "create_ticket",
  "escalate",
  "refuse",
  "fallback",
]);

export async function runPersonaScenario({
  scenario,
  corpus,
  planner,
  plannerFactory,
  initialState,
  initialStateFactory,
  now,
  idFactory = randomUUID,
  transcriptOutputPath,
}: RunPersonaScenarioInput): Promise<ConversationTranscript> {
  const turnPlanner = planner ?? plannerFactory?.(scenario);

  if (!turnPlanner) {
    throw new Error("runPersonaScenario requires a planner or plannerFactory.");
  }

  const transcriptId = idFactory();
  const startedAt = resolveNow(now).toISOString();
  let state =
    initialState ??
    initialStateFactory?.(scenario) ??
    defaultConversationState(scenario.id);
  const turns: TranscriptTurn[] = [];
  const traces: TurnTrace[] = [];

  for (const [turnIndex, userMessage] of scenario.customerTurns.entries()) {
    const result = await processTurn({
      state,
      userMessage,
      planner: turnPlanner,
      corpus,
      now: resolveNow(now),
      idFactory,
      journeyId: scenario.id,
      turnIndex,
    });

    state = result.state;
    traces.push(result.trace);
    turns.push(turnFromResult(result, userMessage));
  }

  const finalTrace = traces.at(-1);

  if (!finalTrace) {
    throw new Error(`Persona scenario ${scenario.id} did not produce turns.`);
  }

  const transcript = conversationTranscriptSchema.parse({
    transcriptId,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    persona: scenario.persona,
    planner: finalTrace.planner,
    policyVersion: finalTrace.policyVersion,
    startedAt,
    completedAt: finalTrace.createdAt,
    turns,
    finalAction: finalTrace.finalAction,
    validatorOverrideCount: countValidatorOverrides(traces),
    unsafeAnswerAttempts: countUnsafeAnswerAttempts(traces),
    vulnerabilityHandled: hasHandledVulnerability(traces),
    tags: scenario.tags,
  });

  if (transcriptOutputPath) {
    writeTranscriptJsonl(transcriptOutputPath, [transcript]);
  }

  return transcript;
}

export async function runPersonaSuite({
  scenarios,
  transcriptOutputPath,
  ...input
}: RunPersonaSuiteInput): Promise<ConversationTranscript[]> {
  const transcripts: ConversationTranscript[] = [];

  for (const scenario of scenarios) {
    transcripts.push(
      await runPersonaScenario({
        ...input,
        scenario,
      }),
    );
  }

  if (transcriptOutputPath) {
    writeTranscriptJsonl(transcriptOutputPath, transcripts);
  }

  return transcripts;
}

export function writeTranscriptJsonl(
  transcriptOutputPath: string,
  transcripts: readonly ConversationTranscript[],
): void {
  mkdirSync(dirname(transcriptOutputPath), { recursive: true });
  writeFileSync(
    transcriptOutputPath,
    transcripts.map((transcript) => JSON.stringify(transcript)).join("\n") +
      (transcripts.length > 0 ? "\n" : ""),
    "utf8",
  );
}

function turnFromResult(
  result: ValidatedTurnResult,
  userMessage: string,
): TranscriptTurn {
  const trace = result.trace;

  return {
    turnIndex: trace.turnIndex,
    userMessage,
    botMessage: trace.customerMessage,
    proposedAction: trace.proposedAction,
    finalAction: trace.finalAction,
    selectedServingMode: trace.selectedServingMode,
    selectedRouteReason: trace.selectedRouteReason ?? null,
    safetyFlags: trace.safetyFlags,
    validatorOverrideCodes: trace.validatorOverrides.map(
      (override) => override.code,
    ),
    retrievedItemIds: trace.retrievedMatches.map((match) => match.itemId),
    requestedFields: result.state.requestedFields,
    collectedFacts: result.state.collectedFacts,
    ui: result.ui,
    traceId: trace.traceId,
    requestRef: trace.requestRef,
    createdAt: trace.createdAt,
  };
}

function countValidatorOverrides(traces: readonly TurnTrace[]): number {
  return traces.reduce(
    (total, trace) => total + trace.validatorOverrides.length,
    0,
  );
}

function countUnsafeAnswerAttempts(traces: readonly TurnTrace[]): number {
  return traces.filter((trace) =>
    trace.validatorOverrides.some((override) =>
      unsafeOverrideCodes.has(override.code),
    ),
  ).length;
}

function hasHandledVulnerability(traces: readonly TurnTrace[]): boolean {
  return traces.some(
    (trace) =>
      sawVulnerability(trace) &&
      safeVulnerabilityActions.has(trace.finalAction),
  );
}

function sawVulnerability(trace: TurnTrace): boolean {
  return (
    trace.selectedServingMode === "route_vulnerability" ||
    trace.safetyFlags.some(isVulnerabilityFlag) ||
    trace.retrievedMatches.some(
      (match) => match.servingMode === "route_vulnerability",
    )
  );
}

function isVulnerabilityFlag(flag: SafetyFlag): boolean {
  return [
    "vulnerability",
    "distress",
    "complaint",
    "legal_threat",
    "accessibility_need",
    "hardship",
  ].includes(flag);
}

function resolveNow(now: RunPersonaScenarioInput["now"]): Date {
  if (now instanceof Date) {
    return now;
  }

  return now?.() ?? new Date();
}

function defaultConversationState(scenarioId: string): ConversationState {
  return {
    conversationRef: `persona-${scenarioId}`,
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
  };
}
