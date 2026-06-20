import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

import { buildHellWeekReport } from "./aggregate";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import type { HellWeekStabilityReport } from "./stability";
import type {
  HellWeekGrade,
  HellWeekReport,
  HellWeekScenario,
  HellWeekScenarioEvidence,
  HellWeekTurnEvidence,
} from "./types";

export interface HellWeekReportStore {
  saveReport(report: HellWeekReport): Promise<void>;
  loadReport(runId: string): Promise<HellWeekReport | undefined>;
  loadReports(runIds: readonly string[]): Promise<HellWeekReport[]>;
  saveStabilityReport(report: HellWeekStabilityReport): Promise<void>;
  loadStabilityReport(
    setId: string,
  ): Promise<HellWeekStabilityReport | undefined>;
  close(): Promise<void>;
}

export function openHellWeekReportStore(
  databaseUrl = hellWeekDatabaseUrlFromEnv(process.env),
): HellWeekReportStore {
  if (!databaseUrl) {
    throw new Error(
      "Hell Week DB reporting requires --db, DEMO_INTERACTION_DATABASE_URL, or DATABASE_URL.",
    );
  }

  const adapter = isNeonDatabaseUrl(databaseUrl)
    ? new PrismaNeon({ connectionString: databaseUrl })
    : new PrismaPg({ connectionString: databaseUrl });

  return new PrismaHellWeekReportStore(new PrismaClient({ adapter }));
}

export function hellWeekDatabaseUrlFromEnv(
  env: Record<string, string | undefined>,
): string | undefined {
  return (
    env.HELL_WEEK_DATABASE_URL ??
    env.DEMO_INTERACTION_DATABASE_URL ??
    env.DATABASE_URL ??
    env.POSTGRES_PRISMA_URL ??
    env.POSTGRES_URL
  );
}

class PrismaHellWeekReportStore implements HellWeekReportStore {
  constructor(private readonly prisma: PrismaClient) {}

  async saveReport(report: HellWeekReport): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const run = await tx.hellWeekRun.upsert({
        where: { runId: report.runId },
        create: runData(report),
        update: runData(report),
      });

      await tx.hellWeekGrade.deleteMany({ where: { runId: run.id } });
      await tx.hellWeekTurn.deleteMany({ where: { runId: run.id } });
      await tx.hellWeekScenario.deleteMany({ where: { runId: run.id } });

      const evidenceById = new Map(
        report.evidence.map((item) => [item.scenarioId, item]),
      );
      const gradeById = new Map(
        report.grades.map((item) => [item.scenarioId, item]),
      );

