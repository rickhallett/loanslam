import { randomUUID } from "node:crypto";

import type {
  ConversationState,
  CorpusItem,
  PlannerMetadata,
  SignalExtractor,
  Sts2EndReason,
  Sts2Initialization,
  Sts2Profile,
  Sts2RunReport,
  Sts2Trajectory,
  Sts2TranscriptTurn,
  TurnPlanner,
} from "@loanslam/contracts";

import { processTurn } from "../engine";
import {
  buildSts2ArtifactPaths,
  readSts2Run,
  writeSts2Artifacts,
  type Sts2ArtifactPaths,
} from "./artifacts";
import {
  Sts2CustomerAgent,
  type Sts2CustomerAgentConfig,
  type Sts2CustomerClient,
  type Sts2CustomerTurnExchange,
} from "./customerAgent";
import {
  generateSts2Initializations,
  replaySts2Initialization,
} from "./initialization";
import {
  buildSts2RunReport,
  renderSts2ReportHtml,
  renderSts2SummaryMarkdown,
} from "./report";

export interface RunSts2SimulatorInput {
  seed?: string;
  profile?: Sts2Profile;
  scenarioPath?: string;
  outputDir?: string;
  corpus: readonly CorpusItem[];
  planner: TurnPlanner & { metadata?: PlannerMetadata };
  signalExtractor?: SignalExtractor;
  customerConfig: Sts2CustomerAgentConfig;
  customerClient?: Sts2CustomerClient;
  now?: Date | (() => Date);
  idFactory?: () => string;
}

export interface RunSts2SimulatorResult {
  report: Sts2RunReport;
  initializations: Sts2Initialization[];
  trajectories: Sts2Trajectory[];
  paths: Sts2ArtifactPaths;
}

export async function runSts2Simulator(
  input: RunSts2SimulatorInput,
): Promise<RunSts2SimulatorResult> {
  const profile = input.profile ?? "smoke";
  const startedAt = resolveNow(input.now);
  const seed = input.seed ?? timestampToken(startedAt);
  const runId = timestampToken(startedAt);
  const paths = buildSts2ArtifactPaths({
    profile,
    stamp: runId,
    ...(input.outputDir !== undefined ? { outputDir: input.outputDir } : {}),
  });

  const initializations =
    input.scenarioPath === undefined
      ? generateSts2Initializations({ seed, profile })
      : [
          replaySts2Initialization({
            seed,
            profile,
            scenarioPath: input.scenarioPath,
          }),
        ];

  const trajectories: Sts2Trajectory[] = [];

  for (const initialization of initializations) {
    trajectories.push(
      await runSts2Trajectory({
        initialization,
        corpus: input.corpus,
        planner: input.planner,
        ...(input.signalExtractor
          ? { signalExtractor: input.signalExtractor }
          : {}),
        customerConfig: input.customerConfig,
        ...(input.customerClient
          ? { customerClient: input.customerClient }
          : {}),
        ...(input.now !== undefined ? { now: input.now } : {}),
        ...(input.idFactory !== undefined
          ? { idFactory: input.idFactory }
          : {}),
      }),
    );
  }

  const report = buildSts2RunReport({
    runId,
    seed,
    profile,
    customerModel: input.customerConfig.model,
    plannerModel: input.planner.metadata?.model ?? "unknown",
    generatedAt: startedAt,
    trajectories,
  });

  writeSts2Artifacts({
    paths,
    report,
    initializations,
    trajectories,
    summaryMarkdown: renderSts2SummaryMarkdown(report),
    reportHtml: renderSts2ReportHtml(report),
  });

  return { report, initializations, trajectories, paths };
}

