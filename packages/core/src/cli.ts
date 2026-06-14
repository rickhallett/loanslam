import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  stochasticProfileSchema,
  type ConversationState,
  type StochasticProfile,
  type TurnPlanner,
} from "@loanslam/contracts";

import { loadCorpusFromFile } from "./corpus";
import { processTurn } from "./engine";
import { createLabServer } from "./lab/server";
import {
  loadOpenAiPlannerConfig,
  PlannerConfigurationError,
} from "./planners/config";
import { OpenAiTurnPlanner } from "./planners/openaiPlanner";
import { policyVersion } from "./policy";
import { buildModelComparisonReport } from "./simulation/report";
import { journeyFixtures } from "./simulation/journeys";
import { runJourneySuite } from "./simulation/runner";
import { defaultPersonaScenarios } from "./simulation/personas";
import {
  runPersonaSuite,
  writeTranscriptJsonl,
} from "./simulation/personaRunner";
import { buildPersonaReport } from "./simulation/personaReport";
import { runStochasticTestSimulator } from "./stochastic/runner";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CliIo {
  readLine(prompt: string): Promise<string | null>;
  writeLine(line: string): void;
  close?(): void;
  captureOutput?: boolean;
}

export interface CliOptions {
  io?: CliIo;
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
  options: CliOptions = {},
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

    if (command === "persona-simulate") {
      return await runPersonaSimulation(rest, plannerFactory);
    }

    if (command === "stochastic") {
      return await runStochasticSimulation(rest, plannerFactory);
    }

    if (command === "chat") {
      return await runInteractiveChat(rest, plannerFactory, options);
    }