      for (const [position, scenario] of report.scenarios.entries()) {
        const evidence = evidenceById.get(scenario.id) ?? {
          scenarioId: scenario.id,
          conversationRef: `hellweek-${scenario.id}`,
          turns: [],
          durationMs: 0,
          error: "No evidence captured for scenario.",
        };
        const scenarioRow = await tx.hellWeekScenario.create({
          data: scenarioData({ runId: run.id, position, scenario, evidence }),
        });

        if (evidence.turns.length > 0) {
          await tx.hellWeekTurn.createMany({
            data: evidence.turns.map((turn) =>
              turnData({ runId: run.id, scenarioId: scenarioRow.id, turn }),
            ),
          });
        }

        const grade = gradeById.get(scenario.id);
        if (!grade) {
          throw new Error(
            `Hell Week grade missing for scenario ${scenario.id}.`,
          );
        }

        await tx.hellWeekGrade.create({
          data: gradeData({
            runId: run.id,
            scenarioId: scenarioRow.id,
            grade,
          }),
        });
      }
    });
  }

  async loadReport(runId: string): Promise<HellWeekReport | undefined> {
    const run = await this.prisma.hellWeekRun.findUnique({
      where: { runId },
      include: {
        scenarios: {
          orderBy: { position: "asc" },
          include: {
            turns: { orderBy: { turnIndex: "asc" } },
            grades: true,
          },
        },
      },
    });

    if (!run) {
      return undefined;
    }

    const scenarios = run.scenarios.map((scenario) =>
      castJson<HellWeekScenario>(scenario.scenarioJson),
    );
    const evidence = run.scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      conversationRef: scenario.conversationRef,
      turns: scenario.turns.map((turn) =>
        castJson<HellWeekTurnEvidence>(turn.turnJson),
      ),
      durationMs: scenario.durationMs,
      ...(scenario.error ? { error: scenario.error } : {}),
    }));
    const gradeByScenarioId = new Map(
      run.scenarios.flatMap((scenario) =>
        scenario.grades.map((grade) => [
          grade.scenarioKey,
          castJson<HellWeekGrade>(grade.gradeJson),
        ]),
      ),
    );
    const grades = scenarios.map((scenario) => {
      const grade = gradeByScenarioId.get(scenario.id);

      if (!grade) {
        throw new Error(
          `Stored Hell Week run ${runId} is missing grade ${scenario.id}.`,
        );
      }

      return grade;
    });
    const judge = optionalJson<HellWeekReport["judge"]>(run.judge);

    return buildHellWeekReport({
      runId: run.runId,
      generatedAt: run.generatedAt.toISOString(),
      profile: run.profile,
      planner: castJson(run.planner),
      signalExtractor: castJson(run.signalExtractor),
      policyVersion: run.policyVersion,
      judged: run.judged,
      ...(judge ? { judge } : {}),
      durationMs: run.durationMs,
      scenarios,
      evidence,
      grades,
    });
  }

  async loadReports(runIds: readonly string[]): Promise<HellWeekReport[]> {
    const reports: HellWeekReport[] = [];

    for (const runId of runIds) {
      const report = await this.loadReport(runId);

      if (!report) {
        throw new Error(`No Hell Week run found in Postgres for ${runId}.`);
      }

      reports.push(report);
    }

    return reports;
  }

  async saveStabilityReport(report: HellWeekStabilityReport): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const persistedRuns = await tx.hellWeekRun.findMany({
        where: { runId: { in: report.runs.map((run) => run.runId) } },
      });
      const runById = new Map(persistedRuns.map((run) => [run.runId, run.id]));

      for (const run of report.runs) {
        if (!runById.has(run.runId)) {
          throw new Error(
            `Cannot store Hell Week stability report; run ${run.runId} is missing.`,
          );
        }
      }

      const runSet = await tx.hellWeekRunSet.upsert({
        where: { setId: report.setId },
        create: runSetData(report),
        update: runSetData(report),
      });

      await tx.hellWeekRunSetPairwiseComparison.deleteMany({
        where: { runSetId: runSet.id },
      });
      await tx.hellWeekRunSetScenario.deleteMany({
        where: { runSetId: runSet.id },
      });
      await tx.hellWeekRunSetMember.deleteMany({
        where: { runSetId: runSet.id },
      });

      await tx.hellWeekRunSetMember.createMany({
        data: report.runs.map((run) => ({
          runSetId: runSet.id,
          runId: runById.get(run.runId) as bigint,
          position: run.position,
          role:
            run.position === 0
              ? "baseline"
              : run.position === report.runs.length - 1
                ? "candidate"
                : "repeat",
        })),
      });

      await tx.hellWeekRunSetScenario.createMany({
        data: report.scenarios.map((scenario) => ({
          runSetId: runSet.id,
          scenarioId: scenario.scenarioId,
          title: scenario.title,
          category: scenario.category,
          dimension: scenario.dimension,
          passCount: scenario.passCount,
          failCount: scenario.failCount,
          missingCount: scenario.missingCount,
          worstSeverity: scenario.worstSeverity,
          classification: scenario.classification,
          severityCounts: json(scenario.severityCounts),
          triageLabels: json(scenario.triageLabels),
          outcomes: json(scenario.outcomes),
          scenarioJson: json(scenario),
        })),
      });

      if (report.pairwiseComparisons.length > 0) {
        await tx.hellWeekRunSetPairwiseComparison.createMany({
          data: report.pairwiseComparisons.map((comparison) => ({
            runSetId: runSet.id,
            baselineRunId: runById.get(comparison.baselineRunId) as bigint,
            candidateRunId: runById.get(comparison.candidateRunId) as bigint,
            baselinePosition: comparison.baselinePosition,
            candidatePosition: comparison.candidatePosition,
            comparisonJson: json(comparison.comparison),
          })),
        });
      }
    });
  }

  async loadStabilityReport(
    setId: string,
  ): Promise<HellWeekStabilityReport | undefined> {
    const runSet = await this.prisma.hellWeekRunSet.findUnique({
      where: { setId },
    });

    return runSet
      ? castJson<HellWeekStabilityReport>(runSet.reportJson)
      : undefined;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

function runSetData(report: HellWeekStabilityReport) {
  return {
    setId: report.setId,
    generatedAt: new Date(report.generatedAt),
    reportType: report.reportType,
    profile: report.profile,
    label: report.label,
    runCount: report.runCount,
    scenarioCount: report.scenarioCount,
    scenarioSetChanged: report.scenarioSetChanged,
    stablePassCount: report.summary.stablePass,
    stableFailureCount: report.summary.stableFailure,
    recurringFailureCount: report.summary.recurringFailure,
    oneOffFailureCount: report.summary.oneOffFailure,
    mixedCount: report.summary.mixed,
    summary: json(report.summary),
    reportJson: json(report),
  };
}

function runData(report: HellWeekReport) {
  return {
    runId: report.runId,
    generatedAt: new Date(report.generatedAt),
    profile: report.profile,
    planner: json(report.planner),
    signalExtractor: json(report.signalExtractor),
    policyVersion: report.policyVersion,
    judged: report.judged,
    judge: nullableJson(report.judge),
    durationMs: report.durationMs,
    verdict: report.verdict,
    headline: report.headline,
    totals: json(report.totals),
    safetyFloor: json(report.safetyFloor),
    deflection: json(report.deflection),
    routingPrecision: json(report.routingPrecision),
    uxQuality: json(report.uxQuality),
    categories: json(report.categories),
    dimensions: json(report.dimensions),
    severityCounts: json(report.severityCounts),
    triageCounts: json(report.triageCounts),
    topRisks: json(report.topRisks),
  };
}

function scenarioData({
  runId,
  position,
  scenario,
  evidence,
}: {
  runId: bigint;
  position: number;
  scenario: HellWeekScenario;
  evidence: HellWeekScenarioEvidence;
}) {
  return {
    runId,
    scenarioId: scenario.id,
    position,
    conversationRef: evidence.conversationRef,
    durationMs: evidence.durationMs,
    error: evidence.error ?? null,
    category: scenario.category,
    categoryTitle: scenario.categoryTitle,
    title: scenario.title,
    dimension: scenario.dimension,
    customerTurns: json(scenario.customerTurns),
    expected: json(scenario.expected),
    failureMarkers: scenario.failureMarkers,
    watch: scenario.watch ?? null,
    severityFloor: scenario.severityFloor,
    scenarioJson: json(scenario),
  };
}

function turnData({
  runId,
  scenarioId,
  turn,
}: {
  runId: bigint;
  scenarioId: bigint;
  turn: HellWeekTurnEvidence;
}) {
  return {
    runId,
    scenarioId,
    turnIndex: turn.turnIndex,
    userMessage: turn.userMessage,
    botMessage: turn.botMessage,
    finalAction: turn.finalAction,
    proposedAction: turn.proposedAction,
    selectedServingMode: turn.selectedServingMode,
    effectiveServingMode: turn.effectiveServingMode,
    routeForScoring: turn.routeForScoring,
    selectedRouteReason: turn.selectedRouteReason,
    safetyFlags: json(turn.safetyFlags),
    validatorOverrideCodes: json(turn.validatorOverrideCodes),
    retrieved: json(turn.retrieved),
    uiPrimitive: turn.uiPrimitive,
    signalStatus: turn.signalStatus ?? null,
    signalPrimaryIntent: turn.signalPrimaryIntent ?? null,
    signalRecommendedMode: turn.signalRecommendedServingMode ?? null,
    signalNegatedOrCorrected: turn.signalNegatedOrCorrected ?? null,
    signalComparisonStatus: turn.signalComparisonStatus ?? null,
    signalLatencyMs: turn.signalLatencyMs ?? null,
    turnJson: json(turn),
  };
}

function gradeData({
  runId,
  scenarioId,
  grade,
}: {
  runId: bigint;
  scenarioId: bigint;
  grade: HellWeekGrade;
}) {
  return {
    runId,
    scenarioId,
    scenarioKey: grade.scenarioId,
    pass: grade.pass,
    severity: grade.severity,
    graderSource: grade.graderSource,
    hardFloorTriggered: grade.hardFloorTriggered,
    uxScore: grade.uxScore ?? null,
    rationale: grade.rationale,
    triageLabels: json(grade.triageLabels),
    deterministic: json(grade.deterministic),
    judge: nullableJson(grade.judge),
    gradeJson: json(grade),
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return cloneJson(value) as Prisma.InputJsonValue;
}

function nullableJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull | typeof Prisma.JsonNull {
  if (value === undefined) {
    return Prisma.DbNull;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return json(value);
}

function castJson<T>(value: unknown): T {
  return value as T;
}

function optionalJson<T>(value: unknown): T | undefined {
  if (value === null || value === undefined || value === Prisma.DbNull) {
    return undefined;
  }

  return castJson<T>(value);
}

function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function isNeonDatabaseUrl(databaseUrl: string): boolean {
  try {
    return new URL(databaseUrl).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}
