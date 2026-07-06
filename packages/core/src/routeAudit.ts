import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import type {
  RetrievedMatch,
  ServingMode,
  TurnTrace,
} from "@loanslam/contracts";
import { turnTraceSchema } from "@loanslam/contracts";

export interface RouteAuditOptions {
  runFolder: string;
  jsonOutputPath?: string;
  markdownOutputPath?: string;
  cwd?: string;
  now?: Date;
}

export interface RouteAuditResult {
  audit: RouteAuditReport;
  jsonOutputPath: string;
  markdownOutputPath: string;
}

export interface RouteAuditReport {
  generatedAt: string;
  runFolder: string;
  summaryPath: string;
  turnLogPath: string;
  dumpsDir: string;
  scenarioCount: number;
  turnCount: number;
  selectedServingModeCounts: Record<string, number>;
  effectiveServingModeCounts: Record<string, number>;
  routeForScoringCounts: Record<string, number>;
  finalActionCounts: Record<string, number>;
  findingSourceCounts: Record<string, number>;
  findingCodeCounts: Record<string, number>;
  rows: RouteAuditRow[];
}

export interface RouteAuditRow {
  scenarioId: string;
  scenarioCategory: string | null;
  turnIndex: number;
  conversationRef: string | null;
  traceId: string | null;
  postedMessage: string;
  expectedEnvelope: string | null;
  finalAction: string | null;
  proposedAction: string | null;
  selectedServingMode: ServingMode | null;
  effectiveServingMode: ServingMode | null;
  routeForScoring: ServingMode | null;
  safetyFlags: string[];
  stateSafetyFlags: string[];
  validatorOverrideCodes: string[];
  handoffPending: boolean | null;
  stateHandoffPending: boolean | null;
  requestedFields: string[];
  topRetrievedItem: RouteAuditRetrievedItem | null;
  findings: RouteAuditFinding[];
}

export interface RouteAuditRetrievedItem {
  itemId: string;
  servingMode: ServingMode;
  score: number;
  question: string | null;
  routeReason: string | null;
  matchedTerms: string[];
}

export interface RouteAuditFinding {
  source:
    | "retrieval"
    | "signal_extraction"
    | "validator_trace"
    | "state_leak"
    | "policy_decision"
    | "intake_trace_clarity";
  code: string;
  detail: string;
}

interface SummaryScenario {
  scenarioId: string;
  category: string | null;
  expected: string | null;
  artifactPath: string | null;
}

interface RunSummary {
  runRoot: string | null;
  dumpsDir: string | null;
  aggregateTurnLogPath: string | null;
  scenarioCount: number | null;
  scenarios: SummaryScenario[];
}

interface TurnLogRow {
  scenarioId: string;
  turnIndex: number;
  conversationRef: string | null;
  postedMessage: string;
  summary: TurnLogSummary;
}

interface TurnLogSummary {
  finalAction: string | null;
  selectedServingMode: ServingMode | null;
  effectiveServingMode: ServingMode | null;
  safetyFlags: string[];
  validatorOverrideCodes: string[];
  handoffPending: boolean | null;
  requestedFields: string[];
}

interface ResolvedAuditInputs {
  runFolder: string;
  summaryPath: string;
}

const servingModes = new Set<string>([
  "answer",
  "handoff_account_specific",
  "route_vulnerability",
  "excluded",
]);

const stateCarryoverFlags = new Set([
  "account_specific_request",
  "change_request",
]);

const humanSupportSignals = new Set([
  "vulnerability",
  "distress",
  "complaint",
  "legal_threat",
  "accessibility_need",
  "hardship",
  "language_barrier",
]);