    if (command === "serve") {
      return await runServer(rest, plannerFactory);
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
  const normalizedArgs = stripOptionSeparator(args);
  const message =
    readRestOption(normalizedArgs, "--message") ??
    normalizedArgs.join(" ").trim();

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

async function runPersonaSimulation(
  args: string[],
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  const transcriptOutputPath =
    readOption(args, "--transcripts-output") ??
    join(defaultTraceDir, `persona-transcripts-${Date.now()}.jsonl`);
  const reportOutputPath =
    readOption(args, "--report-output") ??
    join(defaultTraceDir, `persona-report-${Date.now()}.json`);
  const planner = plannerFactory();
  const transcripts = await runPersonaSuite({
    scenarios: defaultPersonaScenarios,
    corpus: loadCorpusFromFile().items,
    planner,
  });
  const report = buildPersonaReport({
    runId: `phase0-persona-${Date.now()}`,
    planner: planner.metadata,
    transcripts,
    transcriptOutputPath,
  });

  writeTranscriptJsonl(transcriptOutputPath, transcripts);
  mkdirSync(dirname(reportOutputPath), { recursive: true });
  writeFileSync(
    reportOutputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  return ok(
    JSON.stringify(
      {
        transcriptCount: transcripts.length,
        transcriptOutputPath,
        reportOutputPath,
        report,
      },
      null,
      2,
    ),
  );
}

async function runStochasticSimulation(
  args: string[],
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  const options = parseStochasticArgs(args);

  if (options.help) {
    return ok(stochasticHelpText());
  }

  const result = await runStochasticTestSimulator({
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
    profile: options.profile,
    ...(options.scenarioPath !== undefined
      ? { scenarioPath: options.scenarioPath }
      : {}),
    ...(options.outputDir !== undefined
      ? { outputDir: options.outputDir }
      : {}),
    ...(options.summaryOutput !== undefined
      ? { summaryOutput: options.summaryOutput }
      : {}),
    corpus: loadCorpusFromFile().items,
    planner: plannerFactory(),
  });

  if (options.json) {
    return ok(
      JSON.stringify({
        seed: result.run.seed,
        profile: result.run.profile,
        verdict: result.run.verdict,
        artifacts: result.run.artifacts,
        replay: result.run.replay,
      }),
    );
  }

  return ok(stochasticRunText(result.run));
}

async function runInteractiveChat(
  args: string[],
  plannerFactory: PlannerFactory,
  options: CliOptions,
): Promise<CliResult> {
  const showTrace = args.includes("--trace");
  const io = options.io ?? createTerminalIo();
  const outputLines: string[] = [];
  let state = emptyConversationState("cli-chat");

  try {
    writeLine(io, outputLines, "Loanslam Phase 0 chat. Type /exit to leave.");

    while (true) {
      const message = await io.readLine("> ");

      if (message === null) {
        break;
      }

      const trimmed = message.trim();

      if (!trimmed || trimmed === "/exit" || trimmed === "/quit") {
        break;
      }

      const result = await processTurn({
        state,
        userMessage: trimmed,
        planner: plannerFactory(),
        corpus: loadCorpusFromFile().items,
      });
      state = result.state;
      writeLine(io, outputLines, result.customerMessage);

      if (showTrace) {
        writeLine(
          io,
          outputLines,
          JSON.stringify(
            {
              finalAction: result.finalAction,
              selectedServingMode: result.trace.selectedServingMode,
              effectiveServingMode: result.trace.effectiveServingMode,
              safetyFlags: result.trace.safetyFlags,
              validatorOverrides: result.validatorOverrides,
              retrievedItemIds: result.trace.retrievedMatches.map(
                (match) => match.itemId,
              ),
            },
            null,
            2,
          ),
        );
      }
    }
  } finally {
    io.close?.();
  }

  return ok(io.captureOutput === false ? "" : outputLines.join("\n"));
}

async function runServer(
  args: string[],
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  if (args.includes("--help") || args.includes("-h")) {
    return ok(serverHelpText());
  }

  const port = Number(readOption(args, "--port") ?? "8787");

  if (!Number.isInteger(port) || port <= 0) {
    return fail("--port must be a positive integer.");
  }

  const server = createLabServer({
    corpus: loadCorpusFromFile().items,
    plannerFactory,
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", resolve);
  });

  return ok(`Loanslam Phase 0 lab API listening on http://127.0.0.1:${port}`);
}

interface StochasticCliArgs {
  seed?: string;
  profile: StochasticProfile;
  scenarioPath?: string;
  outputDir?: string;
  summaryOutput?: string;
  json: boolean;
  help: boolean;
}

function parseStochasticArgs(args: string[]): StochasticCliArgs {
  const normalizedArgs = stripOptionSeparator(args);
  const parsed: StochasticCliArgs = {
    profile: "review",
    json: false,
    help: false,
  };

  for (let index = 0; index < normalizedArgs.length; index += 1) {
    const arg = normalizedArgs[index];

    switch (arg) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--json":
        parsed.json = true;
        break;
      case "--seed":
        parsed.seed = readRequiredOptionValue(normalizedArgs, index, "--seed");
        index += 1;
        break;
      case "--profile": {
        const profile = readRequiredOptionValue(
          normalizedArgs,
          index,
          "--profile",
        );
        const profileResult = stochasticProfileSchema.safeParse(profile);

        if (!profileResult.success) {
          throw new Error("--profile must be one of smoke, review, or soak.");
        }

        parsed.profile = profileResult.data;
        index += 1;
        break;
      }
      case "--scenario":
        parsed.scenarioPath = readRequiredOptionValue(
          normalizedArgs,
          index,
          "--scenario",
        );
        index += 1;
        break;
      case "--output-dir":
        parsed.outputDir = readRequiredOptionValue(
          normalizedArgs,
          index,
          "--output-dir",
        );
        index += 1;
        break;
      case "--summary-output":
        parsed.summaryOutput = readRequiredOptionValue(
          normalizedArgs,
          index,
          "--summary-output",
        );
        index += 1;
        break;
      default:
        throw new Error(`Unknown stochastic option: ${arg}`);
    }
  }

  return parsed;
}

function readRequiredOptionValue(
  args: readonly string[],
  index: number,
  name: string,
): string {
  const value = args[index + 1]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
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

function readRestOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const values = args
    .slice(index + 1)
    .filter((value) => value !== "--")
    .join(" ")
    .trim();

  return values || undefined;
}

function stripOptionSeparator(args: string[]): string[] {
  return args[0] === "--" ? args.slice(1) : args;
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
    "  persona-simulate                  Run the persona scenario suite",
    "  stochastic                        Run the StochasticTestSimulator",
    "  chat [--trace]                    Drive the engine turn by turn",
    "  serve [--port <port>]             Start the dev-only lab API",
    "",
    "Planner-backed commands require OPENAI_API_KEY. Use OPENAI_MODEL to override the default model.",
    `Policy version: ${policyVersion}`,
  ].join("\n");
}

function stochasticHelpText(): string {
  return [
    "Loanslam Phase 0 stochastic simulator",
    "",
    "Usage:",
    "  stochastic [--seed <value>] [--profile smoke|review|soak]",
    "             [--scenario <scenarioPath>] [--output-dir <path>]",
    "             [--summary-output <path>] [--json]",
    "",
    "Options:",
    "  --seed <value>           Replayable filename-safe run seed",
    "  --profile <profile>      Scenario volume: smoke, review, or soak",
    "  --scenario <path>        Replay one generated scenario path",
    "  --output-dir <path>      Directory for run JSON and JSONL artifacts",
    "  --summary-output <path>  Override the Markdown summary path",
    "  --json                   Print compact JSON stdout",
    "",
    "Planner-backed commands require OPENAI_API_KEY. Use OPENAI_MODEL to override the default model.",
  ].join("\n");
}

function stochasticRunText(
  run: Awaited<ReturnType<typeof runStochasticTestSimulator>>["run"],
): string {
  return [
    `STS ${run.profile} run complete: ${run.verdict}`,
    `Seed: ${run.seed}`,
    `Summary: ${run.artifacts.summaryMarkdown}`,
    `Run: ${run.artifacts.runJson}`,
    `Scenarios: ${run.artifacts.scenariosJsonl}`,
    `Traces: ${run.artifacts.tracesJsonl}`,
    `Dashboard: ${run.artifacts.dashboardHtml}`,
    "",
    "Replay full run:",
    run.replay.fullRunCommand,
  ].join("\n");
}

function serverHelpText(): string {
  return [
    "Loanslam Phase 0 lab API",
    "",
    "Usage:",
    "  serve [--port <port>]",
    "",
    "Routes:",
    "  POST /sessions",
    "  POST /sessions/:conversationRef/messages",
    "  GET  /sessions/:conversationRef",
    "  POST /sessions/:conversationRef/reset",
    "",
    "This is a local lab surface over processTurn, not the production API.",
  ].join("\n");
}

function createTerminalIo(): CliIo {
  const terminal = createInterface({ input, output });

  return {
    captureOutput: false,
    async readLine(prompt: string) {
      return await terminal.question(prompt);
    },
    writeLine(line: string) {
      output.write(`${line}\n`);
    },
    close() {
      terminal.close();
    },
  };
}

function writeLine(io: CliIo, outputLines: string[], line: string): void {
  outputLines.push(line);
  io.writeLine(line);
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
