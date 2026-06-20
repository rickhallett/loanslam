import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

import type { Severity } from "./types";

const severityRank: Record<Severity, number> = {
  fine: 0,
  dent: 1,
  demo_killer: 2,
};

type HellWeekVerdict = "blocked" | "needs_work" | "ship_ready";

interface ReportTotals {
  scenarios: number;
  passed: number;
  failed: number;
  passRate: number;
  demoKillers: number;
  dents: number;
  fine: number;
  errored: number;
}

interface CompareGrade {
  scenarioId: string;
  title?: string;
  dimension?: string;
  pass: boolean;
  severity: Severity;
  triageLabels: string[];
  rationale: string;
}

interface CompareReport {
  runId: string;
  generatedAt?: string;
  profile: string;
  verdict: HellWeekVerdict;
  totals: ReportTotals;
  safetyFloor: {
    pass: number;
    total: number;
    breached: boolean;
  };
  deflection: {
    answered: number;
    total: number;
    rate: number;
  };
  routingPrecision: {
    inScopeScenarios: number;
    misroutes: number;
    rate: number;
    signalTurns: number;
    signalAgreements: number;
    signalAgreementRate: number;
  };
  uxQuality: {
    scored: number;
    averageScore: number | null;
  };
  grades: CompareGrade[];
}

interface LoadedReport {
  path: string;
  report: CompareReport;
}

export interface ScenarioChange {
  scenarioId: string;
  title: string;
  dimension: string;
  baselineSeverity: Severity;
  candidateSeverity: Severity;
  baselinePass: boolean;
  candidatePass: boolean;
  triageLabels: string[];
  rationale: string;
}

export interface HellWeekComparison {
  baseline: LoadedReport;
  candidate: LoadedReport;
  scenarioSetChanged: boolean;
  deltas: {
    scenarios: number;
    passed: number;
    failed: number;
    passRatePoints: number;
    demoKillers: number;
    dents: number;
    errored: number;
    safetyFloorPass: number;
    deflectionRatePoints: number;
    routingPrecisionPoints: number;
    signalAgreementPoints: number;
    uxAverage: number | null;
  };
  scenarioChanges: {
    resolvedFailures: ScenarioChange[];
    newFailures: ScenarioChange[];
    improvedSeverity: ScenarioChange[];
    worsenedSeverity: ScenarioChange[];
    persistentFailures: ScenarioChange[];
  };
  recommendation: {
    status: "improved" | "regressed" | "mixed" | "unchanged";
    summary: string;
  };
}

export interface HellWeekComparisonJson {
  baseline: ReportSummary;
  candidate: ReportSummary;
  scenarioSetChanged: boolean;
  deltas: HellWeekComparison["deltas"];
  scenarioChanges: HellWeekComparison["scenarioChanges"];
  recommendation: HellWeekComparison["recommendation"];
}

interface ReportSummary {
  path: string;
  runId: string;
  profile: string;
  verdict: HellWeekVerdict;
  totals: ReportTotals;
  safetyFloor: CompareReport["safetyFloor"];
  deflection: CompareReport["deflection"];
  routingPrecision: CompareReport["routingPrecision"];
  uxQuality: CompareReport["uxQuality"];
}

export function compareHellWeekReportsFromPaths(
  baselineInput: string,
  candidateInput: string,
): HellWeekComparison {
  return compareHellWeekReports(
    loadHellWeekReport(baselineInput),
    loadHellWeekReport(candidateInput),
  );
}

export function compareHellWeekReports(
  baseline: LoadedReport,
  candidate: LoadedReport,
): HellWeekComparison {
  const baselineGrades = new Map(
    baseline.report.grades.map((grade) => [grade.scenarioId, grade]),
  );
  const candidateGrades = new Map(
    candidate.report.grades.map((grade) => [grade.scenarioId, grade]),
  );
  const baselineIds = new Set(baselineGrades.keys());
  const candidateIds = new Set(candidateGrades.keys());
  const sharedIds = [...baselineIds].filter((id) => candidateIds.has(id));

  const resolvedFailures: ScenarioChange[] = [];
  const newFailures: ScenarioChange[] = [];
  const improvedSeverity: ScenarioChange[] = [];
  const worsenedSeverity: ScenarioChange[] = [];
  const persistentFailures: ScenarioChange[] = [];

  for (const id of sharedIds) {
    const before = baselineGrades.get(id);
    const after = candidateGrades.get(id);

    if (!before || !after) {
      continue;
    }

    const change = toScenarioChange(before, after);
    const beforeFailed = !before.pass;
    const afterFailed = !after.pass;
    const rankDelta =
      severityRank[after.severity] - severityRank[before.severity];

    if (beforeFailed && !afterFailed) {
      resolvedFailures.push(change);
    }
    if (!beforeFailed && afterFailed) {
      newFailures.push(change);
    }
    if (rankDelta < 0) {
      improvedSeverity.push(change);
    }
    if (rankDelta > 0) {
      worsenedSeverity.push(change);
    }
    if (beforeFailed && afterFailed) {
      persistentFailures.push(change);
    }
  }

  const comparison: HellWeekComparison = {
    baseline,
    candidate,
    scenarioSetChanged:
      baselineIds.size !== candidateIds.size ||
      sharedIds.length !== baselineIds.size ||
      sharedIds.length !== candidateIds.size,
    deltas: buildDeltas(baseline.report, candidate.report),
    scenarioChanges: {
      resolvedFailures: sortChanges(resolvedFailures),
      newFailures: sortChanges(newFailures),
      improvedSeverity: sortChanges(improvedSeverity),
      worsenedSeverity: sortChanges(worsenedSeverity),
      persistentFailures: sortChanges(persistentFailures),
    },
    recommendation: {
      status: "unchanged",
      summary: "",
    },
  };

  comparison.recommendation = recommend(comparison);
  return comparison;
}

