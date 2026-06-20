import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type {
  CorpusItem,
  PlannerMetadata,
  SignalExtractor,
  TurnPlanner,
} from "@loanslam/contracts";

import { policyVersion } from "../policy";
import { buildHellWeekReport } from "./aggregate";
import { openHellWeekReportStore } from "./db";
import { gradeScenario } from "./grade";
import { renderHellWeekReportHtml } from "./htmlReport";
import { renderHellWeekJasmineHtml } from "./jasmineReport";
import { runHellWeek } from "./runner";
import { assertUniqueScenarioIds, selectScenarios } from "./scenarios";
import type {
  HellWeekGrade,
  HellWeekReport,
  HellWeekScenario,
  HellWeekScenarioEvidence,
  JudgeVerdict,
} from "./types";

type PlannerWithMetadata = TurnPlanner & { metadata?: PlannerMetadata };

export type HellWeekTheme = "minimal" | "jasmine";

function renderReportHtml(
  report: HellWeekReport,
  theme: HellWeekTheme,
): string {
  return theme === "jasmine"
    ? renderHellWeekJasmineHtml(report)
    : renderHellWeekReportHtml(report);
}

export interface ExecuteHellWeekInput {
  profile: string;
  corpus: readonly CorpusItem[];
  planner: PlannerWithMetadata;
  signalExtractor?: SignalExtractor;
  outBaseDir: string;
  runId?: string;
  concurrency?: number;
  judgeVerdicts?: Map<string, JudgeVerdict>;
  theme?: HellWeekTheme;
  now?: () => Date;
  onProgress?: (message: string) => void;
}

export interface HellWeekRunArtifacts {
  runId: string;
  runDir: string;
  reportJsonPath: string;
  reportHtmlPath: string;
  evidenceJsonPath: string;
  judgeQueuePath: string;
  scenariosDir: string;
  report: HellWeekReport;
}

function defaultRunId(now: Date, profile: string): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `hell-week-${profile}-${stamp}`;
}

function plannerMeta(planner: PlannerWithMetadata): PlannerMetadata {
  return (
    planner.metadata ?? {
      provider: "unknown",
      model: "unknown",
      promptVersion: "unknown",
    }
  );
}

function signalMeta(signalExtractor?: SignalExtractor): {
  enabled: boolean;
  model?: string;
  promptVersion?: string;
} {
  const metadata = (
    signalExtractor as { metadata?: { model?: string; promptVersion?: string } }
  )?.metadata;

  if (!signalExtractor) {
    return { enabled: false };
  }

  return {
    enabled: true,
    ...(metadata?.model ? { model: metadata.model } : {}),
    ...(metadata?.promptVersion
      ? { promptVersion: metadata.promptVersion }
      : {}),
  };
}

function grade(
  scenarios: readonly HellWeekScenario[],
  evidence: readonly HellWeekScenarioEvidence[],
  judgeVerdicts?: Map<string, JudgeVerdict>,
): HellWeekGrade[] {
  const evidenceById = new Map(evidence.map((item) => [item.scenarioId, item]));

  return scenarios.map((scenario) => {
    const scenarioEvidence = evidenceById.get(scenario.id) ?? {
      scenarioId: scenario.id,
      conversationRef: `hellweek-${scenario.id}`,
      turns: [],
      durationMs: 0,
      error: "No evidence captured for scenario.",
    };
    return gradeScenario(
      scenario,
      scenarioEvidence,
      judgeVerdicts?.get(scenario.id),
    );
  });
}

