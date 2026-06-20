import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
import { loadOpenAiSignalExtractorConfig } from "./signals/config";
import { OpenAiSignalExtractor } from "./signals/openaiSignalExtractor";
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
import { buildRouteAuditArtifacts } from "./routeAudit";
import {
  executeHellWeek,
  loadJudgeVerdicts,
  renderFromDatabase,
  renderFromRun,
  storeHellWeekReport,
  type HellWeekRunArtifacts,
} from "./hellweek/run";
import { openHellWeekReportStore } from "./hellweek/db";
import {
  buildHellWeekStabilityReport,
  writeHellWeekStabilityArtifacts,
  type HellWeekStabilityArtifacts,
} from "./hellweek/stability";
import {
  compareHellWeekReportsFromPaths,
  formatHellWeekComparison,
  toHellWeekComparisonJson,
} from "./hellweek/compare";

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

type CliEnv = Record<string, string | undefined>;

const defaultTraceDir = "artifacts/phase0";
const demoInteractionDatabaseUrlHelp =
  "DEMO_INTERACTION_DATABASE_URL or DATABASE_URL";

export async function runCli(
  args = process.argv.slice(2),
  env: CliEnv = process.env,
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
      return await runTurn(rest, env, plannerFactory);
    }

    if (command === "simulate") {
      return await runSimulation(rest, env, plannerFactory);
    }

    if (command === "compare") {
      return await runComparison(rest, env, plannerFactory);
    }

    if (command === "persona-simulate") {
      return await runPersonaSimulation(rest, env, plannerFactory);
    }

    if (command === "stochastic") {
      return await runStochasticSimulation(rest, env, plannerFactory);
    }

    if (command === "route-audit") {
      return runRouteAudit(rest);
    }

    if (command === "hell-week") {
      return await runHellWeekCommand(rest, env, plannerFactory);
    }

    if (command === "hell-week-compare") {
      return runHellWeekCompareCommand(rest);
    }

    if (command === "hell-week-stability") {
      return await runHellWeekStabilityCommand(rest, env);
    }

    if (command === "chat") {
      return await runInteractiveChat(rest, env, plannerFactory, options);
    }

    if (command === "serve") {
      return await runServer(rest, env, plannerFactory);
    }

    if (command === "demo-log") {
      return await runDemoLog(rest, env);
    }

    return fail(`Unknown command: ${command}\n\n${helpText()}`);
  } catch (error) {
    if (error instanceof PlannerConfigurationError) {
      return fail(error.message);
    }

    return fail(error instanceof Error ? error.message : String(error));
  }
}

function createSignalExtractor(
  env = process.env,
): OpenAiSignalExtractor | undefined {
  const config = loadOpenAiSignalExtractorConfig(env);

  if (!config) {
    return undefined;
  }

  return new OpenAiSignalExtractor({ config });
}

function signalExtractorInput(
  signalExtractor: OpenAiSignalExtractor | undefined,
): { signalExtractor?: OpenAiSignalExtractor } {
  return signalExtractor ? { signalExtractor } : {};
}

function readDemoInteractionDatabaseUrl(env: CliEnv): string | undefined {
  return (
    env.DEMO_INTERACTION_DATABASE_URL ??
    env.DATABASE_URL ??
    env.POSTGRES_PRISMA_URL ??
    env.POSTGRES_URL
  );
}

function readHellWeekDatabaseUrl(env: CliEnv): string | undefined {
  return env.HELL_WEEK_DATABASE_URL ?? readDemoInteractionDatabaseUrl(env);
}

async function runTurn(
  args: string[],
  env: CliEnv,
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
  const signalExtractor = createSignalExtractor(env);
  const result = await processTurn({
    state: emptyConversationState("cli-turn"),
    userMessage: message,
    planner,
    ...(signalExtractor ? { signalExtractor } : {}),
    corpus: loadCorpusFromFile().items,
  });

  return ok(JSON.stringify(result, null, 2));
}

