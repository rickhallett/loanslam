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
import {
  openAiHellWeekJudgePromptVersion,
  openAiHellWeekJudgeRubricHash,
  openAiHellWeekJudgeTool,
} from "./openaiJudge";
import { runHellWeek } from "./runner";
import { assertUniqueScenarioIds, selectScenarios } from "./scenarios";
import { isJudgeTriageLabel, type JudgeTriageLabel } from "./triageLabels";
import type {
  HellWeekGrade,
  HellWeekJudgeReportMetadata,
  HellWeekReport,
  HellWeekScenario,
  HellWeekScenarioEvidence,
  JudgeMetadata,
  JudgeVerdict,
  JudgeVerdictArtifact,
  LoadedJudgeVerdicts,
  Severity,
} from "./types";

type PlannerWithMetadata = TurnPlanner & { metadata?: PlannerMetadata };
type JudgeVerdictSource = Map<string, JudgeVerdict> | LoadedJudgeVerdicts;

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
  judgeVerdicts?: JudgeVerdictSource;
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

  writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(reportHtmlPath, renderReportHtml(report, theme), "utf8");
  writeFileSync(
    evidenceJsonPath,
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  const evidenceById = new Map(evidence.map((e) => [e.scenarioId, e]));

  // Per-scenario packets the LLM judge reads.
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
  }

  return {
    runId,
    runDir,
    reportJsonPath,
    reportHtmlPath,
    evidenceJsonPath,
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
  const judgeVerdicts = validateJudgeVerdictsForScenarios(
    scenarios,
    input.judgeVerdicts,
  );
  const judge = judgeReportMetadata(input.judgeVerdicts);

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

  const grades = grade(scenarios, evidence, judgeVerdicts);
  const report = buildHellWeekReport({
    runId,
    generatedAt: now().toISOString(),
    profile: input.profile,
    planner: plannerMeta(input.planner),
    signalExtractor: signalMeta(input.signalExtractor),
    policyVersion,
    judged: Boolean(judgeVerdicts && judgeVerdicts.size > 0),
    ...(judge ? { judge } : {}),
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
  judgeVerdicts?: JudgeVerdictSource;
  theme?: HellWeekTheme;
  now?: () => Date;
}): HellWeekRunArtifacts {
  const evidence = JSON.parse(
    readFileSync(join(runDir, "evidence.json"), "utf8"),
  ) as HellWeekScenarioEvidence[];
  const priorReport = JSON.parse(
    readFileSync(join(runDir, "report.json"), "utf8"),
  ) as HellWeekReport;

  const scenarios = currentScenariosForCapturedRun(priorReport);
  const validatedJudgeVerdicts = validateJudgeVerdictsForScenarios(
    scenarios,
    judgeVerdicts,
  );
  const judge = judgeReportMetadata(judgeVerdicts);
  const grades = grade(scenarios, evidence, validatedJudgeVerdicts);
  const report = buildHellWeekReport({
    runId: priorReport.runId,
    generatedAt: now().toISOString(),
    profile: priorReport.profile,
    planner: priorReport.planner,
    signalExtractor: priorReport.signalExtractor,
    policyVersion: priorReport.policyVersion,
    judged: Boolean(validatedJudgeVerdicts && validatedJudgeVerdicts.size > 0),
    ...(judge ? { judge } : {}),
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

function currentScenariosForCapturedRun(
  priorReport: HellWeekReport,
): HellWeekScenario[] {
  const currentById = new Map(
    selectScenarios(priorReport.profile).map((scenario) => [
      scenario.id,
      scenario,
    ]),
  );

  return priorReport.scenarios.map(
    (scenario) => currentById.get(scenario.id) ?? scenario,
  );
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

export function loadJudgeVerdicts(path: string): LoadedJudgeVerdicts {
  const raw = readFileSync(path, "utf8").trim();
  return parseJudgeVerdicts(raw, path);
}

function validateJudgeVerdictsForScenarios(
  scenarios: readonly HellWeekScenario[],
  source?: JudgeVerdictSource,
): Map<string, JudgeVerdict> | undefined {
  const verdicts = judgeVerdictMap(source);

  if (!verdicts) {
    return undefined;
  }
  if (!source) {
    throw new Error("Judge verdict source is missing.");
  }

  const scenarioIds = new Set(scenarios.map((scenario) => scenario.id));
  const unknownScenarioIds = [...verdicts.keys()].filter(
    (scenarioId) => !scenarioIds.has(scenarioId),
  );

  if (unknownScenarioIds.length > 0) {
    throw new Error(
      `Judge verdicts include unknown scenarioId(s): ${unknownScenarioIds.join(", ")}`,
    );
  }

  const missingScenarioIds = scenarios
    .map((scenario) => scenario.id)
    .filter((scenarioId) => !verdicts.has(scenarioId));
  if (missingScenarioIds.length > 0) {
    throw new Error(
      `Judge verdicts are missing scenarioId(s): ${missingScenarioIds.join(", ")}`,
    );
  }

  validateJudgeMetadataForCurrentRun(scenarios, source, verdicts.size);

  return verdicts;
}

function validateJudgeMetadataForCurrentRun(
  scenarios: readonly HellWeekScenario[],
  source: JudgeVerdictSource,
  verdictCount: number,
): void {
  if (source instanceof Map || !source.artifact || !source.metadata) {
    throw new Error(
      "Judge verdicts need schemaVersion 1 artifact metadata before a run can count as judged.",
    );
  }

  const metadata = source.metadata;
  const missingFields: string[] = [];
  if (metadata.provider === undefined) missingFields.push("provider");
  if (metadata.model === undefined) missingFields.push("model");
  if (metadata.tool === undefined) missingFields.push("tool");
  if (metadata.promptVersion === undefined) missingFields.push("promptVersion");
  if (metadata.rubricHash === undefined) missingFields.push("rubricHash");
  if (metadata.scenarioCount === undefined) missingFields.push("scenarioCount");

  if (missingFields.length > 0) {
    throw new Error(
      `Judge verdict artifact metadata missing required field(s): ${missingFields.join(", ")}`,
    );
  }

  if (metadata.provider !== "openai") {
    throw new Error(
      `Judge verdict artifact provider must be openai, got ${metadata.provider}.`,
    );
  }

  if (metadata.tool !== openAiHellWeekJudgeTool) {
    throw new Error(
      `Judge verdict artifact tool must be ${openAiHellWeekJudgeTool}, got ${metadata.tool}.`,
    );
  }

  if (metadata.promptVersion !== openAiHellWeekJudgePromptVersion) {
    throw new Error(
      `Judge verdict artifact promptVersion must be ${openAiHellWeekJudgePromptVersion}, got ${metadata.promptVersion}.`,
    );
  }

  if (metadata.rubricHash !== openAiHellWeekJudgeRubricHash) {
    throw new Error(
      `Judge verdict artifact rubricHash must be ${openAiHellWeekJudgeRubricHash}, got ${metadata.rubricHash}.`,
    );
  }

  if (metadata.scenarioCount !== scenarios.length) {
    throw new Error(
      `Judge verdict artifact scenarioCount ${metadata.scenarioCount} does not match rendered run scenario count ${scenarios.length}.`,
    );
  }

  if (verdictCount !== scenarios.length) {
    throw new Error(
      `Judge verdict count ${verdictCount} does not match rendered run scenario count ${scenarios.length}.`,
    );
  }
}

function judgeVerdictMap(
  source?: JudgeVerdictSource,
): Map<string, JudgeVerdict> | undefined {
  if (!source) {
    return undefined;
  }

  return source instanceof Map ? source : source.verdicts;
}

function judgeReportMetadata(
  source?: JudgeVerdictSource,
): HellWeekJudgeReportMetadata | undefined {
  const verdicts = judgeVerdictMap(source);

  if (!verdicts || verdicts.size === 0) {
    return undefined;
  }

  const summary: HellWeekJudgeReportMetadata = {
    verdictCount: verdicts.size,
  };

  if (!source || source instanceof Map) {
    return summary;
  }

  if (source.artifact) {
    summary.artifactSchemaVersion = source.artifact.schemaVersion;
  }

  const metadata = source.metadata;
  if (!metadata) {
    return summary;
  }

  summary.generatedAt = metadata.generatedAt;
  if (metadata.provider !== undefined) {
    summary.provider = metadata.provider;
  }
  if (metadata.mode !== undefined) {
    summary.mode = metadata.mode;
  }
  if (metadata.model !== undefined) {
    summary.model = metadata.model;
  }
  if (metadata.judgeModel !== undefined) {
    summary.judgeModel = metadata.judgeModel;
  }
  if (metadata.verifierModel !== undefined) {
    summary.verifierModel = metadata.verifierModel;
  }
  if (metadata.finalAdjudicatorModel !== undefined) {
    summary.finalAdjudicatorModel = metadata.finalAdjudicatorModel;
  }
  if (metadata.tool !== undefined) {
    summary.tool = metadata.tool;
  }
  if (metadata.promptVersion !== undefined) {
    summary.promptVersion = metadata.promptVersion;
  }
  if (metadata.rubricHash !== undefined) {
    summary.rubricHash = metadata.rubricHash;
  }
  if (metadata.sourceRunId !== undefined) {
    summary.sourceRunId = metadata.sourceRunId;
  }
  if (metadata.sourceRunPath !== undefined) {
    summary.sourceRunPath = metadata.sourceRunPath;
  }

  if (metadata.scenarioCount !== undefined) {
    summary.scenarioCount = metadata.scenarioCount;
  }

  return summary;
}

function parseJudgeVerdicts(
  raw: string,
  sourceLabel: string,
): LoadedJudgeVerdicts {
  if (!raw) {
    throw new Error(`Judge verdict file is empty: ${sourceLabel}`);
  }

  if (raw.startsWith("[")) {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`Judge verdict JSON array expected in ${sourceLabel}.`);
    }
    const verdicts = validateJudgeVerdictList(parsed, sourceLabel);
    return { verdicts: toJudgeVerdictMap(verdicts, sourceLabel) };
  }

  if (raw.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      // Fall through to JSONL parsing so a multi-line JSONL file reports the
      // precise bad line rather than a whole-file parse failure.
    }

    if (isRecord(parsed) && "verdicts" in parsed) {
      return validateJudgeVerdictArtifact(parsed, sourceLabel);
    }
  }

  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const verdicts = lines.map((line, index) => {
    try {
      return JSON.parse(line) as unknown;
    } catch (error) {
      throw new Error(
        `Invalid judge verdict JSONL at ${sourceLabel}:${index + 1}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  return {
    verdicts: toJudgeVerdictMap(
      validateJudgeVerdictList(verdicts, sourceLabel),
      sourceLabel,
    ),
  };
}

function validateJudgeVerdictArtifact(
  value: Record<string, unknown>,
  sourceLabel: string,
): LoadedJudgeVerdicts {
  if (value.schemaVersion !== 1) {
    throw new Error(
      `Judge verdict artifact ${sourceLabel} must use schemaVersion 1.`,
    );
  }

  if (!Array.isArray(value.verdicts)) {
    throw new Error(`Judge verdict artifact ${sourceLabel} needs verdicts[].`);
  }

  const metadata = validateJudgeMetadata(value.metadata, sourceLabel);
  const verdicts = validateJudgeVerdictList(value.verdicts, sourceLabel);

  if (
    metadata.scenarioCount !== undefined &&
    metadata.scenarioCount !== verdicts.length
  ) {
    throw new Error(
      `Judge verdict artifact ${sourceLabel} metadata scenarioCount ${metadata.scenarioCount} does not match ${verdicts.length} verdict(s).`,
    );
  }

  const artifact: JudgeVerdictArtifact = {
    schemaVersion: 1,
    metadata,
    verdicts,
  };

  return {
    verdicts: toJudgeVerdictMap(verdicts, sourceLabel),
    metadata,
    artifact,
  };
}

function validateJudgeMetadata(
  value: unknown,
  sourceLabel: string,
): JudgeMetadata {
  if (!isRecord(value)) {
    throw new Error(`Judge verdict artifact ${sourceLabel} needs metadata.`);
  }

  const metadata: JudgeMetadata = {
    generatedAt: requiredString(value, "generatedAt", sourceLabel),
  };

  assignOptionalString(metadata, value, "provider", sourceLabel);
  if (value.mode !== undefined) {
    if (value.mode !== "single_model" && value.mode !== "ladder") {
      throw new Error(
        `Judge verdict artifact ${sourceLabel} metadata mode must be single_model or ladder.`,
      );
    }
    metadata.mode = value.mode;
  }
  assignOptionalString(metadata, value, "model", sourceLabel);
  assignOptionalString(metadata, value, "judgeModel", sourceLabel);
  assignOptionalString(metadata, value, "verifierModel", sourceLabel);
  assignOptionalString(metadata, value, "finalAdjudicatorModel", sourceLabel);
  assignOptionalString(metadata, value, "tool", sourceLabel);
  assignOptionalString(metadata, value, "promptVersion", sourceLabel);
  assignOptionalString(metadata, value, "rubricHash", sourceLabel);
  assignOptionalString(metadata, value, "sourceRunId", sourceLabel);
  assignOptionalString(metadata, value, "sourceRunPath", sourceLabel);

  if (value.scenarioCount !== undefined) {
    if (
      typeof value.scenarioCount !== "number" ||
      !Number.isInteger(value.scenarioCount) ||
      value.scenarioCount < 0
    ) {
      throw new Error(
        `Judge verdict artifact ${sourceLabel} metadata scenarioCount must be a non-negative integer.`,
      );
    }
    metadata.scenarioCount = value.scenarioCount;
  }

  return metadata;
}

function validateJudgeVerdictList(
  values: readonly unknown[],
  sourceLabel: string,
): JudgeVerdict[] {
  return values.map((value, index) =>
    validateJudgeVerdict(value, `${sourceLabel}[${index}]`),
  );
}

function validateJudgeVerdict(
  value: unknown,
  sourceLabel: string,
): JudgeVerdict {
  if (!isRecord(value)) {
    throw new Error(`Judge verdict ${sourceLabel} must be an object.`);
  }

  const severity = requiredString(value, "severity", sourceLabel);
  if (!isSeverity(severity)) {
    throw new Error(
      `Judge verdict ${sourceLabel} has invalid severity: ${severity}.`,
    );
  }

  const triageLabels = value.triageLabels;
  if (
    !Array.isArray(triageLabels) ||
    !triageLabels.every(
      (label): label is JudgeTriageLabel =>
        typeof label === "string" && isJudgeTriageLabel(label),
    )
  ) {
    throw new Error(
      `Judge verdict ${sourceLabel} triageLabels must use the judge triage enum.`,
    );
  }

  const pass = value.pass;
  if (typeof pass !== "boolean") {
    throw new Error(`Judge verdict ${sourceLabel} pass must be boolean.`);
  }

  const uxScore = value.uxScore;
  if (typeof uxScore !== "number" || !Number.isFinite(uxScore)) {
    throw new Error(`Judge verdict ${sourceLabel} uxScore must be a number.`);
  }

  const verdict: JudgeVerdict = {
    scenarioId: requiredString(value, "scenarioId", sourceLabel),
    pass,
    severity,
    triageLabels,
    uxScore,
    rationale: requiredString(value, "rationale", sourceLabel),
  };

  if (value.confidence !== undefined) {
    if (
      typeof value.confidence !== "number" ||
      !Number.isFinite(value.confidence)
    ) {
      throw new Error(
        `Judge verdict ${sourceLabel} confidence must be a number.`,
      );
    }
    verdict.confidence = value.confidence;
  }

  return verdict;
}

function toJudgeVerdictMap(
  verdicts: readonly JudgeVerdict[],
  sourceLabel: string,
): Map<string, JudgeVerdict> {
  const map = new Map<string, JudgeVerdict>();

  for (const verdict of verdicts) {
    if (map.has(verdict.scenarioId)) {
      throw new Error(
        `Judge verdicts include duplicate scenarioId: ${verdict.scenarioId} (${sourceLabel})`,
      );
    }
    map.set(verdict.scenarioId, verdict);
  }

  return map;
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  sourceLabel: string,
): string {
  const field = value[key];
  if (typeof field !== "string" || field.trim().length === 0) {
    throw new Error(`Judge verdict ${sourceLabel} ${key} must be a string.`);
  }
  return field;
}

function assignOptionalString(
  target: JudgeMetadata,
  value: Record<string, unknown>,
  key: keyof JudgeMetadata,
  sourceLabel: string,
): void {
  const field = value[key];
  if (field === undefined) {
    return;
  }
  if (typeof field !== "string" || field.trim().length === 0) {
    throw new Error(
      `Judge verdict artifact ${sourceLabel} metadata ${String(key)} must be a string.`,
    );
  }
  target[key] = field as never;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSeverity(value: string): value is Severity {
  return value === "demo_killer" || value === "dent" || value === "fine";
}
