import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  compareHellWeekReports,
  toHellWeekComparisonJson,
  type HellWeekComparabilityWarning,
  type HellWeekComparisonJson,
} from "./compare";
import type { TriageLabel } from "./triageLabels";
import {
  severityRank,
  type HellWeekGrade,
  type HellWeekReport,
  type Severity,
} from "./types";

export type HellWeekStabilityClassification =
  | "stable_pass"
  | "stable_failure"
  | "recurring_failure"
  | "one_off_failure"
  | "mixed";

export interface HellWeekStabilityRunSummary {
  runId: string;
  position: number;
  generatedAt: string;
  profile: string;
  planner: HellWeekReport["planner"];
  signalExtractor: HellWeekReport["signalExtractor"];
  policyVersion: string;
  judged: boolean;
  judge?: HellWeekReport["judge"];
  verdict: HellWeekReport["verdict"];
  totals: HellWeekReport["totals"];
}

export interface HellWeekStabilityOutcome {
  runId: string;
  position: number;
  pass: boolean | null;
  severity: Severity | null;
  triageLabels: TriageLabel[];
  rationale: string;
  missing: boolean;
}

export interface HellWeekStabilityScenario {
  scenarioId: string;
  title: string;
  category: string;
  dimension: string;
  passCount: number;
  failCount: number;
  missingCount: number;
  worstSeverity: Severity;
  classification: HellWeekStabilityClassification;
  severityCounts: Record<Severity, number>;
  triageLabels: TriageLabel[];
  outcomes: HellWeekStabilityOutcome[];
}

export interface HellWeekStabilitySummary {
  stablePass: number;
  stableFailure: number;
  recurringFailure: number;
  oneOffFailure: number;
  mixed: number;
}

export interface HellWeekStabilityPairwiseComparison {
  baselineRunId: string;
  candidateRunId: string;
  baselinePosition: number;
  candidatePosition: number;
  comparison: HellWeekComparisonJson;
}

export interface HellWeekStabilityReport {
  setId: string;
  reportType: "stability";
  generatedAt: string;
  label: string;
  profile: string;
  runCount: number;
  scenarioCount: number;
  scenarioSetChanged: boolean;
  comparability: {
    compatible: boolean;
    warnings: HellWeekComparabilityWarning[];
  };
  runs: HellWeekStabilityRunSummary[];
  summary: HellWeekStabilitySummary;
  scenarios: HellWeekStabilityScenario[];
  pairwiseComparisons: HellWeekStabilityPairwiseComparison[];
}

export interface HellWeekStabilityArtifacts {
  setId: string;
  runDir: string;
  reportJsonPath: string;
  reportHtmlPath: string;
  report: HellWeekStabilityReport;
}

export function buildHellWeekStabilityReport({
  setId,
  label,
  runs,
  now = () => new Date(),
}: {
  setId: string;
  label?: string;
  runs: readonly HellWeekReport[];
  now?: () => Date;
}): HellWeekStabilityReport {
  if (runs.length < 2) {
    throw new Error("Hell Week stability requires at least two runs.");
  }

  const scenarioOrder = orderedScenarioIds(runs);
  const scenarios = scenarioOrder.map((scenarioId) =>
    scenarioStability(scenarioId, runs),
  );
  const summary = summarizeScenarios(scenarios);
  const pairwiseComparisons = pairwiseStabilityComparisons(runs);
  const comparabilityWarnings =
    stabilityComparabilityWarnings(pairwiseComparisons);
  const scenarioSetChanged = runs.some(
    (run) => run.scenarios.length !== scenarioOrder.length,
  );

  return {
    setId,
    reportType: "stability",
    generatedAt: now().toISOString(),
    label: label ?? setId,
    profile: runs[0]?.profile ?? "unknown",
    runCount: runs.length,
    scenarioCount: scenarios.length,
    scenarioSetChanged,
    comparability: {
      compatible: comparabilityWarnings.length === 0,
      warnings: comparabilityWarnings,
    },
    runs: runs.map((run, index) => ({
      runId: run.runId,
      position: index,
      generatedAt: run.generatedAt,
      profile: run.profile,
      planner: run.planner,
      signalExtractor: run.signalExtractor,
      policyVersion: run.policyVersion,
      judged: run.judged,
      ...(run.judge ? { judge: run.judge } : {}),
      verdict: run.verdict,
      totals: run.totals,
    })),
    summary,
    scenarios,
    pairwiseComparisons,
  };
}

export function writeHellWeekStabilityArtifacts({
  report,
  outBaseDir,
}: {
  report: HellWeekStabilityReport;
  outBaseDir: string;
}): HellWeekStabilityArtifacts {
  const runDir = join(outBaseDir, report.setId);
  mkdirSync(runDir, { recursive: true });

  const reportJsonPath = join(runDir, "report.json");
  const reportHtmlPath = join(runDir, "report.html");

  writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(reportHtmlPath, renderHellWeekStabilityHtml(report), "utf8");

  return {
    setId: report.setId,
    runDir,
    reportJsonPath,
    reportHtmlPath,
    report,
  };
}