// Regrade: rebuild report/summary/dashboard from persisted transcripts
// without re-simulation. From arc-002 this is also where a fresh judge pass
// hangs off.
export function regradeSts2Run(runDir: string): RunSts2SimulatorResult {
  const persisted = readSts2Run({ runDir });
  const report = buildSts2RunReport({
    runId: persisted.report.runId,
    seed: persisted.report.seed,
    profile: persisted.report.profile,
    customerModel: persisted.report.customerModel,
    plannerModel: persisted.report.plannerModel,
    generatedAt: new Date(),
    trajectories: persisted.trajectories,
  });
  const paths = buildSts2ArtifactPaths({
    profile: persisted.report.profile,
    stamp: persisted.report.runId,
    outputDir: runDirParent(runDir),
  });

  writeSts2Artifacts({
    paths,
    report,
    initializations: persisted.initializations,
    trajectories: persisted.trajectories,
    summaryMarkdown: renderSts2SummaryMarkdown(report),
    reportHtml: renderSts2ReportHtml(report),
  });

  return {
    report,
    initializations: persisted.initializations,
    trajectories: persisted.trajectories,
    paths,
  };
}

interface RunSts2TrajectoryInput {
  initialization: Sts2Initialization;
  corpus: readonly CorpusItem[];
  planner: TurnPlanner & { metadata?: PlannerMetadata };
  signalExtractor?: SignalExtractor;
  customerConfig: Sts2CustomerAgentConfig;
  customerClient?: Sts2CustomerClient;
  now?: Date | (() => Date);
  idFactory?: () => string;
}

export async function runSts2Trajectory(
  input: RunSts2TrajectoryInput,
): Promise<Sts2Trajectory> {
  const agent = new Sts2CustomerAgent({
    config: input.customerConfig,
    initialization: input.initialization,
    ...(input.customerClient ? { client: input.customerClient } : {}),
  });
  const idFactory = input.idFactory ?? randomUUID;
  const exchanges: Sts2CustomerTurnExchange[] = [];
  const turns: Sts2TranscriptTurn[] = [];
  let state = emptyConversationState(input.initialization.scenarioPath);
  let endReason: Sts2EndReason = "turn_cap";
  let trajectoryError: string | null = null;

  for (
    let turnIndex = 0;
    turnIndex < input.initialization.turnCap;
    turnIndex += 1
  ) {
    try {
      const next = await agent.nextTurn(exchanges);

      if (next.message.length === 0) {
        endReason = next.outcome === "continue" ? "error" : next.outcome;
        if (endReason === "error") {
          trajectoryError =
            "Customer agent returned an empty message with outcome continue";
        }
        break;
      }

      const result = await processTurn({
        state,
        userMessage: next.message,
        planner: input.planner,
        ...(input.signalExtractor
          ? { signalExtractor: input.signalExtractor }
          : {}),
        corpus: input.corpus,
        now: resolveNow(input.now),
        idFactory,
        journeyId: input.initialization.scenarioPath,
        turnIndex,
      });

      state = result.state;
      exchanges.push({
        customerMessage: next.message,
        botMessage: result.customerMessage,
      });
      turns.push({
        turnIndex,
        customerMessage: next.message,
        customerOutcome: next.outcome,
        botMessage: result.customerMessage,
        finalAction: result.trace.finalAction,
        effectiveServingMode: result.trace.effectiveServingMode ?? null,
        safetyFlags: [...result.trace.safetyFlags],
        validatorOverrideCodes: result.trace.validatorOverrides.map(
          (override) => override.code,
        ),
        customerUsage: next.usage,
      });

      if (next.outcome !== "continue") {
        endReason = next.outcome;
        break;
      }
    } catch (error) {
      endReason = "error";
      trajectoryError = error instanceof Error ? error.message : String(error);
      break;
    }
  }

  return {
    scenarioPath: input.initialization.scenarioPath,
    initialization: input.initialization,
    turns,
    endReason,
    error: trajectoryError,
  };
}

function emptyConversationState(scenarioPath: string): ConversationState {
  return {
    conversationRef: `sts2:${scenarioPath}`,
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

function timestampToken(date: Date): string {
  return date
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

function runDirParent(runDir: string): string {
  const trimmed = runDir.replace(/\/+$/, "");
  const lastSlash = trimmed.lastIndexOf("/");

  return lastSlash === -1 ? "." : trimmed.slice(0, lastSlash);
}