export function buildRouteAuditArtifacts(
  options: RouteAuditOptions,
): RouteAuditResult {
  const cwd = options.cwd ?? process.cwd();
  const inputs = resolveAuditInputs(options.runFolder, cwd);
  const summary = parseRunSummary(readJsonFile(inputs.summaryPath));
  const logsDir = dirname(inputs.summaryPath);
  const turnLogPath =
    resolveExistingPath(summary.aggregateTurnLogPath, cwd, logsDir) ??
    join(logsDir, "turn-log.jsonl");
  const dumpsDir =
    resolveExistingPath(summary.dumpsDir, cwd, dirname(logsDir)) ??
    join(dirname(logsDir), "dumps");

  assertReadableFile(turnLogPath, "turn log");

  const turnRows = readTurnLog(turnLogPath);
  const scenarioById = new Map(
    summary.scenarios.map((scenario) => [scenario.scenarioId, scenario]),
  );
  const tracesByScenario = new Map<string, TurnTrace[]>();
  const rows = turnRows.map((turnRow) => {
    const scenario = scenarioById.get(turnRow.scenarioId);
    const traces = loadScenarioTraces({
      scenario,
      scenarioId: turnRow.scenarioId,
      tracesByScenario,
      cwd,
      dumpsDir,
    });
    const trace =
      traces.find(
        (candidate) => candidate.turnIndex === turnRow.turnIndex - 1,
      ) ??
      traces[turnRow.turnIndex - 1] ??
      null;
    const selectedServingMode =
      turnRow.summary.selectedServingMode ?? trace?.selectedServingMode ?? null;
    const effectiveServingMode =
      turnRow.summary.effectiveServingMode ??
      trace?.effectiveServingMode ??
      null;
    const finalAction =
      turnRow.summary.finalAction ?? trace?.finalAction ?? null;
    const requestedFields = turnRow.summary.requestedFields;
    const routeForScoring = effectiveServingMode ?? selectedServingMode;
    const safetyFlags = normalizeCurrentSafetyFlags({
      finalAction,
      routeForScoring,
      safetyFlags: trace?.safetyFlags ?? turnRow.summary.safetyFlags,
    });
    const row: RouteAuditRow = {
      scenarioId: turnRow.scenarioId,
      scenarioCategory: scenario?.category ?? null,
      turnIndex: turnRow.turnIndex,
      conversationRef:
        turnRow.conversationRef ?? trace?.conversationRef ?? null,
      traceId: trace?.traceId ?? null,
      postedMessage: turnRow.postedMessage,
      expectedEnvelope: scenario?.expected ?? null,
      finalAction,
      proposedAction: trace?.proposedAction ?? null,
      selectedServingMode,
      effectiveServingMode,
      routeForScoring,
      safetyFlags,
      stateSafetyFlags: turnRow.summary.safetyFlags,
      validatorOverrideCodes:
        turnRow.summary.validatorOverrideCodes.length > 0
          ? turnRow.summary.validatorOverrideCodes
          : (trace?.validatorOverrides.map((override) => override.code) ?? []),
      handoffPending: deriveCurrentHandoffPending(finalAction, requestedFields),
      stateHandoffPending: turnRow.summary.handoffPending,
      requestedFields,
      topRetrievedItem: summarizeRetrievedItem(
        trace?.retrievedMatches[0] ?? null,
      ),
      findings: [],
    };

    row.findings = classifyAuditRow(row);
    return row;
  });

  const audit: RouteAuditReport = {
    generatedAt: (options.now ?? new Date()).toISOString(),
    runFolder: inputs.runFolder,
    summaryPath: inputs.summaryPath,
    turnLogPath,
    dumpsDir,
    scenarioCount: summary.scenarioCount ?? summary.scenarios.length,
    turnCount: rows.length,
    selectedServingModeCounts: countValues(
      rows,
      (row) => row.selectedServingMode,
    ),
    effectiveServingModeCounts: countValues(
      rows,
      (row) => row.effectiveServingMode,
    ),
    routeForScoringCounts: countValues(rows, (row) => row.routeForScoring),
    finalActionCounts: countValues(rows, (row) => row.finalAction),
    findingSourceCounts: countValues(
      rows.flatMap((row) => row.findings),
      (finding) => finding.source,
    ),
    findingCodeCounts: countValues(
      rows.flatMap((row) => row.findings),
      (finding) => finding.code,
    ),
    rows,
  };

  const jsonOutputPath = resolveOutputPath(
    options.jsonOutputPath,
    cwd,
    logsDir,
    "route-audit.json",
  );
  const markdownOutputPath = resolveOutputPath(
    options.markdownOutputPath,
    cwd,
    logsDir,
    "route-audit.md",
  );

  writeText(jsonOutputPath, `${JSON.stringify(audit, null, 2)}\n`);
  writeText(markdownOutputPath, renderRouteAuditMarkdown(audit));

  return {
    audit,
    jsonOutputPath,
    markdownOutputPath,
  };
}

function resolveAuditInputs(
  runFolder: string,
  cwd: string,
): ResolvedAuditInputs {
  const inputPath = resolve(cwd, runFolder);
  const summaryCandidates = uniqueExistingPaths([
    join(inputPath, "logs", "summary.json"),
    join(inputPath, "summary.json"),
    ...childSummaryCandidates(inputPath),
  ]);

  if (summaryCandidates.length === 0) {
    throw new Error(
      `No lab API summary.json found under ${inputPath}. Pass the run folder, battery folder, or logs folder.`,
    );
  }

  if (summaryCandidates.length > 1) {
    throw new Error(
      `Multiple summary.json files found under ${inputPath}: ${summaryCandidates.join(", ")}`,
    );
  }

  const summaryPath = summaryCandidates[0];

  if (!summaryPath) {
    throw new Error(`No lab API summary.json found under ${inputPath}.`);
  }

  return {
    runFolder: inputPath,
    summaryPath,
  };
}