async function runSimulation(
  args: string[],
  env: CliEnv,
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  const outputPath =
    readOption(args, "--trace-output") ??
    join(defaultTraceDir, `traces-${Date.now()}.jsonl`);
  const planner = plannerFactory();
  const signalExtractor = createSignalExtractor(env);
  const reports = await runJourneySuite({
    journeys: journeyFixtures,
    corpus: loadCorpusFromFile().items,
    planner,
    ...(signalExtractor ? { signalExtractor } : {}),
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
  env: CliEnv,
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  const outputPath =
    readOption(args, "--output") ??
    join(defaultTraceDir, `comparison-${Date.now()}.json`);
  const planner = plannerFactory();
  const signalExtractor = createSignalExtractor(env);
  const reports = await runJourneySuite({
    journeys: journeyFixtures,
    corpus: loadCorpusFromFile().items,
    ...(signalExtractor ? { signalExtractor } : {}),
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
  env: CliEnv,
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  const transcriptOutputPath =
    readOption(args, "--transcripts-output") ??
    join(defaultTraceDir, `persona-transcripts-${Date.now()}.jsonl`);
  const reportOutputPath =
    readOption(args, "--report-output") ??
    join(defaultTraceDir, `persona-report-${Date.now()}.json`);
  const planner = plannerFactory();
  const signalExtractor = createSignalExtractor(env);
  const transcripts = await runPersonaSuite({
    scenarios: defaultPersonaScenarios,
    corpus: loadCorpusFromFile().items,
    ...(signalExtractor ? { signalExtractor } : {}),
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
  env: CliEnv,
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
    ...signalExtractorInput(createSignalExtractor(env)),
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

function runRouteAudit(args: string[]): CliResult {
  const options = parseRouteAuditArgs(args);

  if (options.help) {
    return ok(routeAuditHelpText());
  }

  if (!options.runFolder) {
    return fail(routeAuditHelpText());
  }

  const result = buildRouteAuditArtifacts({
    runFolder: options.runFolder,
    ...(options.jsonOutputPath
      ? { jsonOutputPath: options.jsonOutputPath }
      : {}),
    ...(options.markdownOutputPath
      ? { markdownOutputPath: options.markdownOutputPath }
      : {}),
  });

  return ok(
    JSON.stringify(
      {
        jsonOutputPath: result.jsonOutputPath,
        markdownOutputPath: result.markdownOutputPath,
        scenarioCount: result.audit.scenarioCount,
        turnCount: result.audit.turnCount,
        routeForScoringCounts: result.audit.routeForScoringCounts,
        findingSourceCounts: result.audit.findingSourceCounts,
      },
      null,
      2,
    ),
  );
}

function resolveHellWeekSignalExtractor(
  mode: string,
  env: CliEnv,
): OpenAiSignalExtractor | undefined {
  if (mode === "off") {
    return undefined;
  }

  if (mode === "on") {
    const config = loadOpenAiSignalExtractorConfig({
      ...env,
      OPENAI_SIGNAL_EXTRACTOR_ENABLED: "1",
    });
    return config ? new OpenAiSignalExtractor({ config }) : undefined;
  }

  return createSignalExtractor(env);
}

function hellWeekSummary(
  artifacts: HellWeekRunArtifacts,
  asJson: boolean,
): string {
  const { report } = artifacts;

  if (asJson) {
    return JSON.stringify({
      runId: artifacts.runId,
      verdict: report.verdict,
      totals: report.totals,
      safetyFloorBreached: report.safetyFloor.breached,
      reportHtmlPath: artifacts.reportHtmlPath,
      runDir: artifacts.runDir,
    });
  }

  return [
    `Hell Week: ${report.verdict.toUpperCase()}`,
    report.headline,
    "",
    `Scenarios: ${report.totals.passed}/${report.totals.scenarios} pass (${Math.round(report.totals.passRate * 100)}%)`,
    `Demo-killers: ${report.totals.demoKillers} · Dents: ${report.totals.dents} · Errored: ${report.totals.errored}`,
    `Safety floor: ${report.safetyFloor.breached ? "BREACHED" : "holding"} (${report.safetyFloor.pass}/${report.safetyFloor.total})`,
    report.deflection.total > 0
      ? `Deflection: ${Math.round(report.deflection.rate * 100)}% (${report.deflection.answered}/${report.deflection.total})`
      : "Deflection: n/a",
    "",
    `Report: ${artifacts.reportHtmlPath}`,
    `Run dir: ${artifacts.runDir}`,
    report.judged
      ? "Graded with LLM judge verdicts."
      : `Judge inputs: ${artifacts.scenariosDir}`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function hellWeekStabilitySummary(
  artifacts: HellWeekStabilityArtifacts,
  asJson: boolean,
): string {
  const { report } = artifacts;

  if (asJson) {
    return JSON.stringify({
      setId: report.setId,
      profile: report.profile,
      runCount: report.runCount,
      scenarioCount: report.scenarioCount,
      summary: report.summary,
      scenarioSetChanged: report.scenarioSetChanged,
      reportHtmlPath: artifacts.reportHtmlPath,
      runDir: artifacts.runDir,
    });
  }

  return [
    `Hell Week stability: ${report.label}`,
    `Runs: ${report.runCount} · Scenarios: ${report.scenarioCount}`,
    `Stable pass: ${report.summary.stablePass}`,
    `Stable failure: ${report.summary.stableFailure}`,
    `Recurring failure: ${report.summary.recurringFailure}`,
    `One-off failure: ${report.summary.oneOffFailure}`,
    `Mixed: ${report.summary.mixed}`,
    report.scenarioSetChanged
      ? "Scenario sets changed: inspect mixed/missing rows before acting."
      : "Scenario sets: stable",
    "",
    `Report: ${artifacts.reportHtmlPath}`,
    `Run dir: ${artifacts.runDir}`,
  ].join("\n");
}

async function runHellWeekCommand(
  args: string[],
  env: CliEnv,
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  const normalized = stripOptionSeparator(args);

  if (normalized.includes("--help") || normalized.includes("-h")) {
    return ok(hellWeekHelpText());
  }

  const profile = readOption(normalized, "--profile") ?? "full";
  const outBaseDir = readOption(normalized, "--out") ?? defaultTraceDir;
  const concurrencyRaw = readOption(normalized, "--concurrency");
  const concurrency = concurrencyRaw ? Number(concurrencyRaw) : undefined;
  const fromDir = readOption(normalized, "--from");
  const fromDb = readOption(normalized, "--from-db");
  const judgePath = readOption(normalized, "--judge-verdicts");
  const signalsMode = readOption(normalized, "--signals") ?? "on";
  const theme = readOption(normalized, "--theme") ?? "minimal";
  const asJson = normalized.includes("--json");
  const storeDb = normalized.includes("--store-db");
  const databaseUrl =
    readOption(normalized, "--database-url") ??
    readOption(normalized, "--db") ??
    readHellWeekDatabaseUrl(env);

  if (
    concurrency !== undefined &&
    (!Number.isInteger(concurrency) || concurrency <= 0)
  ) {
    return fail("--concurrency must be a positive integer.");
  }

  if (theme !== "minimal" && theme !== "jasmine") {
    return fail("--theme must be minimal or jasmine.");
  }

  const judgeVerdicts = judgePath ? loadJudgeVerdicts(judgePath) : undefined;

  if (fromDir && fromDb) {
    return fail("Use only one of --from or --from-db.");
  }

  if (fromDb) {
    const artifacts = await renderFromDatabase({
      runId: fromDb,
      outBaseDir,
      theme,
      ...(databaseUrl ? { databaseUrl } : {}),
    });
    return ok(hellWeekSummary(artifacts, asJson));
  }

  if (fromDir) {
    const artifacts = renderFromRun({
      runDir: fromDir,
      theme,
      ...(judgeVerdicts ? { judgeVerdicts } : {}),
    });

    if (storeDb) {
      await storeHellWeekReport({
        report: artifacts.report,
        ...(databaseUrl ? { databaseUrl } : {}),
      });
    }

    return ok(hellWeekSummary(artifacts, asJson));
  }

  const signalExtractor = resolveHellWeekSignalExtractor(signalsMode, env);
  const planner = plannerFactory();
  const artifacts = await executeHellWeek({
    profile,
    corpus: loadCorpusFromFile().items,
    planner,
    ...(signalExtractor ? { signalExtractor } : {}),
    outBaseDir,
    theme,
    ...(concurrency ? { concurrency } : {}),
    ...(judgeVerdicts ? { judgeVerdicts } : {}),
    onProgress: (message) => process.stderr.write(`${message}\n`),
  });

  if (storeDb) {
    await storeHellWeekReport({
      report: artifacts.report,
      ...(databaseUrl ? { databaseUrl } : {}),
    });
  }

  return ok(hellWeekSummary(artifacts, asJson));
}

function runHellWeekCompareCommand(args: string[]): CliResult {
  const normalized = stripOptionSeparator(args);

  if (normalized.includes("--help") || normalized.includes("-h")) {
    return ok(hellWeekCompareHelpText());
  }

  const asJson = normalized.includes("--json");
  const positional = normalized.filter((arg) => !arg.startsWith("--"));
  const [baselinePath, candidatePath] = positional;

  if (!baselinePath || !candidatePath) {
    return fail(hellWeekCompareHelpText());
  }

  const comparison = compareHellWeekReportsFromPaths(
    baselinePath,
    candidatePath,
  );

  return ok(
    asJson
      ? JSON.stringify(toHellWeekComparisonJson(comparison))
      : formatHellWeekComparison(comparison),
  );
}

async function runHellWeekStabilityCommand(
  args: string[],
  env: CliEnv,
): Promise<CliResult> {
  const normalized = stripOptionSeparator(args);

  if (normalized.includes("--help") || normalized.includes("-h")) {
    return ok(hellWeekStabilityHelpText());
  }

  const fromDb = readOption(normalized, "--from-db");
  const runsRaw = readOption(normalized, "--runs");
  const setId =
    readOption(normalized, "--set-id") ??
    `hell-week-stability-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const label = readOption(normalized, "--label");
  const outBaseDir = readOption(normalized, "--out") ?? defaultTraceDir;
  const asJson = normalized.includes("--json");
  const databaseUrl =
    readOption(normalized, "--database-url") ??
    readOption(normalized, "--db") ??
    readHellWeekDatabaseUrl(env);

  const store = openHellWeekReportStore(databaseUrl);

  try {
    if (fromDb) {
      const report = await store.loadStabilityReport(fromDb);

      if (!report) {
        return fail(
          `No Hell Week stability report found in Postgres for ${fromDb}.`,
        );
      }

      return ok(
        hellWeekStabilitySummary(
          writeHellWeekStabilityArtifacts({ report, outBaseDir }),
          asJson,
        ),
      );
    }

    const runIds = (runsRaw ?? "")
      .split(",")
      .map((runId) => runId.trim())
      .filter(Boolean);

    if (runIds.length < 2) {
      return fail(hellWeekStabilityHelpText());
    }

    const runs = await store.loadReports(runIds);
    const report = buildHellWeekStabilityReport({
      setId,
      ...(label ? { label } : {}),
      runs,
    });

    await store.saveStabilityReport(report);

    return ok(
      hellWeekStabilitySummary(
        writeHellWeekStabilityArtifacts({ report, outBaseDir }),
        asJson,
      ),
    );
  } finally {
    await store.close();
  }
}

async function runInteractiveChat(
  args: string[],
  env: CliEnv,
  plannerFactory: PlannerFactory,
  options: CliOptions,
): Promise<CliResult> {
  const showTrace = args.includes("--trace");
  const io = options.io ?? createTerminalIo();
  const outputLines: string[] = [];
  let state = emptyConversationState("cli-chat");
  const signalExtractor = createSignalExtractor(env);

  try {
    writeLine(io, outputLines, "LoanSlam Phase 0 chat. Type /exit to leave.");

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
        ...(signalExtractor ? { signalExtractor } : {}),
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
  env: CliEnv,
  plannerFactory: PlannerFactory,
): Promise<CliResult> {
  if (args.includes("--help") || args.includes("-h")) {
    return ok(serverHelpText());
  }

  const normalizedArgs = stripOptionSeparator(args);
  const port = Number(
    readOption(normalizedArgs, "--port") ?? env.PORT ?? "8787",
  );
  const host = readOption(normalizedArgs, "--host") ?? env.HOST ?? "127.0.0.1";
  const demoOnly = normalizedArgs.includes("--demo-only");
  const demoStateTokenSecret =
    readOption(normalizedArgs, "--demo-state-token-secret") ??
    env.DEMO_STATE_TOKEN_SECRET ??
    (demoOnly ? randomUUID() : undefined);
  const demoAccessToken =
    readOption(normalizedArgs, "--demo-access-token") ?? env.DEMO_ACCESS_TOKEN;
  const demoInteractionLogDisabled = normalizedArgs.includes("--no-demo-log");
  const demoInteractionDatabaseUrl = demoInteractionLogDisabled
    ? undefined
    : (readOption(normalizedArgs, "--demo-log-database-url") ??
      readDemoInteractionDatabaseUrl(env));
  const demoStaticHostRoot =
    readOption(normalizedArgs, "--demo-static-host-root") ??
    env.DEMO_STATIC_HOST_ROOT;
  const demoStaticWidgetRoot =
    readOption(normalizedArgs, "--demo-static-widget-root") ??
    env.DEMO_STATIC_WIDGET_ROOT;

  if (!Number.isInteger(port) || port <= 0) {
    return fail("--port must be a positive integer.");
  }

  if (demoOnly && !demoInteractionLogDisabled && !demoInteractionDatabaseUrl) {
    return fail(
      `Demo interaction logging requires ${demoInteractionDatabaseUrlHelp}. Pass --no-demo-log to disable owner logging locally.`,
    );
  }

  const demoInteractionLog = demoInteractionDatabaseUrl
    ? (await import("./lab/demoInteractionLog")).openDemoInteractionLog(
        demoInteractionDatabaseUrl,
      )
    : undefined;

  const server = createLabServer({
    corpus: loadCorpusFromFile().items,
    plannerFactory,
    ...signalExtractorInput(createSignalExtractor(env)),
    enableTrustedLabRoutes: !demoOnly,
    enableDemoRoutes: true,
    ...(demoStateTokenSecret ? { demoStateTokenSecret } : {}),
    ...(demoAccessToken ? { demoAccessToken } : {}),
    ...(demoInteractionLog ? { demoInteractionLog } : {}),
    ...(demoStaticHostRoot && demoStaticWidgetRoot
      ? {
          demoStaticAssets: {
            hostRoot: demoStaticHostRoot,
            widgetRoot: demoStaticWidgetRoot,
          },
        }
      : {}),
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });

  return ok(
    demoOnly
      ? `LoanSlam stakeholder demo API listening on http://${host}:${port}`
      : `LoanSlam Phase 0 lab API listening on http://${host}:${port}`,
  );
}

async function runDemoLog(args: string[], env: CliEnv): Promise<CliResult> {
  const parsed = parseDemoLogArgs(args, env);

  if (parsed.help) {
    return ok(demoLogHelpText());
  }

  const {
    openDemoInteractionLog,
    formatDemoLoggedEvent,
    formatDemoLogSession,
    formatDemoLogSummary,
  } = await import("./lab/demoInteractionLog");
  const log = openDemoInteractionLog(parsed.databaseUrl);

  try {
    if (parsed.command === "summary") {
      return ok(formatDemoLogSummary(await log.summaries(parsed.limit)));
    }

    if (parsed.command === "session") {
      return ok(
        formatDemoLogSession({
          events: await log.eventsForSession(parsed.conversationRef),
          includeFullInternal: parsed.full,
        }),
      );
    }

    if (parsed.command === "turn") {
      const event = await log.turnEvent(parsed.conversationRef, parsed.turn);

      return ok(
        event
          ? formatDemoLoggedEvent({
              event,
              includeFullInternal: parsed.full,
            })
          : "No logged message/intake event found for that turn.",
      );
    }

    return fail(demoLogHelpText());
  } finally {
    await log.close();
  }
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

interface RouteAuditCliArgs {
  runFolder?: string;
  jsonOutputPath?: string;
  markdownOutputPath?: string;
  help: boolean;
}

type DemoLogCliArgs =
  | {
      command: "summary";
      databaseUrl: string;
      limit: number;
      full: boolean;
      help: boolean;
    }
  | {
      command: "session";
      databaseUrl: string;
      conversationRef: string;
      full: boolean;
      help: boolean;
    }
  | {
      command: "turn";
      databaseUrl: string;
      conversationRef: string;
      turn: number;
      full: boolean;
      help: boolean;
    }
  | {
      command: "help";
      databaseUrl: string;
      full: boolean;
      help: true;
    };

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

function parseRouteAuditArgs(args: string[]): RouteAuditCliArgs {
  const normalizedArgs = stripOptionSeparator(args);
  const parsed: RouteAuditCliArgs = {
    help: false,
  };

  for (let index = 0; index < normalizedArgs.length; index += 1) {
    const arg = normalizedArgs[index];

    if (arg === undefined) {
      continue;
    }

    switch (arg) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--json-output":
        parsed.jsonOutputPath = readRequiredOptionValue(
          normalizedArgs,
          index,
          "--json-output",
        );
        index += 1;
        break;
      case "--markdown-output":
        parsed.markdownOutputPath = readRequiredOptionValue(
          normalizedArgs,
          index,
          "--markdown-output",
        );
        index += 1;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown route-audit option: ${arg}`);
        }

        if (parsed.runFolder) {
          throw new Error("route-audit accepts only one run folder.");
        }

        parsed.runFolder = arg;
        break;
    }
  }

  return parsed;
}

function parseDemoLogArgs(args: string[], env: CliEnv): DemoLogCliArgs {
  const normalizedArgs = stripOptionSeparator(args);
  const databaseUrl =
    readOption(normalizedArgs, "--database-url") ??
    readOption(normalizedArgs, "--db") ??
    readDemoInteractionDatabaseUrl(env);
  const full = normalizedArgs.includes("--full");
  const help =
    normalizedArgs.includes("--help") ||
    normalizedArgs.includes("-h") ||
    normalizedArgs.length === 0;
  const positional = positionalDemoLogArgs(normalizedArgs);
  const command = positional[0];

  if (help || !command) {
    return {
      command: "help",
      databaseUrl: databaseUrl ?? "",
      full,
      help: true,
    };
  }

  if (!databaseUrl) {
    throw new Error(
      `demo-log requires --database-url or ${demoInteractionDatabaseUrlHelp}.`,
    );
  }

  if (command === "summary") {
    const limitRaw = readOption(normalizedArgs, "--limit") ?? "20";
    const limit = Number(limitRaw);

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("--limit must be a positive integer.");
    }

    return {
      command,
      databaseUrl,
      limit,
      full,
      help: false,
    };
  }

  if (command === "session") {
    const conversationRef = positional[1];

    if (!conversationRef) {
      throw new Error("demo-log session requires a conversationRef.");
    }

    return {
      command,
      databaseUrl,
      conversationRef,
      full,
      help: false,
    };
  }

  if (command === "turn") {
    const conversationRef = positional[1];
    const turn = Number(positional[2]);

    if (!conversationRef) {
      throw new Error("demo-log turn requires a conversationRef.");
    }

    if (!Number.isInteger(turn) || turn <= 0) {
      throw new Error("demo-log turn requires a positive turn number.");
    }

    return {
      command,
      databaseUrl,
      conversationRef,
      turn,
      full,
      help: false,
    };
  }

  throw new Error(`Unknown demo-log command: ${command}`);
}

function positionalDemoLogArgs(args: readonly string[]): string[] {
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (
      arg === "--db" ||
      arg === "--database-url" ||
      arg === "--limit" ||
      arg === "--" ||
      arg === undefined
    ) {
      index += arg === "--" ? 0 : 1;
      continue;
    }

    if (arg === "--full" || arg === "--help" || arg === "-h") {
      continue;
    }

    positional.push(arg);
  }

  return positional;
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
    "LoanSlam Phase 0 core commands",
    "",
    "Commands:",
    "  turn --message <text>             Run one real planner-backed turn",
    "  simulate [--trace-output <path>]  Run the representative journey suite",
    "  compare [--output <path>]         Write a model comparison report",
    "  persona-simulate                  Run the persona scenario suite",
    "  stochastic                        Run the StochasticTestSimulator",
    "  route-audit <run-folder>          Write route-audit JSON and Markdown",
    "  hell-week [--profile full|smoke]  Run the Hell Week gauntlet and write an HTML dashboard",
    "  hell-week-compare <a> <b>         Compare two Hell Week reports or run dirs",
    "  hell-week-stability               Classify repeated Hell Week runs from Postgres",
    "  chat [--trace]                    Drive the engine turn by turn",
    "  serve [--port <port>]             Start the dev-only lab API",
    "  demo-log summary|session|turn      Query stakeholder demo interaction logs",
    "",
    "Planner-backed commands require OPENAI_API_KEY. Use OPENAI_MODEL to override the default model.",
    `Policy version: ${policyVersion}`,
  ].join("\n");
}

function hellWeekCompareHelpText(): string {
  return [
    "LoanSlam Hell Week report comparison",
    "",
    "Usage:",
    "  hell-week-compare <baseline-report-or-run-dir> <candidate-report-or-run-dir> [--json]",
    "",
    "Reads two completed Hell Week report.json files, or run folders containing",
    "report.json, and prints the aggregate and scenario-level movement needed",
    "for the agentic tuning loop. No model calls are made.",
    "",
    "Options:",
    "  --json                  Print compact JSON stdout",
  ].join("\n");
}

function hellWeekStabilityHelpText(): string {
  return [
    "LoanSlam Hell Week stability report",
    "",
    "Usage:",
    "  hell-week-stability --runs <run1,run2,run3> [--set-id <id>]",
    "                      [--label <text>] [--out <dir>] [--db <url>] [--json]",
    "  hell-week-stability --from-db <setId> [--out <dir>] [--db <url>] [--json]",
    "",
    "Loads completed Hell Week runs from Postgres, classifies repeated-run",
    "stability (stable pass, stable failure, recurring failure, one-off failure,",
    "mixed), stores the derived run-set report, and writes report.html/report.json.",
  ].join("\n");
}

function routeAuditHelpText(): string {
  return [
    "LoanSlam Phase 0 route audit",
    "",
    "Usage:",
    "  route-audit <run-folder> [--json-output <path>]",
    "             [--markdown-output <path>]",
    "",
    "The run folder may be the lab API run root, a battery folder, or its logs folder.",
    "Reads summary.json, turn-log.jsonl, and scenario dumps, then writes route-audit.json and route-audit.md.",
  ].join("\n");
}

function hellWeekHelpText(): string {
  return [
    "LoanSlam Hell Week gauntlet",
    "",
    "Usage:",
    "  hell-week [--profile full|smoke] [--out <dir>] [--concurrency <n>]",
    "            [--signals on|off|auto] [--from <runDir>|--from-db <runId>]",
    "            [--store-db] [--db <url>] [--judge-verdicts <path>] [--json]",
    "",
    "Drives the full hostile scenario battery against the live model-backed",
    "engine, grades each scenario (hard safety floor + envelope, plus optional",
    "LLM judge verdicts), and writes report.html / report.json to a run folder.",
    "",
    "Options:",
    "  --profile <id>          full (default) or smoke",
    "  --out <dir>             base output dir (default artifacts/phase0)",
    "  --concurrency <n>       scenarios driven in parallel (default 4)",
    "  --signals <mode>        on (default), off, or auto (env-driven)",
    "  --theme <name>          minimal (default) or jasmine (SpecRunner homage)",
    "  --from <runDir>         re-render from a captured run; no live calls",
    "  --from-db <runId>       render from a persisted Postgres run; no live calls",
    "  --store-db              persist the completed report to Postgres",
    "  --db <url>              Postgres URL (default HELL_WEEK_DATABASE_URL, DEMO_INTERACTION_DATABASE_URL, or DATABASE_URL)",
    "  --judge-verdicts <p>    merge LLM judge verdicts (JSON array or JSONL)",
    "  --json                  print compact JSON summary",
    "",
    "Planner-backed; requires OPENAI_API_KEY. Use OPENAI_MODEL to override the model.",
  ].join("\n");
}

function stochasticHelpText(): string {
  return [
    "LoanSlam Phase 0 stochastic simulator",
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
    "LoanSlam Phase 0 lab API",
    "",
    "Usage:",
    "  serve [--port <port>] [--host <host>] [--demo-only]",
    "",
    "Routes:",
    "  POST /sessions",
    "  POST /sessions/:conversationRef/messages",
    "  GET  /sessions/:conversationRef",
    "  POST /sessions/:conversationRef/reset",
    "  POST /demo/sessions",
    "  POST /demo/sessions/:conversationRef/messages",
    "  POST /demo/sessions/:conversationRef/intake",
    "  POST /demo/sessions/:conversationRef/reset",
    "",
    "Options:",
    "  --host h                      Bind address (default: HOST or 127.0.0.1)",
    "  --demo-only                  Mount only demo-safe /demo routes",
    "  --demo-state-token-secret s  Seal demo state into opaque continuation tokens",
    "  --demo-access-token s        Require a bearer or x-demo-access-token value on /demo routes",
    "  --demo-log-database-url u    Write owner logs to Postgres (default: DEMO_INTERACTION_DATABASE_URL or DATABASE_URL)",
    "  --demo-static-host-root p     Serve the stakeholder host page from this built asset root",
    "  --demo-static-widget-root p   Serve the stakeholder widget from this built asset root",
    "  --no-demo-log                Disable demo interaction logging",
    "",
    "The /sessions routes are local lab evidence surfaces. Use --demo-only for stakeholder demos.",
  ].join("\n");
}

function demoLogHelpText(): string {
  return [
    "LoanSlam stakeholder demo interaction log",
    "",
    "Usage:",
    "  demo-log summary [--database-url <url>] [--limit <n>]",
    "  demo-log session <conversationRef> [--database-url <url>] [--full]",
    "  demo-log turn <conversationRef> <turn> [--database-url <url>] [--full]",
    "",
    "Default database URL:",
    `  ${demoInteractionDatabaseUrlHelp}`,
    "",
    "The default view prints query-friendly decision receipts. Use --full for",
    "owner-only internal JSON stored in the server-side Postgres database.",
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
