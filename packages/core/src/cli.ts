import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { type ConversationState, type TurnPlanner } from "@loanslam/contracts";

import { loadCorpusFromFile } from "./corpus";
import { processTurn } from "./engine";
import {
  loadOpenAiPlannerConfig,
  PlannerConfigurationError,
} from "./planners/config";
import { OpenAiTurnPlanner } from "./planners/openaiPlanner";
import { policyVersion } from "./policy";
import { buildModelComparisonReport } from "./simulation/report";
import { journeyFixtures } from "./simulation/journeys";
import { runJourneySuite } from "./simulation/runner";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

type PlannerFactory = () => TurnPlanner & {
  metadata: OpenAiTurnPlanner["metadata"];
};

const defaultTraceDir = "artifacts/phase0";

export async function runCli(
  args = process.argv.slice(2),
  env = process.env,
  plannerFactory: PlannerFactory = () =>
    new OpenAiTurnPlanner({ config: loadOpenAiPlannerConfig(env) }),
): Promise<CliResult> {
  const [command, ...rest] = args;

  try {
    if (!command || command === "--help" || command === "-h") {
      return ok(helpText());
    }

    if (command === "turn") {
      return await runTurn(rest, plannerFactory);
    }

    if (command === "simulate") {
      return await runSimulation(rest, plannerFactory);
    }

    if (command === "compare") {
      return await runComparison(rest, plannerFactory);
    }

    return fail(`Unknown command: ${command}\n\n${helpText()}`);
  } catch (error) {
    if (error instanceof PlannerConfigurationError) {
      return fail(error.message);
    }

    return fail(error instanceof Error ? error.message : String(error));
  }
}

async function runTurn(
  args: string[],
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  const message = readOption(args, "--message") ?? args.join(" ").trim();

  if (!message) {
    return fail('Usage: core:turn -- --message "customer message"');
  }

  const planner = plannerFactory();
  const result = await processTurn({
    state: emptyConversationState("cli-turn"),
    userMessage: message,
    planner,
    corpus: loadCorpusFromFile().items,
  });

  return ok(JSON.stringify(result, null, 2));
}

async function runSimulation(
  args: string[],
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  const outputPath =
    readOption(args, "--trace-output") ??
    join(defaultTraceDir, `traces-${Date.now()}.jsonl`);
  const planner = plannerFactory();
  const reports = await runJourneySuite({
    journeys: journeyFixtures,
    corpus: loadCorpusFromFile().items,
    planner,
    traceOutputPath: outputPath,
  });
  const passed = reports.filter((report) => report.passed).length;

  return ok(
    JSON.stringify(
      {
        journeyCount: reports.length,
        passed,
        failed: reports.length - passed,
        traceOutputPath: outputPath,
        reports,
      },
      null,
      2,
    ),
  );
}

async function runComparison(
  args: string[],
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  const outputPath =
    readOption(args, "--output") ??
    join(defaultTraceDir, `comparison-${Date.now()}.json`);
  const planner = plannerFactory();
  const reports = await runJourneySuite({
    journeys: journeyFixtures,
    corpus: loadCorpusFromFile().items,
    planner,
    traceOutputPath: outputPath.replace(/\.json$/, ".jsonl"),
  });
  const comparison = buildModelComparisonReport({
    runId: `phase0-${Date.now()}`,
    planner: planner.metadata,
    journeyReports: reports,
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(comparison, null, 2)}\n`, "utf8");

  return ok(JSON.stringify({ outputPath, comparison }, null, 2));
}

function emptyConversationState(conversationRef: string): ConversationState {
  return {
    conversationRef,
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
  };
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1]?.trim();
  return value || undefined;
}

function ok(stdout: string): CliResult {
  return {
    exitCode: 0,
    stdout,
    stderr: "",
  };
}

function fail(stderr: string): CliResult {
  return {
    exitCode: 1,
    stdout: "",
    stderr,
  };
}

function helpText(): string {
  return [
    "Loanslam Phase 0 core commands",
    "",
    "Commands:",
    "  turn --message <text>             Run one real planner-backed turn",
    "  simulate [--trace-output <path>]  Run the representative journey suite",
    "  compare [--output <path>]         Write a model comparison report",
    "",
    "Planner-backed commands require OPENAI_API_KEY. Use OPENAI_MODEL to override the default model.",
    `Policy version: ${policyVersion}`,
  ].join("\n");
}

function ignoreBrokenPipe(error: NodeJS.ErrnoException): void {
  if (error.code !== "EPIPE") {
    throw error;
  }
}

if (
  process.argv[1]?.endsWith("cli.ts") ||
  process.argv[1]?.endsWith("cli.js")
) {
  process.stdout.on("error", ignoreBrokenPipe);
  process.stderr.on("error", ignoreBrokenPipe);

  const result = await runCli();

  if (result.stdout) {
    process.stdout.write(`${result.stdout}\n`);
  }

  if (result.stderr) {
    process.stderr.write(`${result.stderr}\n`);
  }

  process.exitCode = result.exitCode;
}