function childSummaryCandidates(inputPath: string): string[] {
  if (!existsSync(inputPath) || !statSync(inputPath).isDirectory()) {
    return [];
  }

  return readdirSync(inputPath)
    .map((child) => join(inputPath, child, "logs", "summary.json"))
    .filter((path) => existsSync(path));
}

function parseRunSummary(value: unknown): RunSummary {
  const object = asObject(value, "summary.json");
  const scenarios = arrayValue(object.scenarios).map((entry, index) =>
    parseSummaryScenario(entry, index),
  );

  return {
    runRoot: stringOrNull(object.runRoot),
    dumpsDir: stringOrNull(object.dumpsDir),
    aggregateTurnLogPath: stringOrNull(object.aggregateTurnLogPath),
    scenarioCount: numberOrNull(object.scenarioCount),
    scenarios,
  };
}

function parseSummaryScenario(value: unknown, index: number): SummaryScenario {
  const object = asObject(value, `summary.scenarios[${index}]`);

  return {
    scenarioId: requiredString(
      object.scenarioId,
      `summary.scenarios[${index}].scenarioId`,
    ),
    category: stringOrNull(object.category),
    expected: stringOrNull(object.expected),
    artifactPath: stringOrNull(object.artifactPath),
  };
}

function readTurnLog(turnLogPath: string): TurnLogRow[] {
  return readJsonl(turnLogPath)
    .filter(
      (entry) => asObject(entry, "turn log row").event === "turn_complete",
    )
    .map((entry, index) => parseTurnLogRow(entry, index));
}

function parseTurnLogRow(value: unknown, index: number): TurnLogRow {
  const object = asObject(value, `turn-log row ${index + 1}`);
  const summary = asObject(object.summary, `turn-log row ${index + 1}.summary`);

  return {
    scenarioId: requiredString(
      object.scenarioId,
      `turn-log row ${index + 1}.scenarioId`,
    ),
    turnIndex: requiredNumber(
      object.turnIndex,
      `turn-log row ${index + 1}.turnIndex`,
    ),
    conversationRef: stringOrNull(object.conversationRef),
    postedMessage: requiredString(
      object.postedMessage,
      `turn-log row ${index + 1}.postedMessage`,
    ),
    summary: {
      finalAction: stringOrNull(summary.lastAction),
      selectedServingMode: servingModeOrNull(summary.selectedServingMode),
      effectiveServingMode: servingModeOrNull(summary.effectiveServingMode),
      safetyFlags: stringArray(summary.safetyFlags),
      validatorOverrideCodes: stringArray(summary.validatorOverrideCodes),
      handoffPending: booleanOrNull(summary.handoffPending),
      requestedFields: stringArray(summary.requestedFields),
    },
  };
}

