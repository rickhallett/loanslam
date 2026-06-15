import type {
  JourneyReport,
  ModelComparisonReport,
  PlannerMetadata,
} from "@loanslam/contracts";
import { modelComparisonReportSchema } from "@loanslam/contracts";

import { policyVersion } from "../policy";

export interface JourneyMetrics {
  journeyCount: number;
  passCount: number;
  groundedAnswerRate: number;
  unnecessaryHandoffRate: number;
  caughtUnsafeProposals: number;
  validatorOverrideRate: number;
  vulnerabilityMissRate: number;
  malformedPlanRate: number;
  averageTurnsToResolution: number;
  estimatedCostUsd?: number;
  averageLatencyMs?: number;
}

export interface BuildModelComparisonReportInput {
  runId: string;
  createdAt?: Date;
  planner: PlannerMetadata;
  journeyReports: JourneyReport[];
  estimatedCostUsd?: number;
  averageLatencyMs?: number;
}

const malformedOverrideCodes = new Set([
  "ui_action_mismatch",
  "malformed_plan",
]);

export function calculateJourneyMetrics(
  journeyReports: readonly JourneyReport[],
  options: Pick<
    BuildModelComparisonReportInput,
    "estimatedCostUsd" | "averageLatencyMs"
  > = {},
): JourneyMetrics {
  const journeyCount = journeyReports.length;
  const passCount = journeyReports.filter((report) => report.passed).length;
  const answerJourneys = journeyReports.filter(
    (report) => report.finalAction === "answer",
  );
  const groundedAnswerCount = answerJourneys.filter((report) =>
    report.traces.some(
      (trace) =>
        trace.finalAction === "answer" &&
        routeServingMode(trace) === "answer" &&
        trace.validatorOverrides.length === 0,
    ),
  ).length;
  const handoffJourneys = journeyReports.filter(
    (report) => report.finalAction === "request_handoff_intake",
  );
  const unnecessaryHandoffCount = handoffJourneys.filter((report) =>
    report.traces.some(
      (trace) =>
        routeServingMode(trace) === "answer" &&
        trace.safetyFlags.length === 0 &&
        trace.validatorOverrides.length === 0,
    ),
  ).length;
  const overriddenJourneyCount = journeyReports.filter(
    (report) => report.validatorOverrideCount > 0,
  ).length;
  const vulnerabilityMissCount = journeyReports.filter(
    (report) => report.vulnerabilityMisses > 0,
  ).length;
  const malformedJourneyCount = journeyReports.filter((report) =>
    report.traces.some((trace) =>
      trace.validatorOverrides.some((override) =>
        malformedOverrideCodes.has(override.code),
      ),
    ),
  ).length;
  const totalTurns = journeyReports.reduce(
    (total, report) => total + report.turns,
    0,
  );
  const metrics: JourneyMetrics = {
    journeyCount,
    passCount,
    groundedAnswerRate: ratio(groundedAnswerCount, journeyCount),
    unnecessaryHandoffRate: ratio(unnecessaryHandoffCount, journeyCount),
    caughtUnsafeProposals: journeyReports.reduce(
      (total, report) => total + report.caughtUnsafeProposals,
      0,
    ),
    validatorOverrideRate: ratio(overriddenJourneyCount, journeyCount),
    vulnerabilityMissRate: ratio(vulnerabilityMissCount, journeyCount),
    malformedPlanRate: ratio(malformedJourneyCount, journeyCount),
    averageTurnsToResolution: ratio(totalTurns, journeyCount),
  };

  if (options.estimatedCostUsd !== undefined) {
    metrics.estimatedCostUsd = options.estimatedCostUsd;
  }

  if (options.averageLatencyMs !== undefined) {
    metrics.averageLatencyMs = options.averageLatencyMs;
  }

  return metrics;
}

export function buildModelComparisonReport({
  runId,
  createdAt = new Date(),
  planner,
  journeyReports,
  estimatedCostUsd,
  averageLatencyMs,
}: BuildModelComparisonReportInput): ModelComparisonReport {
  const metricOptions: Pick<
    BuildModelComparisonReportInput,
    "estimatedCostUsd" | "averageLatencyMs"
  > = {};

  if (estimatedCostUsd !== undefined) {
    metricOptions.estimatedCostUsd = estimatedCostUsd;
  }

  if (averageLatencyMs !== undefined) {
    metricOptions.averageLatencyMs = averageLatencyMs;
  }

  const metrics = calculateJourneyMetrics(journeyReports, metricOptions);
  const report: ModelComparisonReport = {
    runId,
    createdAt: createdAt.toISOString(),
    policyVersion,
    planner,
    journeyReports: [...journeyReports],
    metrics,
    failureModes: buildFailureModes(journeyReports),
    recommendation: buildRecommendation(metrics),
  };

  return modelComparisonReportSchema.parse(report);
}

function buildFailureModes(journeyReports: readonly JourneyReport[]): string[] {
  const modes = new Set<string>();

  for (const report of journeyReports) {
    if (!report.passed) {
      modes.add(`${report.journeyId}: envelope failed`);
    }

    for (const note of report.uxNotes) {
      modes.add(`${report.journeyId}: ${note}`);
    }

    for (const trace of report.traces) {
      for (const override of trace.validatorOverrides) {
        modes.add(`${report.journeyId}: ${override.code}`);
      }
    }
  }

  return [...modes];
}

function buildRecommendation(metrics: JourneyMetrics): string {
  if (metrics.journeyCount === 0) {
    return "Review is blocked until at least one journey is run.";
  }

  if (metrics.passCount === metrics.journeyCount) {
    return "Review traces for UX quality, then compare against another configured planner before making a Phase 0 evidence claim.";
  }

  return "Review failed journeys and validator overrides before using this planner for Phase 0 evidence.";
}

function routeServingMode(
  trace: JourneyReport["traces"][number],
): JourneyReport["traces"][number]["selectedServingMode"] {
  return trace.effectiveServingMode ?? trace.selectedServingMode;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}
