import { randomUUID } from "node:crypto";

import type {
  ConversationState,
  CorpusItem,
  PlannerMetadata,
  StochasticProfile,
  StochasticRunArtifact,
  StochasticScenario,
  StochasticTraceRow,
  TurnPlanner,
  ValidatedTurnResult,
} from "@loanslam/contracts";

import { processTurn } from "../engine";
import {
  buildStochasticArtifactPaths,
  fingerprintCorpus,
  type StochasticArtifactPaths,
  writeStochasticArtifacts,
} from "./artifacts";
import { buildStochasticCoverageReport } from "./coverage";
import {
  evaluateStochasticScenarioResult,
  type StochasticScenarioResult,
} from "./evaluate";
import {
  generateStochasticScenarios,
  replayStochasticScenario,
} from "./generator";
import {
  buildStochasticRunReport,
  renderStochasticSummaryMarkdown,
} from "./report";
import { renderStochasticDashboardHtml } from "./htmlReport";

export interface RunStochasticTestSimulatorInput {
  seed?: string;
  profile?: StochasticProfile;
  scenarioPath?: string;
  outputDir?: string;
  summaryOutput?: string;
  corpus: readonly CorpusItem[];
  planner: TurnPlanner & { metadata?: PlannerMetadata };
  now?: Date | (() => Date);
  idFactory?: () => string;
}

export interface RunStochasticTestSimulatorResult {
  run: StochasticRunArtifact;
  scenarios: StochasticScenario[];
  traces: StochasticTraceRow[];
  summaryMarkdown: string;
  dashboardHtml: string;
  paths: StochasticArtifactPaths;
  scenarioResults: StochasticScenarioResult[];
}

const defaultPlannerMetadata: PlannerMetadata = {
  provider: "inline",
  model: "inline-test-planner",
  promptVersion: "phase0-sts-runner",
};

export async function runStochasticTestSimulator(
  input: RunStochasticTestSimulatorInput,
): Promise<RunStochasticTestSimulatorResult> {
  const profile = input.profile ?? "review";
  const runStartedAt = resolveNow(input.now);
  const seed = input.seed ?? timestampSeed(runStartedAt);
  const paths = buildStochasticArtifactPaths({
    seed,
    ...(input.outputDir !== undefined ? { outputDir: input.outputDir } : {}),
    ...(input.summaryOutput !== undefined
      ? { summaryOutput: input.summaryOutput }
      : {}),
  });
  const generatedScenarios = generateStochasticScenarios({ seed, profile });
  const scenarios =
    input.scenarioPath === undefined
      ? generatedScenarios
      : [
          replayStochasticScenario({
            seed,
            profile,
            scenarioPath: input.scenarioPath,
          }),
        ];
  const scenarioResults: StochasticScenarioResult[] = [];
  const traces: StochasticTraceRow[] = [];
  const idFactory = input.idFactory ?? randomUUID;

  for (const scenario of scenarios) {
    const scenarioTraces: StochasticTraceRow[] = [];
    let state = emptyConversationState(scenario.scenarioPath);
    let scenarioError: unknown;

    for (const [turnIndex, userMessage] of scenario.customerTurns.entries()) {
      try {
        const result = await processTurn({
          state,
          userMessage,
          planner: input.planner,
          corpus: input.corpus,
          now: resolveNow(input.now),
          idFactory,
          journeyId: scenario.scenarioPath,
          turnIndex,
        });
        const traceRow = toStochasticTraceRow({
          scenario,
          turnIndex,
          userMessage,
          result,
        });

        state = result.state;
        scenarioTraces.push(traceRow);
        traces.push(traceRow);
      } catch (error) {
        scenarioError = error;
        break;
      }
    }

    scenarioResults.push(
      evaluateStochasticScenarioResult({
        scenarioPath: scenario.scenarioPath,
        traces: scenarioTraces,
        expectation: scenario.expectation,
        axisValues: scenario.axisValues,
        replayCommand: scenarioReplayCommand(seed, profile, scenario),
        error: scenarioError,
      }),
    );
  }

  const coverage = buildStochasticCoverageReport(scenarios);
  const run = buildStochasticRunReport({
    seed,
    profile,
    planner: input.planner.metadata ?? defaultPlannerMetadata,
    corpusFingerprint: fingerprintCorpus(input.corpus),
    scenarioResults,
    coverage,
    artifacts: paths,
    generatedAt: runStartedAt,
  });
  const summaryMarkdown = renderStochasticSummaryMarkdown(run);
  const dashboardHtml = renderStochasticDashboardHtml(run);

  writeStochasticArtifacts({
    paths,
    run,
    scenarios,
    traces,
    summaryMarkdown,
    dashboardHtml,
  });

  return {
    run,
    scenarios,
    traces,
    summaryMarkdown,
    dashboardHtml,
    paths,
    scenarioResults,
  };
}

function toStochasticTraceRow({
  scenario,
  turnIndex,
  userMessage,
  result,
}: {
  scenario: StochasticScenario;
  turnIndex: number;
  userMessage: string;
  result: ValidatedTurnResult;
}): StochasticTraceRow {
  return {
    scenarioPath: scenario.scenarioPath,
    turnIndex,
    userMessage,
    customerMessage: result.trace.customerMessage,
    proposedAction: result.trace.proposedAction,
    finalAction: result.trace.finalAction,
    selectedServingMode: result.trace.selectedServingMode,
    effectiveServingMode: result.trace.effectiveServingMode,
    safetyFlags: result.trace.safetyFlags,
    validatorOverrides: result.trace.validatorOverrides,
    validatorOverrideCodes: result.trace.validatorOverrides.map(
      (override) => override.code,
    ),
    retrievedItemIds: result.trace.retrievedMatches.map(
      (match) => match.itemId,
    ),
    traceId: result.trace.traceId,
    requestRef: result.trace.requestRef,
  };
}

function emptyConversationState(scenarioPath: string): ConversationState {
  return {
    conversationRef: `sts:${scenarioPath}`,
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
  };
}

function resolveNow(now: Date | (() => Date) | undefined): Date {
  if (now instanceof Date) {
    return now;
  }

  return now?.() ?? new Date();
}

function timestampSeed(date: Date): string {
  return date
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

function scenarioReplayCommand(
  seed: string,
  profile: StochasticProfile,
  scenario: StochasticScenario,
): string {
  return `just core-stochastic -- --seed ${seed} --profile ${profile} --scenario ${scenario.scenarioPath}`;
}
