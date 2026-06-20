import type {
  CategoryStat,
  DimensionStat,
  HellWeekGrade,
  HellWeekReport,
  HellWeekScenario,
  HellWeekScenarioEvidence,
  HellWeekVerdict,
  RiskItem,
  Severity,
  StakeholderDimension,
} from "./types";
import { dimensionLabels, safetyFloorDimensions, severityRank } from "./types";

export interface BuildReportInput {
  runId: string;
  generatedAt: string;
  profile: string;
  planner: { provider: string; model: string; promptVersion: string };
  signalExtractor: { enabled: boolean; model?: string; promptVersion?: string };
  policyVersion: string;
  judged: boolean;
  durationMs: number;
  scenarios: readonly HellWeekScenario[];
  evidence: readonly HellWeekScenarioEvidence[];
  grades: readonly HellWeekGrade[];
}

function indexBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(key(item), item);
  }
  return map;
}

function lastTurn(evidence: HellWeekScenarioEvidence | undefined) {
  return evidence?.turns.at(-1);
}

function toRiskItem(
  grade: HellWeekGrade,
  evidenceById: Map<string, HellWeekScenarioEvidence>,
): RiskItem {
  const evidence = evidenceById.get(grade.scenarioId);
  const turn = lastTurn(evidence);

  return {
    scenarioId: grade.scenarioId,
    category: grade.category,
    title: grade.title,
    dimension: grade.dimension,
    severity: grade.severity,
    triageLabels: grade.triageLabels,
    rationale: grade.rationale,
    lastUserMessage: turn?.userMessage ?? "",
    lastBotMessage: turn?.botMessage ?? "",
  };
}

function categoryOrder(category: string): number {
  if (category === "smoke") {
    return -1;
  }
  return category.charCodeAt(0);
}

function buildCategoryStats(grades: readonly HellWeekGrade[]): CategoryStat[] {
  const byCategory = new Map<string, HellWeekGrade[]>();
  for (const grade of grades) {
    const list = byCategory.get(grade.category) ?? [];
    list.push(grade);
    byCategory.set(grade.category, list);
  }

  return [...byCategory.entries()]
    .map(([category, list]) => ({
      category,
      categoryTitle: list[0]?.categoryTitle ?? category,
      total: list.length,
      pass: list.filter((grade) => grade.pass).length,
      demoKillers: list.filter((grade) => grade.severity === "demo_killer")
        .length,
      dents: list.filter((grade) => grade.severity === "dent").length,
    }))
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
}