function loadScenarioTraces({
  scenario,
  scenarioId,
  tracesByScenario,
  cwd,
  dumpsDir,
}: {
  scenario: SummaryScenario | undefined;
  scenarioId: string;
  tracesByScenario: Map<string, TurnTrace[]>;
  cwd: string;
  dumpsDir: string;
}): TurnTrace[] {
  const cached = tracesByScenario.get(scenarioId);

  if (cached) {
    return cached;
  }

  if (!scenario?.artifactPath) {
    tracesByScenario.set(scenarioId, []);
    return [];
  }

  const dumpPath = resolveArtifactPath(scenario.artifactPath, cwd, dumpsDir);
  const dumpObject = asObject(readJsonFile(dumpPath), dumpPath);
  const traces = arrayValue(dumpObject.traces).map((entry, index) => {
    const parsed = turnTraceSchema.safeParse(entry);

    if (!parsed.success) {
      throw new Error(
        `Invalid trace ${index} in ${dumpPath}: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      );
    }

    return parsed.data;
  });

  tracesByScenario.set(scenarioId, traces);
  return traces;
}

function summarizeRetrievedItem(
  match: RetrievedMatch | null,
): RouteAuditRetrievedItem | null {
  if (!match) {
    return null;
  }

  return {
    itemId: match.itemId,
    servingMode: match.servingMode,
    score: match.score,
    question: match.item?.question ?? null,
    routeReason: match.item?.route_reason ?? null,
    matchedTerms: match.matchedTerms,
  };
}

function classifyAuditRow(row: RouteAuditRow): RouteAuditFinding[] {
  const findings: RouteAuditFinding[] = [];
  const hasRawStateCarryoverSignal =
    row.stateHandoffPending === true ||
    row.stateSafetyFlags.some((flag) => stateCarryoverFlags.has(flag));
  const hasCurrentCarryoverSignal =
    row.handoffPending === true ||
    row.safetyFlags.some((flag) => stateCarryoverFlags.has(flag));
  const hasHumanSupportSignal = row.safetyFlags.some((flag) =>
    humanSupportSignals.has(flag),
  );

  if (
    row.routeForScoring === "answer" &&
    (hasRawStateCarryoverSignal || hasCurrentCarryoverSignal)
  ) {
    findings.push({
      source: "state_leak",
      code: "state_leak.carryover_on_answer",
      detail:
        "The turn scores as an answer but raw or current state still carries handoff state or account/change flags.",
    });
  }

  if (
    row.selectedServingMode === "excluded" &&
    row.effectiveServingMode === "route_vulnerability"
  ) {
    findings.push({
      source: "signal_extraction",
      code: "signal_extraction.excluded_promoted_to_vulnerability",
      detail:
        "An excluded policy item was selected, but safety flags promoted the effective route to vulnerability.",
    });
  }

  if (
    row.safetyFlags.includes("language_barrier") &&
    row.effectiveServingMode === null
  ) {
    findings.push({
      source: "policy_decision",
      code: "policy_decision.language_barrier_route_undefined",
      detail:
        "Language-barrier evidence is present but the effective route is unset.",
    });
  }

  if (
    row.selectedServingMode === "answer" &&
    row.routeForScoring !== null &&
    row.routeForScoring !== "answer" &&
    (row.handoffPending === true || row.requestedFields.length > 0)
  ) {
    findings.push({
      source: "intake_trace_clarity",
      code: "intake_trace_clarity.selected_answer_effective_handoff",
      detail:
        "The planner/retrieval selected answer while stateful intake changed the effective route.",
    });
  }

  if (row.validatorOverrideCodes.length > 0) {
    findings.push({
      source: "validator_trace",
      code: "validator_trace.override_present",
      detail:
        "The validator changed or preserved behavior; inspect override codes before scoring planner quality.",
    });
  }

  if (
    row.topRetrievedItem &&
    row.routeForScoring &&
    row.topRetrievedItem.servingMode !== row.routeForScoring &&
    !hasHumanSupportSignal &&
    row.validatorOverrideCodes.length === 0
  ) {
    findings.push({
      source: "retrieval",
      code: "retrieval.top_item_differs_from_scored_route",
      detail:
        "The top retrieved policy item does not match the effective route used for scoring.",
    });
  }

  return findings;
}

function renderRouteAuditMarkdown(audit: RouteAuditReport): string {
  const findingRows = audit.rows.filter((row) => row.findings.length > 0);
  const lines = [
    "# Route Audit",
    "",
    `Generated: ${audit.generatedAt}`,
    `Run folder: \`${audit.runFolder}\``,
    `Turn log: \`${audit.turnLogPath}\``,
    "",
    "## Summary",
    "",
    `- Scenarios: ${audit.scenarioCount}`,
    `- Customer turns: ${audit.turnCount}`,
    `- Effective route counts: ${formatCounts(audit.effectiveServingModeCounts)}`,
    `- Scoring route counts: ${formatCounts(audit.routeForScoringCounts)}`,
    `- Finding source counts: ${formatCounts(audit.findingSourceCounts)}`,
    "",
    "## Finding Sources",
    "",
    ...countLines(audit.findingSourceCounts),
    "",
    "## Rows Needing Review",
    "",
  ];

  if (findingRows.length === 0) {
    lines.push("No route-audit findings were detected.");
  } else {
    lines.push(
      "| Scenario | Turn | Route | Flags | Overrides | Top Retrieval | Findings | Posted Message |",
      "|---|---:|---|---|---|---|---|---|",
      ...findingRows.map((row) => markdownReviewRow(row)),
    );
  }

  lines.push(
    "",
    "## Scenario Summary",
    "",
    "| Scenario | Turns | Category | Expected Envelope | Findings |",
    "|---|---:|---|---|---|",
    ...scenarioSummaryRows(audit.rows),
    "",
    "Full per-turn ledger is available in `route-audit.json`.",
    "",
  );

  return lines.join("\n");
}

function markdownReviewRow(row: RouteAuditRow): string {
  return [
    row.scenarioId,
    String(row.turnIndex),
    formatRoute(row),
    row.safetyFlags.join(", ") || "-",
    row.validatorOverrideCodes.join(", ") || "-",
    formatTopRetrievedItem(row.topRetrievedItem),
    row.findings.map((finding) => finding.code).join(", "),
    truncate(row.postedMessage, 100),
  ]
    .map(markdownCell)
    .join("|")
    .replace(/^/, "|")
    .replace(/$/, "|");
}

function scenarioSummaryRows(rows: readonly RouteAuditRow[]): string[] {
  const scenarioRows = new Map<string, RouteAuditRow[]>();

  for (const row of rows) {
    scenarioRows.set(row.scenarioId, [
      ...(scenarioRows.get(row.scenarioId) ?? []),
      row,
    ]);
  }

  return [...scenarioRows.entries()].map(([scenarioId, entries]) => {
    const first = entries[0];
    const findingCodes = unique(
      entries.flatMap((entry) => entry.findings.map((finding) => finding.code)),
    );

    return [
      scenarioId,
      String(entries.length),
      first?.scenarioCategory ?? "-",
      truncate(first?.expectedEnvelope ?? "-", 110),
      findingCodes.join(", ") || "-",
    ]
      .map(markdownCell)
      .join("|")
      .replace(/^/, "|")
      .replace(/$/, "|");
  });
}

function formatRoute(row: RouteAuditRow): string {
  return [
    `final=${row.finalAction ?? "null"}`,
    `selected=${row.selectedServingMode ?? "null"}`,
    `effective=${row.effectiveServingMode ?? "null"}`,
    `score=${row.routeForScoring ?? "null"}`,
    `handoffPending=${String(row.handoffPending)}`,
    `stateHandoffPending=${String(row.stateHandoffPending)}`,
  ].join("; ");
}

function deriveCurrentHandoffPending(
  finalAction: string | null,
  requestedFields: readonly string[],
): boolean {
  return (
    finalAction === "request_handoff_intake" ||
    finalAction === "create_ticket" ||
    finalAction === "escalate" ||
    requestedFields.length > 0
  );
}

function normalizeCurrentSafetyFlags({
  finalAction,
  routeForScoring,
  safetyFlags,
}: {
  finalAction: string | null;
  routeForScoring: ServingMode | null;
  safetyFlags: readonly string[];
}): string[] {
  if (finalAction !== "answer" || routeForScoring !== "answer") {
    return [...safetyFlags];
  }

  return safetyFlags.filter((flag) => !stateCarryoverFlags.has(flag));
}

function formatTopRetrievedItem(item: RouteAuditRetrievedItem | null): string {
  if (!item) {
    return "-";
  }

  return `${item.itemId} (${item.servingMode}, ${item.score})`;
}

function countLines(counts: Record<string, number>): string[] {
  const entries = Object.entries(counts).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return left[0].localeCompare(right[0]);
  });

  if (entries.length === 0) {
    return ["- none"];
  }

  return entries.map(([key, value]) => `- ${key}: ${value}`);
}

function countValues<T>(
  values: readonly T[],
  selectValue: (value: T) => string | null,
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const value of values) {
    const key = selectValue(value) ?? "null";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  if (entries.length === 0) {
    return "none";
  }

  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

function readJsonFile(path: string): unknown {
  assertReadableFile(path, "JSON file");
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path: string): unknown[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(
          `Invalid JSONL at ${path}:${index + 1}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    content.endsWith("\n") ? content : `${content}\n`,
    "utf8",
  );
}

function resolveExistingPath(
  pathValue: string | null,
  cwd: string,
  fallbackBase: string,
): string | null {
  if (!pathValue) {
    return null;
  }

  const resolved = resolveArtifactPath(pathValue, cwd, fallbackBase);
  return existsSync(resolved) ? resolved : null;
}

function resolveArtifactPath(
  pathValue: string,
  cwd: string,
  fallbackBase: string,
): string {
  if (isAbsolute(pathValue)) {
    return pathValue;
  }

  const cwdPath = resolve(cwd, pathValue);

  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  return resolve(fallbackBase, pathValue);
}

function resolveOutputPath(
  outputPath: string | undefined,
  cwd: string,
  defaultDir: string,
  filename: string,
): string {
  if (!outputPath) {
    return join(defaultDir, filename);
  }

  return isAbsolute(outputPath) ? outputPath : resolve(cwd, outputPath);
}

function uniqueExistingPaths(paths: readonly string[]): string[] {
  return unique(paths.filter((path) => existsSync(path)));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function assertReadableFile(path: string, label: string): void {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`Missing ${label}: ${path}`);
  }
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }

  return value;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function servingModeOrNull(value: unknown): ServingMode | null {
  if (typeof value === "string" && servingModes.has(value)) {
    return value as ServingMode;
  }

  return null;
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
