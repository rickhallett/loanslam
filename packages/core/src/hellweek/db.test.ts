import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  HellWeekGrade,
  HellWeekReport,
  HellWeekScenario,
  HellWeekScenarioEvidence,
} from "./types";

const fake = vi.hoisted(() => {
  class JsonNullMarker {}
  class DbNullMarker {}

  return {
    clients: [] as FakePrismaClient[],
    JsonNull: new JsonNullMarker(),
    DbNull: new DbNullMarker(),
  };
});

vi.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: class PrismaNeon {
    constructor(_input: unknown) {}
  },
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class PrismaPg {
    constructor(_input: unknown) {}
  },
}));

vi.mock("../generated/prisma/client", () => ({
  Prisma: {
    JsonNull: fake.JsonNull,
    DbNull: fake.DbNull,
  },
  PrismaClient: class PrismaClient extends FakePrismaClient {
    constructor(_input: unknown) {
      super();
      fake.clients.push(this);
    }
  },
}));

describe("Hell Week report DB persistence", () => {
  beforeEach(() => {
    fake.clients.length = 0;
    childRows.length = 0;
    turnRows.length = 0;
    gradeRows.length = 0;
  });

  it("round-trips report-level judge metadata through save/load", async () => {
    const { openHellWeekReportStore } = await import("./db");
    const store = openHellWeekReportStore("postgresql://example/test");
    const report = reportFixture({
      runId: "judged-run",
      judged: true,
      judge: {
        generatedAt: "2026-06-20T17:30:00.000Z",
        provider: "openai",
        model: "gpt-5.5",
        tool: "hellweek-judge",
        promptVersion: "judge-v1",
        sourceRunId: "source-run",
        sourceRunPath: "reports/source-run",
        scenarioCount: 1,
        verdictCount: 1,
        artifactSchemaVersion: 1,
      },
    });

    await store.saveReport(report);
    const loaded = await store.loadReport("judged-run");

    expect(loaded?.judge).toEqual(report.judge);
    expect(loaded?.judged).toBe(true);
    expect(loaded?.grades[0]?.judge).toEqual(report.grades[0]?.judge);
    expect(fake.clients[0]?.hellWeekRun.rows.get("judged-run")?.judge).toEqual(
      report.judge,
    );
  });

  it("loads old deterministic reports without judge metadata", async () => {
    const { openHellWeekReportStore } = await import("./db");
    const store = openHellWeekReportStore("postgresql://example/test");
    const report = reportFixture({ runId: "deterministic-run" });

    await store.saveReport(report);
    const row = fake.clients[0]?.hellWeekRun.rows.get("deterministic-run");

    if (!row) {
      throw new Error("Expected fake run row to exist.");
    }

    row.judge = null;
    const loaded = await store.loadReport("deterministic-run");

    expect(loaded?.judge).toBeUndefined();
    expect(loaded?.judged).toBe(false);
    expect(loaded?.grades[0]?.graderSource).toBe("deterministic");
  });
});

type Row = Record<string, unknown>;

class FakePrismaClient {
  readonly hellWeekRun = new FakeHellWeekRunTable();
  readonly hellWeekScenario = new FakeChildTable();
  readonly hellWeekTurn = new FakeChildTable();
  readonly hellWeekGrade = new FakeChildTable();
  readonly hellWeekRunSet = new FakeChildTable();
  readonly hellWeekRunSetMember = new FakeChildTable();
  readonly hellWeekRunSetScenario = new FakeChildTable();
  readonly hellWeekRunSetPairwiseComparison = new FakeChildTable();

  async $transaction<T>(callback: (tx: this) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async $disconnect(): Promise<void> {}
}

class FakeHellWeekRunTable {
  readonly rows = new Map<string, Row & { id: bigint; runId: string }>();
  private nextId = 1n;

  async upsert({
    where,
    create,
    update,
  }: {
    where: { runId: string };
    create: Row;
    update: Row;
  }): Promise<Row & { id: bigint; runId: string }> {
    const current = this.rows.get(where.runId);

    if (current) {
      Object.assign(current, update);
      return current;
    }

    const row = { ...create, id: this.nextId++, runId: where.runId };
    this.rows.set(where.runId, row);
    return row;
  }

  async findUnique({
    where,
  }: {
    where: { runId: string };
  }): Promise<
    (Row & { id: bigint; runId: string; scenarios: ScenarioRow[] }) | null
  > {
    const row = this.rows.get(where.runId);

    if (!row) {
      return null;
    }

    const scenarios = childRows
      .filter((scenario) => scenario.runId === row.id)
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((scenario) => ({
        ...scenario,
        turns: turnRows
          .filter((turn) => turn.scenarioId === scenario.id)
          .sort((a, b) => Number(a.turnIndex) - Number(b.turnIndex)),
        grades: gradeRows.filter((grade) => grade.scenarioId === scenario.id),
      }));

    return { ...row, scenarios };
  }