export function toHellWeekComparisonJson(
  comparison: HellWeekComparison,
): HellWeekComparisonJson {
  return {
    baseline: summarizeReport(comparison.baseline),
    candidate: summarizeReport(comparison.candidate),
    scenarioSetChanged: comparison.scenarioSetChanged,
    deltas: comparison.deltas,
    scenarioChanges: comparison.scenarioChanges,
    recommendation: comparison.recommendation,
  };
}

export function formatHellWeekComparison(
  comparison: HellWeekComparison,
): string {
  const { baseline, candidate, deltas, scenarioChanges, recommendation } =
    comparison;
  const scenarioWarning = comparison.scenarioSetChanged
    ? [
        "",
        "Warning: scenario sets differ; scenario movement only counts overlapping ids.",
      ]
    : [];

  return [
    `Hell Week compare: ${label(baseline)} -> ${label(candidate)}`,
    `Verdict: ${baseline.report.verdict} -> ${candidate.report.verdict}`,
    `Pass: ${countRate(baseline.report.totals.passed, baseline.report.totals.scenarios, baseline.report.totals.passRate)} -> ${countRate(candidate.report.totals.passed, candidate.report.totals.scenarios, candidate.report.totals.passRate)} (${signedInt(deltas.passed)}, ${signedPoints(deltas.passRatePoints)})`,
    `Demo-killers: ${baseline.report.totals.demoKillers} -> ${candidate.report.totals.demoKillers} (${signedInt(deltas.demoKillers)})`,
    `Dents: ${baseline.report.totals.dents} -> ${candidate.report.totals.dents} (${signedInt(deltas.dents)})`,
    `Errored: ${baseline.report.totals.errored} -> ${candidate.report.totals.errored} (${signedInt(deltas.errored)})`,
    `Safety floor: ${floorStatus(baseline.report)} -> ${floorStatus(candidate.report)} (${signedInt(deltas.safetyFloorPass)} pass)`,
    `Deflection: ${rateOrNa(baseline.report.deflection.rate, baseline.report.deflection.total)} -> ${rateOrNa(candidate.report.deflection.rate, candidate.report.deflection.total)} (${signedPoints(deltas.deflectionRatePoints)})`,
    `Routing precision: ${rateOrNa(baseline.report.routingPrecision.rate, baseline.report.routingPrecision.inScopeScenarios)} -> ${rateOrNa(candidate.report.routingPrecision.rate, candidate.report.routingPrecision.inScopeScenarios)} (${signedPoints(deltas.routingPrecisionPoints)})`,
    `Signal agreement: ${rateOrNa(baseline.report.routingPrecision.signalAgreementRate, baseline.report.routingPrecision.signalTurns)} -> ${rateOrNa(candidate.report.routingPrecision.signalAgreementRate, candidate.report.routingPrecision.signalTurns)} (${signedPoints(deltas.signalAgreementPoints)})`,
    `Scenario movement: ${scenarioChanges.resolvedFailures.length} resolved, ${scenarioChanges.newFailures.length} new failures, ${scenarioChanges.worsenedSeverity.length} worsened severity, ${scenarioChanges.improvedSeverity.length} improved severity.`,
    "",
    `Recommendation: ${recommendation.status} - ${recommendation.summary}`,
    ...scenarioWarning,
    changeBlock("Top new failures", scenarioChanges.newFailures),
    changeBlock("Top resolved failures", scenarioChanges.resolvedFailures),
    changeBlock("Top worsened severity", scenarioChanges.worsenedSeverity),
    changeBlock("Top persistent failures", scenarioChanges.persistentFailures),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function summarizeReport(item: LoadedReport): ReportSummary {
  return {
    path: item.path,
    runId: item.report.runId,
    profile: item.report.profile,
    verdict: item.report.verdict,
    totals: item.report.totals,
    safetyFloor: item.report.safetyFloor,
    deflection: item.report.deflection,
    routingPrecision: item.report.routingPrecision,
    uxQuality: item.report.uxQuality,
  };
}

function loadHellWeekReport(input: string): LoadedReport {
  const path = resolveReportPath(input);
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const report = normalizeReport(raw, path);

  return { path, report };
}

function resolveReportPath(input: string): string {
  if (!existsSync(input)) {
    throw new Error(`Hell Week report path does not exist: ${input}`);
  }

  if (statSync(input).isDirectory()) {
    const reportPath = join(input, "report.json");
    if (!existsSync(reportPath)) {
      throw new Error(`No report.json found in Hell Week run dir: ${input}`);
    }
    return reportPath;
  }

  return input;
}

function normalizeReport(raw: unknown, path: string): CompareReport {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid Hell Week report JSON: ${path}`);
  }

  const report = raw as Partial<CompareReport>;
  if (!report.totals || !Array.isArray(report.grades)) {
    throw new Error(
      `Invalid Hell Week report JSON: ${path} is missing totals or grades.`,
    );
  }

  return {
    runId: stringValue(report.runId, basename(path)),
    ...(typeof report.generatedAt === "string"
      ? { generatedAt: report.generatedAt }
      : {}),
    profile: stringValue(report.profile, "unknown"),
    verdict: verdictValue(report.verdict),
    totals: totalsValue(report.totals),
    safetyFloor: {
      pass: numberValue(report.safetyFloor?.pass),
      total: numberValue(report.safetyFloor?.total),
      breached: Boolean(report.safetyFloor?.breached),
    },
    deflection: {
      answered: numberValue(report.deflection?.answered),
      total: numberValue(report.deflection?.total),
      rate: numberValue(report.deflection?.rate),
    },
    routingPrecision: {
      inScopeScenarios: numberValue(report.routingPrecision?.inScopeScenarios),
      misroutes: numberValue(report.routingPrecision?.misroutes),
      rate: numberValue(report.routingPrecision?.rate),
      signalTurns: numberValue(report.routingPrecision?.signalTurns),
      signalAgreements: numberValue(report.routingPrecision?.signalAgreements),
      signalAgreementRate: numberValue(
        report.routingPrecision?.signalAgreementRate,
      ),
    },
    uxQuality: {
      scored: numberValue(report.uxQuality?.scored),
      averageScore:
        typeof report.uxQuality?.averageScore === "number"
          ? report.uxQuality.averageScore
          : null,
    },
    grades: report.grades.map((grade) => normalizeGrade(grade)),
  };
}

function normalizeGrade(raw: unknown): CompareGrade {
  const grade = raw as Partial<CompareGrade>;
  return {
    scenarioId: stringValue(grade.scenarioId, "unknown"),
    ...(typeof grade.title === "string" ? { title: grade.title } : {}),
    ...(typeof grade.dimension === "string"
      ? { dimension: grade.dimension }
      : {}),
    pass: Boolean(grade.pass),
    severity: severityValue(grade.severity),
    triageLabels: Array.isArray(grade.triageLabels)
      ? grade.triageLabels.filter(
          (label): label is string => typeof label === "string",
        )
      : [],
    rationale: stringValue(grade.rationale, ""),
  };
}

function totalsValue(raw: unknown): ReportTotals {
  const totals = raw as Partial<ReportTotals>;
  return {
    scenarios: numberValue(totals.scenarios),
    passed: numberValue(totals.passed),
    failed: numberValue(totals.failed),
    passRate: numberValue(totals.passRate),
    demoKillers: numberValue(totals.demoKillers),
    dents: numberValue(totals.dents),
    fine: numberValue(totals.fine),
    errored: numberValue(totals.errored),
  };
}

function buildDeltas(
  baseline: CompareReport,
  candidate: CompareReport,
): HellWeekComparison["deltas"] {
  return {
    scenarios: candidate.totals.scenarios - baseline.totals.scenarios,
    passed: candidate.totals.passed - baseline.totals.passed,
    failed: candidate.totals.failed - baseline.totals.failed,
    passRatePoints: points(
      candidate.totals.passRate - baseline.totals.passRate,
    ),
    demoKillers: candidate.totals.demoKillers - baseline.totals.demoKillers,
    dents: candidate.totals.dents - baseline.totals.dents,
    errored: candidate.totals.errored - baseline.totals.errored,
    safetyFloorPass: candidate.safetyFloor.pass - baseline.safetyFloor.pass,
    deflectionRatePoints: points(
      candidate.deflection.rate - baseline.deflection.rate,
    ),
    routingPrecisionPoints: points(
      candidate.routingPrecision.rate - baseline.routingPrecision.rate,
    ),
    signalAgreementPoints: points(
      candidate.routingPrecision.signalAgreementRate -
        baseline.routingPrecision.signalAgreementRate,
    ),
    uxAverage:
      baseline.uxQuality.averageScore === null ||
      candidate.uxQuality.averageScore === null
        ? null
        : round1(
            candidate.uxQuality.averageScore - baseline.uxQuality.averageScore,
          ),
  };
}

function toScenarioChange(
  baseline: CompareGrade,
  candidate: CompareGrade,
): ScenarioChange {
  return {
    scenarioId: candidate.scenarioId,
    title: candidate.title ?? baseline.title ?? "",
    dimension: candidate.dimension ?? baseline.dimension ?? "",
    baselineSeverity: baseline.severity,
    candidateSeverity: candidate.severity,
    baselinePass: baseline.pass,
    candidatePass: candidate.pass,
    triageLabels:
      candidate.triageLabels.length > 0
        ? candidate.triageLabels
        : baseline.triageLabels,
    rationale: candidate.rationale || baseline.rationale,
  };
}

function recommend(
  comparison: HellWeekComparison,
): HellWeekComparison["recommendation"] {
  const { deltas, scenarioChanges, candidate, baseline } = comparison;
  const newDemoKillers = scenarioChanges.newFailures.filter(
    (change) => change.candidateSeverity === "demo_killer",
  ).length;
  const resolvedDemoKillers = scenarioChanges.resolvedFailures.filter(
    (change) => change.baselineSeverity === "demo_killer",
  ).length;

  if (
    newDemoKillers > 0 ||
    (candidate.report.safetyFloor.breached &&
      !baseline.report.safetyFloor.breached)
  ) {
    return {
      status: "regressed",
      summary:
        "new safety-floor risk appeared; stop the slice and inspect the new demo-killer before merging.",
    };
  }

  if (deltas.demoKillers < 0 && newDemoKillers === 0) {
    return {
      status:
        deltas.dents > 0 || scenarioChanges.newFailures.length > 0
          ? "mixed"
          : "improved",
      summary: `${resolvedDemoKillers} demo-killer failure(s) resolved with no new demo-killer.`,
    };
  }

  if (deltas.passed > 0 && scenarioChanges.newFailures.length === 0) {
    return {
      status: "improved",
      summary: "pass count improved with no new overlapping-scenario failures.",
    };
  }

  if (deltas.passed < 0 || scenarioChanges.newFailures.length > 0) {
    return {
      status: "mixed",
      summary:
        "some behavior moved backward; inspect new failures before treating the slice as progress.",
    };
  }

  return {
    status: "unchanged",
    summary: "no material movement in the compared Hell Week reports.",
  };
}

function changeBlock(title: string, changes: ScenarioChange[]): string {
  if (changes.length === 0) {
    return "";
  }

  const lines = changes.slice(0, 8).map((change) => {
    const labels =
      change.triageLabels.length > 0
        ? ` [${change.triageLabels.join(", ")}]`
        : "";
    const titleText = change.title ? ` - ${change.title}` : "";
    return `- ${change.scenarioId}${titleText}: ${change.baselineSeverity}/${change.baselinePass ? "pass" : "fail"} -> ${change.candidateSeverity}/${change.candidatePass ? "pass" : "fail"}${labels}`;
  });

  return [``, `${title}:`, ...lines].join("\n");
}

function sortChanges(changes: ScenarioChange[]): ScenarioChange[] {
  return [...changes].sort((a, b) => {
    const severity =
      severityRank[b.candidateSeverity] - severityRank[a.candidateSeverity];
    if (severity !== 0) {
      return severity;
    }
    return a.scenarioId.localeCompare(b.scenarioId);
  });
}

function label(item: LoadedReport): string {
  return `${item.report.runId} (${item.report.profile})`;
}

function countRate(count: number, total: number, rate: number): string {
  return `${count}/${total} (${pct(rate)})`;
}

function floorStatus(report: CompareReport): string {
  return `${report.safetyFloor.breached ? "breached" : "holding"} ${report.safetyFloor.pass}/${report.safetyFloor.total}`;
}

function rateOrNa(rate: number, total: number): string {
  return total <= 0 ? "n/a" : pct(rate);
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function signedPoints(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function signedInt(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function points(value: number): number {
  return round1(value * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function verdictValue(value: unknown): HellWeekVerdict {
  if (value === "blocked" || value === "needs_work" || value === "ship_ready") {
    return value;
  }
  return "blocked";
}

function severityValue(value: unknown): Severity {
  if (value === "demo_killer" || value === "dent" || value === "fine") {
    return value;
  }
  return "dent";
}