function writeRunArtifacts({
  runDir,
  runId,
  report,
  scenarios,
  evidence,
  theme,
}: {
  runDir: string;
  runId: string;
  report: HellWeekReport;
  scenarios: readonly HellWeekScenario[];
  evidence: readonly HellWeekScenarioEvidence[];
  theme: HellWeekTheme;
}): HellWeekRunArtifacts {
  mkdirSync(runDir, { recursive: true });
  const scenariosDir = join(runDir, "scenarios");
  mkdirSync(scenariosDir, { recursive: true });

  const reportJsonPath = join(runDir, "report.json");
  const reportHtmlPath = join(runDir, "report.html");
  const evidenceJsonPath = join(runDir, "evidence.json");
  const judgeQueuePath = join(runDir, "judge-queue.jsonl");

  writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(reportHtmlPath, renderReportHtml(report, theme), "utf8");
  writeFileSync(
    evidenceJsonPath,
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  const scenarioById = new Map(scenarios.map((s) => [s.id, s]));
  const evidenceById = new Map(evidence.map((e) => [e.scenarioId, e]));

  // Per-scenario packets the LLM judge reads, plus a single queue file.
  const queueLines: string[] = [];
  for (const scenario of scenarios) {
    const packet = {
      scenario,
      evidence: evidenceById.get(scenario.id) ?? null,
    };
    writeFileSync(
      join(scenariosDir, `${scenario.id}.json`),
      `${JSON.stringify(packet, null, 2)}\n`,
      "utf8",
    );
    queueLines.push(JSON.stringify({ scenarioId: scenario.id }));
  }
  // scenarioById is intentionally unused beyond validation of membership.
  void scenarioById;
  writeFileSync(judgeQueuePath, `${queueLines.join("\n")}\n`, "utf8");

  return {
    runId,
    runDir,
    reportJsonPath,
    reportHtmlPath,
    evidenceJsonPath,
    judgeQueuePath,
    scenariosDir,
    report,
  };
}

/** Drive the gauntlet live, grade, and write the run folder. */
export async function executeHellWeek(
  input: ExecuteHellWeekInput,
): Promise<HellWeekRunArtifacts> {
  const now = input.now ?? (() => new Date());
  const scenarios = selectScenarios(input.profile);
  assertUniqueScenarioIds(scenarios);

  const runId = input.runId ?? defaultRunId(now(), input.profile);
  const runDir = join(input.outBaseDir, runId);
  const startedAt = Date.now();

  input.onProgress?.(
    `Running ${scenarios.length} scenarios (${input.profile}) against ${plannerMeta(input.planner).model}...`,
  );

  const evidence = await runHellWeek({
    scenarios,
    corpus: input.corpus,
    planner: input.planner,
    ...(input.signalExtractor
      ? { signalExtractor: input.signalExtractor }
      : {}),
    ...(input.concurrency ? { concurrency: input.concurrency } : {}),
    onScenarioComplete: (item, completed, total) => {
      const flag = item.error ? " [error]" : "";
      input.onProgress?.(`  [${completed}/${total}] ${item.scenarioId}${flag}`);
    },
  });

  const grades = grade(scenarios, evidence, input.judgeVerdicts);
  const report = buildHellWeekReport({
    runId,
    generatedAt: now().toISOString(),
    profile: input.profile,
    planner: plannerMeta(input.planner),
    signalExtractor: signalMeta(input.signalExtractor),
    policyVersion,
    judged: Boolean(input.judgeVerdicts && input.judgeVerdicts.size > 0),
    durationMs: Date.now() - startedAt,
    scenarios,
    evidence,
    grades,
  });

  return writeRunArtifacts({
    runDir,
    runId,
    report,
    scenarios,
    evidence,
    theme: input.theme ?? "minimal",
  });
}

/**
 * Re-grade and re-render from a previously captured run folder, optionally
 * merging LLM judge verdicts. No live model calls.
 */
export function renderFromRun({
  runDir,
  judgeVerdicts,
  theme = "minimal",
  now = () => new Date(),
}: {
  runDir: string;
  judgeVerdicts?: Map<string, JudgeVerdict>;
  theme?: HellWeekTheme;
  now?: () => Date;
}): HellWeekRunArtifacts {
  const evidence = JSON.parse(
    readFileSync(join(runDir, "evidence.json"), "utf8"),
  ) as HellWeekScenarioEvidence[];
  const priorReport = JSON.parse(
    readFileSync(join(runDir, "report.json"), "utf8"),
  ) as HellWeekReport;

  const scenarios = priorReport.scenarios;
  const grades = grade(scenarios, evidence, judgeVerdicts);
  const report = buildHellWeekReport({
    runId: priorReport.runId,
    generatedAt: now().toISOString(),
    profile: priorReport.profile,
    planner: priorReport.planner,
    signalExtractor: priorReport.signalExtractor,
    policyVersion: priorReport.policyVersion,
    judged: Boolean(judgeVerdicts && judgeVerdicts.size > 0),
    durationMs: priorReport.durationMs,
    scenarios,
    evidence,
    grades,
  });

  return writeRunArtifacts({
    runDir,
    runId: priorReport.runId,
    report,
    scenarios,
    evidence,
    theme,
  });
}

export async function storeHellWeekReport({
  report,
  databaseUrl,
}: {
  report: HellWeekReport;
  databaseUrl?: string;
}): Promise<void> {
  const store = openHellWeekReportStore(databaseUrl);

  try {
    await store.saveReport(report);
  } finally {
    await store.close();
  }
}

export async function renderFromDatabase({
  runId,
  databaseUrl,
  outBaseDir,
  theme = "minimal",
}: {
  runId: string;
  databaseUrl?: string;
  outBaseDir: string;
  theme?: HellWeekTheme;
}): Promise<HellWeekRunArtifacts> {
  const store = openHellWeekReportStore(databaseUrl);

  try {
    const report = await store.loadReport(runId);

    if (!report) {
      throw new Error(`No Hell Week run found in Postgres for ${runId}.`);
    }

    return writeRunArtifacts({
      runDir: join(outBaseDir, report.runId),
      runId: report.runId,
      report,
      scenarios: report.scenarios,
      evidence: report.evidence,
      theme,
    });
  } finally {
    await store.close();
  }
}

export function loadJudgeVerdicts(path: string): Map<string, JudgeVerdict> {
  const raw = readFileSync(path, "utf8").trim();
  const verdicts: JudgeVerdict[] = [];

  if (raw.startsWith("[")) {
    verdicts.push(...(JSON.parse(raw) as JudgeVerdict[]));
  } else {
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) {
        verdicts.push(JSON.parse(trimmed) as JudgeVerdict);
      }
    }
  }

  const map = new Map<string, JudgeVerdict>();
  for (const verdict of verdicts) {
    if (verdict && typeof verdict.scenarioId === "string") {
      map.set(verdict.scenarioId, verdict);
    }
  }
  return map;
}