  async findMany(): Promise<Row[]> {
    return [...this.rows.values()];
  }
}

const childRows: ScenarioRow[] = [];
const turnRows: Row[] = [];
const gradeRows: Row[] = [];

class FakeChildTable {
  private nextId = 1n;

  async deleteMany({ where }: { where: { runId?: bigint } }): Promise<void> {
    deleteRows(this.rows(), where);
  }

  async create({ data }: { data: Row }): Promise<Row & { id: bigint }> {
    const row = { ...data, id: this.nextId++ };
    this.rows().push(row);
    return row;
  }

  async createMany({ data }: { data: Row[] }): Promise<void> {
    for (const item of data) {
      await this.create({ data: item });
    }
  }

  async upsert({ create }: { create: Row }): Promise<Row> {
    return this.create({ data: create });
  }

  async findUnique(): Promise<null> {
    return null;
  }

  private rows(): Row[] {
    if (this === fake.clients[0]?.hellWeekScenario) {
      return childRows;
    }
    if (this === fake.clients[0]?.hellWeekTurn) {
      return turnRows;
    }
    if (this === fake.clients[0]?.hellWeekGrade) {
      return gradeRows;
    }
    return [];
  }
}

interface ScenarioRow extends Row {
  id: bigint;
  runId: bigint;
  scenarioId: string;
  position: number;
  turns?: Row[];
  grades?: Row[];
}

function deleteRows(rows: Row[], where: { runId?: bigint }) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (where.runId === undefined || rows[index]?.runId === where.runId) {
      rows.splice(index, 1);
    }
  }
}

function reportFixture({
  runId,
  judged = false,
  judge,
}: {
  runId: string;
  judged?: boolean;
  judge?: HellWeekReport["judge"];
}): HellWeekReport {
  const scenario = scenarioFixture("smoke-1");
  const grade = gradeFixture(scenario, judged);
  const evidence = evidenceFixture(scenario.id);

  return {
    runId,
    generatedAt: "2026-06-20T17:00:00.000Z",
    profile: "smoke",
    planner: {
      provider: "inline",
      model: "test-planner",
      promptVersion: "test-prompt",
    },
    signalExtractor: { enabled: false },
    policyVersion: "test-policy",
    judged,
    ...(judge ? { judge } : {}),
    durationMs: 100,
    verdict: "ship_ready",
    headline: "All smoke scenarios passed.",
    totals: {
      scenarios: 1,
      passed: 1,
      failed: 0,
      passRate: 1,
      demoKillers: 0,
      dents: 0,
      fine: 1,
      errored: 0,
    },
    safetyFloor: {
      pass: 0,
      total: 0,
      breached: false,
      dimensions: [],
      demoKillers: [],
    },
    deflection: {
      answered: 0,
      total: 0,
      rate: 0,
      leaked: [],
    },
    routingPrecision: {
      inScopeScenarios: 1,
      misroutes: 0,
      rate: 1,
      signalTurns: 0,
      signalAgreements: 0,
      signalAgreementRate: 0,
    },
    uxQuality: {
      scored: judged ? 1 : 0,
      averageScore: judged ? 5 : null,
    },
    categories: [],
    dimensions: [],
    severityCounts: {
      demo_killer: 0,
      dent: 0,
      fine: 1,
    },
    triageCounts: [],
    topRisks: [],
    grades: [grade],
    evidence: [evidence],
    scenarios: [scenario],
  };
}

function scenarioFixture(id: string): HellWeekScenario {
  return {
    id,
    category: "smoke",
    categoryTitle: "Smoke",
    title: "Smoke scenario",
    dimension: "clarification",
    customerTurns: ["Hello"],
    expected: {},
    failureMarkers: "Should not fail.",
    severityFloor: "dent",
  };
}

function gradeFixture(
  scenario: HellWeekScenario,
  judged: boolean,
): HellWeekGrade {
  return {
    scenarioId: scenario.id,
    category: scenario.category,
    categoryTitle: scenario.categoryTitle,
    title: scenario.title,
    dimension: scenario.dimension,
    deterministic: {
      envelopeFailures: [],
      contentViolations: [],
      hardSafetyViolations: [],
      triageLabels: [],
      severity: "fine",
      pass: true,
    },
    ...(judged
      ? {
          judge: {
            scenarioId: scenario.id,
            pass: true,
            severity: "fine",
            triageLabels: [],
            uxScore: 5,
            rationale: "Good answer.",
            confidence: 0.9,
          },
          uxScore: 5,
        }
      : {}),
    pass: true,
    severity: "fine",
    triageLabels: [],
    rationale: "Passed.",
    hardFloorTriggered: false,
    graderSource: judged ? "judge" : "deterministic",
  };
}

function evidenceFixture(scenarioId: string): HellWeekScenarioEvidence {
  return {
    scenarioId,
    conversationRef: `hellweek-${scenarioId}`,
    turns: [],
    durationMs: 100,
  };
}