export function renderHellWeekStabilityHtml(
  report: HellWeekStabilityReport,
): string {
  const rows = report.scenarios
    .map(
      (scenario) => `<tr>
        <td>${escapeHtml(scenario.scenarioId)}</td>
        <td>${escapeHtml(scenario.title)}</td>
        <td>${escapeHtml(scenario.dimension)}</td>
        <td>${escapeHtml(scenario.classification)}</td>
        <td class="num">${scenario.passCount}</td>
        <td class="num">${scenario.failCount}</td>
        <td>${escapeHtml(scenario.worstSeverity)}</td>
        <td>${escapeHtml(scenario.triageLabels.join(", ") || "-")}</td>
      </tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.label)} - Hell Week Stability</title>
  <style>
    body{font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:32px;color:#161616;background:#fff}
    h1{font-size:1.7rem;margin:0 0 8px}
    h2{font-size:1.1rem;margin:28px 0 8px}
    .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 24px;margin:18px 0 24px}
    .k{display:block;color:#666;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em}
    .v{font-weight:650}
    table{border-collapse:collapse;width:100%;margin-top:8px}
    th,td{border-bottom:1px solid #ddd;padding:7px 8px;text-align:left;vertical-align:top}
    th{font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:#555}
    .num{text-align:right}
    .warn{color:#8a4b00}
  </style>
</head>
<body>
  <h1>${escapeHtml(report.label)}</h1>
  <p>Hell Week stability report for ${report.runCount} repeated run${report.runCount === 1 ? "" : "s"}.</p>
  <section class="meta">
    ${metric("Profile", report.profile)}
    ${metric("Runs", String(report.runCount))}
    ${metric("Scenarios", String(report.scenarioCount))}
    ${metric("Stable pass", String(report.summary.stablePass))}
    ${metric("Stable failure", String(report.summary.stableFailure))}
    ${metric("Recurring failure", String(report.summary.recurringFailure))}
    ${metric("One-off failure", String(report.summary.oneOffFailure))}
    ${metric("Mixed", String(report.summary.mixed))}
  </section>
  ${
    report.scenarioSetChanged
      ? '<p class="warn">Scenario sets differ; inspect missing/mixed rows before treating this as a clean stability report.</p>'
      : ""
  }
  ${
    report.comparability.warnings.length > 0
      ? `<section><h2>Comparability Warnings</h2><ul>${report.comparability.warnings
          .map(
            (warning) =>
              `<li><strong>${escapeHtml(warning.field)}</strong>: ${escapeHtml(warning.baseline)} -> ${escapeHtml(warning.candidate)}. ${escapeHtml(warning.message)}</li>`,
          )
          .join("")}</ul></section>`
      : ""
  }
  <h2>Runs</h2>
  <table>
    <thead><tr><th>#</th><th>Run</th><th>Verdict</th><th>Pass</th><th>Planner</th><th>Signal</th><th>Policy</th><th>Judged</th><th>Generated</th></tr></thead>
    <tbody>
      ${report.runs
        .map(
          (run) =>
            `<tr><td>${run.position + 1}</td><td>${escapeHtml(run.runId)}</td><td>${escapeHtml(run.verdict)}</td><td>${run.totals.passed}/${run.totals.scenarios}</td><td>${escapeHtml(`${run.planner.model} / ${run.planner.promptVersion}`)}</td><td>${escapeHtml(signalSummary(run.signalExtractor))}</td><td>${escapeHtml(run.policyVersion)}</td><td>${run.judged ? "yes" : "no"}</td><td>${escapeHtml(run.generatedAt)}</td></tr>`,
        )
        .join("\n")}
    </tbody>
  </table>
  <h2>Scenario Stability</h2>
  <table>
    <thead><tr><th>Scenario</th><th>Title</th><th>Dimension</th><th>Class</th><th class="num">Pass</th><th class="num">Fail</th><th>Worst</th><th>Triage</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`;
}

function orderedScenarioIds(runs: readonly HellWeekReport[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const run of runs) {
    for (const scenario of run.scenarios) {
      if (!seen.has(scenario.id)) {
        ids.push(scenario.id);
        seen.add(scenario.id);
      }
    }
  }

  return ids;
}

function scenarioStability(
  scenarioId: string,
  runs: readonly HellWeekReport[],
): HellWeekStabilityScenario {
  const outcomes = runs.map((run, index) =>
    outcomeForRun(run, index, scenarioId),
  );
  const present = outcomes.filter((outcome) => !outcome.missing);
  const passCount = present.filter((outcome) => outcome.pass === true).length;
  const failCount = present.filter((outcome) => outcome.pass === false).length;
  const missingCount = outcomes.length - present.length;
  const worstSeverity = worstSeverityForOutcomes(outcomes);
  const severityCounts = severityCountsForOutcomes(outcomes);
  const triageLabels = [
    ...new Set(outcomes.flatMap((outcome) => outcome.triageLabels)),
  ].sort();
  const firstGrade = firstPresentGrade(runs, scenarioId);
  const firstScenario = runs
    .flatMap((run) => run.scenarios)
    .find((scenario) => scenario.id === scenarioId);

  return {
    scenarioId,
    title: firstGrade?.title ?? firstScenario?.title ?? scenarioId,
    category: firstGrade?.category ?? firstScenario?.category ?? "unknown",
    dimension: firstGrade?.dimension ?? firstScenario?.dimension ?? "unknown",
    passCount,
    failCount,
    missingCount,
    worstSeverity,
    classification: classify({
      runCount: runs.length,
      failCount,
      missingCount,
    }),
    severityCounts,
    triageLabels,
    outcomes,
  };
}

function outcomeForRun(
  run: HellWeekReport,
  position: number,
  scenarioId: string,
): HellWeekStabilityOutcome {
  const grade = run.grades.find((item) => item.scenarioId === scenarioId);

  if (!grade) {
    return {
      runId: run.runId,
      position,
      pass: null,
      severity: null,
      triageLabels: [],
      rationale: "Scenario missing from run.",
      missing: true,
    };
  }

  return {
    runId: run.runId,
    position,
    pass: grade.pass,
    severity: grade.severity,
    triageLabels: grade.triageLabels,
    rationale: grade.rationale,
    missing: false,
  };
}

function classify({
  runCount,
  failCount,
  missingCount,
}: {
  runCount: number;
  failCount: number;
  missingCount: number;
}): HellWeekStabilityClassification {
  if (missingCount > 0) {
    return "mixed";
  }

  if (failCount === 0) {
    return "stable_pass";
  }

  if (failCount === runCount) {
    return "stable_failure";
  }

  if (failCount === 1) {
    return "one_off_failure";
  }

  if (failCount > 1) {
    return "recurring_failure";
  }

  return "mixed";
}

function summarizeScenarios(
  scenarios: readonly HellWeekStabilityScenario[],
): HellWeekStabilitySummary {
  return {
    stablePass: scenarios.filter(
      (item) => item.classification === "stable_pass",
    ).length,
    stableFailure: scenarios.filter(
      (item) => item.classification === "stable_failure",
    ).length,
    recurringFailure: scenarios.filter(
      (item) => item.classification === "recurring_failure",
    ).length,
    oneOffFailure: scenarios.filter(
      (item) => item.classification === "one_off_failure",
    ).length,
    mixed: scenarios.filter((item) => item.classification === "mixed").length,
  };
}

function pairwiseStabilityComparisons(
  runs: readonly HellWeekReport[],
): HellWeekStabilityPairwiseComparison[] {
  const comparisons: HellWeekStabilityPairwiseComparison[] = [];

  for (let index = 0; index < runs.length - 1; index += 1) {
    const baseline = runs[index];
    const candidate = runs[index + 1];

    if (!baseline || !candidate) {
      continue;
    }

    comparisons.push({
      baselineRunId: baseline.runId,
      candidateRunId: candidate.runId,
      baselinePosition: index,
      candidatePosition: index + 1,
      comparison: toHellWeekComparisonJson(
        compareHellWeekReports(
          { path: `db:${baseline.runId}`, report: baseline },
          { path: `db:${candidate.runId}`, report: candidate },
        ),
      ),
    });
  }

  return comparisons;
}

function stabilityComparabilityWarnings(
  comparisons: readonly HellWeekStabilityPairwiseComparison[],
): HellWeekComparabilityWarning[] {
  const warnings: HellWeekComparabilityWarning[] = [];
  const seen = new Set<string>();

  for (const item of comparisons) {
    for (const warning of item.comparison.comparability.warnings) {
      const key = [
        warning.field,
        warning.baseline,
        warning.candidate,
        warning.message,
      ].join("\u0000");

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      warnings.push(warning);
    }
  }

  return warnings;
}

function firstPresentGrade(
  runs: readonly HellWeekReport[],
  scenarioId: string,
): HellWeekGrade | undefined {
  for (const run of runs) {
    const grade = run.grades.find((item) => item.scenarioId === scenarioId);

    if (grade) {
      return grade;
    }
  }

  return undefined;
}

function severityCountsForOutcomes(
  outcomes: readonly HellWeekStabilityOutcome[],
): Record<Severity, number> {
  return {
    demo_killer: outcomes.filter(
      (outcome) => outcome.severity === "demo_killer",
    ).length,
    dent: outcomes.filter((outcome) => outcome.severity === "dent").length,
    fine: outcomes.filter((outcome) => outcome.severity === "fine").length,
  };
}

function worstSeverityForOutcomes(
  outcomes: readonly HellWeekStabilityOutcome[],
): Severity {
  return outcomes.reduce<Severity>(
    (worst, outcome) =>
      outcome.severity && severityRank[outcome.severity] > severityRank[worst]
        ? outcome.severity
        : worst,
    "fine",
  );
}

function metric(label: string, value: string): string {
  return `<div><span class="k">${escapeHtml(label)}</span><span class="v">${escapeHtml(value)}</span></div>`;
}

function signalSummary(signal: HellWeekReport["signalExtractor"]): string {
  if (!signal.enabled) {
    return "disabled";
  }

  return `${signal.model ?? "unknown"} / ${signal.promptVersion ?? "unknown"}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