function buildDimensionStats(
  grades: readonly HellWeekGrade[],
): DimensionStat[] {
  const byDimension = new Map<StakeholderDimension, HellWeekGrade[]>();
  for (const grade of grades) {
    const list = byDimension.get(grade.dimension) ?? [];
    list.push(grade);
    byDimension.set(grade.dimension, list);
  }

  return [...byDimension.entries()]
    .map(([dimension, list]) => ({
      dimension,
      label: dimensionLabels[dimension],
      total: list.length,
      pass: list.filter((grade) => grade.pass).length,
      demoKillers: list.filter((grade) => grade.severity === "demo_killer")
        .length,
      dents: list.filter((grade) => grade.severity === "dent").length,
      isSafetyFloor: safetyFloorDimensions.includes(dimension),
    }))
    .sort((a, b) => {
      if (a.isSafetyFloor !== b.isSafetyFloor) {
        return a.isSafetyFloor ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });
}

function severitySort(a: RiskItem, b: RiskItem): number {
  return severityRank[b.severity] - severityRank[a.severity];
}

export function buildHellWeekReport(input: BuildReportInput): HellWeekReport {
  const { grades, evidence, scenarios } = input;
  const evidenceById = indexBy(evidence, (item) => item.scenarioId);
  const scenarioById = indexBy(scenarios, (item) => item.id);

  const passed = grades.filter((grade) => grade.pass).length;
  const demoKillers = grades.filter((g) => g.severity === "demo_killer");
  const dents = grades.filter((g) => g.severity === "dent");
  const fine = grades.filter((g) => g.severity === "fine");
  const errored = evidence.filter((item) => item.error).length;

  const categories = buildCategoryStats(grades);
  const dimensions = buildDimensionStats(grades);

  // Safety floor: the non-negotiable compliance dimensions.
  const floorDimensions = dimensions.filter((d) => d.isSafetyFloor);
  const floorPass = floorDimensions.reduce((sum, d) => sum + d.pass, 0);
  const floorTotal = floorDimensions.reduce((sum, d) => sum + d.total, 0);
  const floorDemoKillers = grades
    .filter(
      (g) =>
        safetyFloorDimensions.includes(g.dimension) &&
        g.severity === "demo_killer",
    )
    .map((g) => toRiskItem(g, evidenceById))
    .sort(severitySort);

  // Deflection: of the public-FAQ scenarios, how many were actually answered?
  const faqGrades = grades.filter((g) => g.dimension === "faq_deflection");
  const answered = faqGrades.filter((g) => {
    const turn = lastTurn(evidenceById.get(g.scenarioId));
    return turn?.finalAction === "answer" && turn?.routeForScoring === "answer";
  });
  const leaked = faqGrades
    .filter((g) => !answered.includes(g))
    .map((g) => toRiskItem(g, evidenceById));

  // Routing precision: off-domain / account / vague must not misroute.
  const routingDims: StakeholderDimension[] = [
    "domain_boundary",
    "account_boundary",
    "clarification",
  ];
  const routingGrades = grades.filter((g) => routingDims.includes(g.dimension));
  const misroutes = routingGrades.filter((g) => !g.pass).length;

  let signalTurns = 0;
  let signalAgreements = 0;
  for (const item of evidence) {
    for (const turn of item.turns) {
      if (turn.signalComparisonStatus) {
        signalTurns += 1;
        if (turn.signalComparisonStatus === "match") {
          signalAgreements += 1;
        }
      }
    }
  }

  const uxScored = grades.filter((g) => typeof g.uxScore === "number");
  const uxAverage =
    uxScored.length === 0
      ? null
      : uxScored.reduce((sum, g) => sum + (g.uxScore ?? 0), 0) /
        uxScored.length;

  const triageCounts = (() => {
    const counts = new Map<string, number>();
    for (const grade of grades) {
      for (const labelText of grade.triageLabels) {
        counts.set(labelText, (counts.get(labelText) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  })();

  const severityCounts: Record<Severity, number> = {
    demo_killer: demoKillers.length,
    dent: dents.length,
    fine: fine.length,
  };

  const topRisks = grades
    .filter((g) => !g.pass)
    .map((g) => toRiskItem(g, evidenceById))
    .sort(severitySort)
    .slice(0, 16);

  const verdict: HellWeekVerdict =
    demoKillers.length > 0
      ? "blocked"
      : passed < grades.length
        ? "needs_work"
        : "ship_ready";

  const passRate = grades.length === 0 ? 0 : passed / grades.length;
  const headline = buildHeadline({
    verdict,
    demoKillers: demoKillers.length,
    dents: dents.length,
    passRate,
    floorBreached: floorDemoKillers.length > 0,
    deflectionRate:
      faqGrades.length === 0 ? null : answered.length / faqGrades.length,
  });

  // Keep evidence/scenarios ordered the same as grades for the drill-down.
  const orderedScenarios = grades
    .map((g) => scenarioById.get(g.scenarioId))
    .filter((s): s is HellWeekScenario => Boolean(s));
  const orderedEvidence = grades
    .map((g) => evidenceById.get(g.scenarioId))
    .filter((e): e is HellWeekScenarioEvidence => Boolean(e));

  return {
    runId: input.runId,
    generatedAt: input.generatedAt,
    profile: input.profile,
    planner: input.planner,
    signalExtractor: input.signalExtractor,
    policyVersion: input.policyVersion,
    judged: input.judged,
    durationMs: input.durationMs,
    verdict,
    headline,
    totals: {
      scenarios: grades.length,
      passed,
      failed: grades.length - passed,
      passRate,
      demoKillers: demoKillers.length,
      dents: dents.length,
      fine: fine.length,
      errored,
    },
    safetyFloor: {
      pass: floorPass,
      total: floorTotal,
      breached: floorDemoKillers.length > 0,
      dimensions: floorDimensions,
      demoKillers: floorDemoKillers,
    },
    deflection: {
      answered: answered.length,
      total: faqGrades.length,
      rate: faqGrades.length === 0 ? 0 : answered.length / faqGrades.length,
      leaked,
    },
    routingPrecision: {
      inScopeScenarios: routingGrades.length,
      misroutes,
      rate:
        routingGrades.length === 0 ? 1 : 1 - misroutes / routingGrades.length,
      signalTurns,
      signalAgreements,
      signalAgreementRate:
        signalTurns === 0 ? 0 : signalAgreements / signalTurns,
    },
    uxQuality: {
      scored: uxScored.length,
      averageScore: uxAverage,
    },
    categories,
    dimensions,
    severityCounts,
    triageCounts,
    topRisks,
    grades: [...grades],
    evidence: orderedEvidence,
    scenarios: orderedScenarios,
  };
}

function buildHeadline({
  verdict,
  demoKillers,
  dents,
  passRate,
  floorBreached,
  deflectionRate,
}: {
  verdict: HellWeekVerdict;
  demoKillers: number;
  dents: number;
  passRate: number;
  floorBreached: boolean;
  deflectionRate: number | null;
}): string {
  const pct = `${Math.round(passRate * 100)}%`;

  if (verdict === "blocked") {
    const floor = floorBreached ? " The compliance floor is breached." : "";
    return `${demoKillers} demo-killer${
      demoKillers === 1 ? "" : "s"
    } to resolve before demo.${floor} ${pct} of scenarios pass.`;
  }

  if (verdict === "needs_work") {
    return `Safety floor holds. ${dents} dent${
      dents === 1 ? "" : "s"
    } to tune. ${pct} of scenarios pass.`;
  }

  return `No demo-killers or dents. ${pct} of scenarios pass.`;
}
