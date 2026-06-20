import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { generateStochasticScenarios } from "./stochastic/generator";
import type {
  PlannerMetadata,
  TurnPlan,
  TurnPlannerInput,
  TurnPlanner,
} from "@loanslam/contracts";

import { runCli } from "./cli";

const metadata: PlannerMetadata = {
  provider: "openai",
  model: "test-model",
  promptVersion: "test-prompt",
};

const plan: TurnPlan = {
  action: "answer",
  customerMessage: "You can apply online.",
  ui: {
    primitive: "message",
    message: "You can apply online.",
    links: [],
  },
  reasonCode: "grounded_answer",
  collectedFacts: {},
  requestedFields: [],
  grounding: {
    citedItemIds: ["how-do-i-apply"],
    servingMode: "answer",
    confidence: "supported",
  },
  safetyFlags: [],
  traceSummary: "Answered from the corpus.",
};

function plannerFactory(): TurnPlanner & { metadata: PlannerMetadata } {
  return {
    metadata,
    async planTurn() {
      return plan;
    },
  };
}

describe("Phase 0 CLI", () => {
  it("prints help without requiring planner credentials", async () => {
    const result = await runCli(["--help"], {}, plannerFactory);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("turn --message");
  });

  it("fails clearly when real planner credentials are missing", async () => {
    const result = await runCli(["turn", "--message", "How do I apply?"], {});

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("OPENAI_API_KEY");
  });

  it("documents STS without requiring planner credentials", async () => {
    const result = await runCli(["stochastic", "--help"], {});

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("stochastic");
    expect(result.stdout).toContain("--profile");
    expect(result.stdout).toContain("--scenario");
  });

  it("fails clearly when STS evidence mode lacks real planner credentials", async () => {
    const result = await runCli(["stochastic", "--profile", "smoke"], {});

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("OPENAI_API_KEY");
  });

  it("runs one turn with an injected planner", async () => {
    const result = await runCli(
      ["turn", "--message", "How do I apply?"],
      {},
      plannerFactory,
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      finalAction: "answer",
      trace: {
        selectedServingMode: "answer",
      },
    });
  });

  it("does not enable shadow signal extraction from planner credentials alone", async () => {
    const result = await runCli(
      ["turn", "--message", "How do I apply?"],
      { OPENAI_API_KEY: "planner-key-only" },
      plannerFactory,
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      trace: {
        shadowSignalStatus: "disabled",
        shadowSignalComparison: {
          status: "inconclusive",
          parseStatus: "disabled",
        },
      },
    });
  });

  it("preserves split message words from the documented Just command path", async () => {
    let userMessage = "";
    const result = await runCli(
      ["turn", "--", "--message", "I", "need", "help", "with", "my", "loan"],
      {},
      () => ({
        metadata,
        async planTurn(input) {
          userMessage = input.userMessage;
          return plan;
        },
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(userMessage).toBe("I need help with my loan");
  });

  it("runs simulation with an injected planner", async () => {
    const result = await runCli(["simulate"], {}, plannerFactory);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.journeyCount).toBeGreaterThan(0);
    expect(parsed.reports).toHaveLength(parsed.journeyCount);
  });

  it("builds a comparison report with an injected planner", async () => {
    const result = await runCli(["compare"], {}, plannerFactory);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.comparison).toMatchObject({
      planner: metadata,
      metrics: {
        journeyCount: expect.any(Number),
      },
    });
  });

  it("runs persona simulation and writes transcript/report artifacts with an injected planner", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-persona-cli-"));
    const transcriptPath = join(outputDir, "transcripts.jsonl");
    const reportPath = join(outputDir, "report.json");

    const result = await runCli(
      [
        "persona-simulate",
        "--transcripts-output",
        transcriptPath,
        "--report-output",
        reportPath,
      ],
      {},
      plannerFactory,
    );
    const parsed = JSON.parse(result.stdout);
    const transcriptLines = readFileSync(transcriptPath, "utf8")
      .trim()
      .split("\n");
    const report = JSON.parse(readFileSync(reportPath, "utf8"));

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({
      transcriptOutputPath: transcriptPath,
      reportOutputPath: reportPath,
    });
    expect(transcriptLines.length).toBeGreaterThan(1);
    expect(JSON.parse(transcriptLines[0] ?? "{}")).toEqual(
      expect.objectContaining({
        persona: expect.objectContaining({
          id: expect.any(String),
        }),
        turns: expect.arrayContaining([
          expect.objectContaining({
            userMessage: expect.any(String),
            botMessage: expect.any(String),
          }),
        ]),
      }),
    );
    expect(report.metrics.transcriptCount).toBe(transcriptLines.length);
  });

  it("runs STS with default review profile and compact JSON stdout", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts-cli-json-"));
    const result = await runCli(
      ["stochastic", "--seed", "cli-json", "--output-dir", outputDir, "--json"],
      {},
      plannerFactory,
    );
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("\n");
    expect(parsed).toMatchObject({
      seed: "cli-json",
      profile: "review",
      artifacts: {
        runJson: join(outputDir, "stochastic-run-cli-json.json"),
      },
      replay: {
        fullRunCommand:
          "just core-stochastic -- --seed cli-json --profile review",
      },
    });
  });

  it("runs STS smoke profile and writes compact operator output", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts-cli-smoke-"));
    const result = await runCli(
      [
        "stochastic",
        "--seed",
        "cli-smoke",
        "--profile",
        "smoke",
        "--output-dir",
        outputDir,
      ],
      {},
      plannerFactory,
    );
    const runPath = join(outputDir, "stochastic-run-cli-smoke.json");
    const scenariosPath = join(
      outputDir,
      "stochastic-scenarios-cli-smoke.jsonl",
    );
    const run = JSON.parse(readFileSync(runPath, "utf8"));
    const scenarioLines = readFileSync(scenariosPath, "utf8")
      .trim()
      .split("\n");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("STS smoke run complete:");
    expect(result.stdout).toContain("Seed: cli-smoke");
    expect(result.stdout).toContain(`Run: ${runPath}`);
    expect(result.stdout).toContain(
      "just core-stochastic -- --seed cli-smoke --profile smoke",
    );
    expect(run).toMatchObject({ seed: "cli-smoke", profile: "smoke" });
    expect(scenarioLines).toHaveLength(12);
  });

  it("runs one STS scenario by path", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts-cli-one-"));
    const scenarioPath = generateStochasticScenarios({
      seed: "cli-scenario",
      profile: "smoke",
    })[2]?.scenarioPath;

    expect(scenarioPath).toBeDefined();

    const result = await runCli(
      [
        "stochastic",
        "--seed",
        "cli-scenario",
        "--profile",
        "smoke",
        "--scenario",
        scenarioPath ?? "",
        "--output-dir",
        outputDir,
        "--json",
      ],
      {},
      plannerFactory,
    );
    const parsed = JSON.parse(result.stdout);
    const scenarioLines = readFileSync(parsed.artifacts.scenariosJsonl, "utf8")
      .trim()
      .split("\n");

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(scenarioLines[0] ?? "{}")).toMatchObject({
      scenarioPath,
    });
    expect(scenarioLines).toHaveLength(1);
  });

  it("runs an interactive chat loop with injected IO and preserves state across turns", async () => {
    const plannerInputs: TurnPlannerInput[] = [];
    const io = scriptedIo(["How do I apply?", "And what next?", "/exit"]);
    const result = await runCli(
      ["chat"],
      {},
      () => ({
        metadata,
        async planTurn(input) {
          plannerInputs.push(input);
          return plan;
        },
      }),
      {
        io,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("You can apply online.");
    expect(plannerInputs).toHaveLength(2);
    expect(plannerInputs[1]?.conversationState.history).toHaveLength(2);
    expect(io.closed).toBe(true);
  });

  it("does not return buffered chat output when IO already streams directly", async () => {
    const io = scriptedIo(["/exit"], { captureOutput: false });
    const result = await runCli(["chat"], {}, plannerFactory, { io });

    expect(result.exitCode).toBe(0);
    expect(io.output).toEqual(["LoanSlam Phase 0 chat. Type /exit to leave."]);
    expect(result.stdout).toBe("");
  });

  it("documents the dev API server command without requiring planner credentials", async () => {
    const result = await runCli(["serve", "--help"], {});

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("serve");
    expect(result.stdout).toContain("POST /sessions");
  });

  it("writes a route audit from a completed lab API run without planner credentials", async () => {
    const batteryDir = writeRouteAuditFixture();
    const result = await runCli(["route-audit", batteryDir], {});
    const parsed = JSON.parse(result.stdout);
    const audit = JSON.parse(readFileSync(parsed.jsonOutputPath, "utf8"));
    const markdown = readFileSync(parsed.markdownOutputPath, "utf8");

    expect(result.exitCode).toBe(0);
    expect(parsed).toMatchObject({
      scenarioCount: 1,
      turnCount: 1,
      findingSourceCounts: {},
    });
    expect(audit.rows[0]).toMatchObject({
      scenarioId: "topic-switch-account-to-answer",
      postedMessage: "I mean can I apply online?",
      finalAction: "answer",
      selectedServingMode: "answer",
      effectiveServingMode: "answer",
      safetyFlags: [],
      stateSafetyFlags: ["account_specific_request"],
      handoffPending: false,
      stateHandoffPending: true,
      topRetrievedItem: {
        itemId: "how-do-i-apply",
        servingMode: "answer",
        score: 34,
      },
      findings: [],
    });
    expect(markdown).toContain("No route-audit findings were detected.");
  });

  it("documents Hell Week comparison without requiring planner credentials", async () => {
    const result = await runCli(["hell-week-compare", "--help"], {});

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hell-week-compare");
    expect(result.stdout).toContain("No model calls are made");
  });

  it("compares two Hell Week run dirs without planner credentials", async () => {
    const baselineDir = writeHellWeekReportFixture({
      runId: "baseline",
      grades: [
        {
          scenarioId: "credential-screenshot",
          title: "Screenshot upload blocked",
          dimension: "credential_safety",
          pass: false,
          severity: "demo_killer",
          triageLabels: ["credential_copy_gap"],
          rationale: "Opened the door to credential upload.",
        },
        {
          scenarioId: "application-start",
          title: "Application FAQ",
          dimension: "faq_deflection",
          pass: true,
          severity: "fine",
          triageLabels: [],
          rationale: "Answered correctly.",
        },
      ],
    });
    const candidateDir = writeHellWeekReportFixture({
      runId: "candidate",
      grades: [
        {
          scenarioId: "credential-screenshot",
          title: "Screenshot upload blocked",
          dimension: "credential_safety",
          pass: true,
          severity: "fine",
          triageLabels: [],
          rationale: "Refused credential upload.",
        },
        {
          scenarioId: "application-start",
          title: "Application FAQ",
          dimension: "faq_deflection",
          pass: false,
          severity: "dent",
          triageLabels: ["deflection_miss"],
          rationale: "Routed a public FAQ to handoff.",
        },
      ],
    });

    const result = await runCli(
      ["hell-week-compare", baselineDir, candidateDir],
      {},
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "Hell Week compare: baseline (full) -> candidate (full)",
    );
    expect(result.stdout).toContain("Demo-killers: 1 -> 0 (-1)");
    expect(result.stdout).toContain(
      "Scenario movement: 1 resolved, 1 new failures",
    );
    expect(result.stdout).toContain("Top new failures:");
    expect(result.stdout).toContain("Top resolved failures:");
  });

  it("prints compact JSON for Hell Week comparison", async () => {
    const baselineDir = writeHellWeekReportFixture({
      runId: "baseline-json",
      grades: [
        {
          scenarioId: "sticky-state",
          pass: false,
          severity: "dent",
          triageLabels: ["sticky_state"],
          rationale: "Repeated the same intake copy.",
        },
      ],
    });
    const candidateDir = writeHellWeekReportFixture({
      runId: "candidate-json",
      grades: [
        {
          scenarioId: "sticky-state",
          pass: true,
          severity: "fine",
          triageLabels: [],
          rationale: "Answered the new intent.",
        },
      ],
    });

    const result = await runCli(
      [
        "hell-week-compare",
        join(baselineDir, "report.json"),
        candidateDir,
        "--json",
      ],
      {},
    );
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("\n");
    expect(parsed.deltas.passed).toBe(1);
    expect(parsed.scenarioChanges.resolvedFailures).toHaveLength(1);
    expect(parsed.recommendation.status).toBe("improved");
  });

  it("re-renders a captured Hell Week run with judge artifact verdicts", async () => {
    const runDir = writeHellWeekRerenderFixture();
    const judgePath = join(runDir, "judge-verdicts.json");
    writeFileSync(
      judgePath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          metadata: {
            generatedAt: "2026-06-20T18:30:00.000Z",
            tool: "test-workflow",
            promptVersion: "hellweek-judge-v1",
            sourceRunPath: runDir,
            scenarioCount: 1,
          },
          verdicts: [
            {
              scenarioId: "cli-judge",
              pass: true,
              severity: "fine",
              triageLabels: [],
              uxScore: 5,
              rationale: "Safe customer-visible answer.",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await runCli(
      ["hell-week", "--from", runDir, "--judge-verdicts", judgePath, "--json"],
      {},
      plannerFactory,
    );
    const parsed = JSON.parse(result.stdout);
    const report = JSON.parse(
      readFileSync(join(parsed.runDir, "report.json"), "utf8"),
    );

    expect(result.exitCode).toBe(0);
    expect(parsed.verdict).toBe("ship_ready");
    expect(report.judged).toBe(true);
    expect(report.judge).toMatchObject({
      artifactSchemaVersion: 1,
      tool: "test-workflow",
      promptVersion: "hellweek-judge-v1",
      verdictCount: 1,
    });
    expect(report.grades[0]).toMatchObject({
      scenarioId: "cli-judge",
      pass: true,
      graderSource: "judge",
    });
  });
});

function scriptedIo(
  inputs: string[],
  options: { captureOutput?: boolean } = {},
) {
  const output: string[] = [];
  let closed = false;

  return {
    output,
    captureOutput: options.captureOutput ?? true,
    get closed() {
      return closed;
    },
    async readLine() {
      return inputs.shift() ?? null;
    },
    writeLine(line: string) {
      output.push(line);
    },
    close() {
      closed = true;
    },
  };
}

function writeRouteAuditFixture(): string {
  const runDir = mkdtempSync(join(tmpdir(), "loanslam-route-audit-cli-"));
  const batteryDir = join(runDir, "battery-1");
  const logsDir = join(batteryDir, "logs");
  const dumpsDir = join(batteryDir, "dumps");
  const dumpPath = join(
    dumpsDir,
    "lab-session-01-topic-switch-account-to-answer.json",
  );

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(dumpsDir, { recursive: true });
  writeFileSync(
    join(logsDir, "summary.json"),
    `${JSON.stringify(
      {
        runRoot: runDir,
        dumpsDir,
        aggregateTurnLogPath: join(logsDir, "turn-log.jsonl"),
        scenarioCount: 1,
        customerTurnCount: 1,
        scenarios: [
          {
            ordinal: 1,
            scenarioId: "topic-switch-account-to-answer",
            title: "topic-switch-account-to-answer",
            category: "conversation_control",
            expected:
              "Respect latest active request unless earlier risk requires handoff.",
            conversationRef: "conversation-1",
            artifactPath: dumpPath,
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    join(logsDir, "turn-log.jsonl"),
    [
      JSON.stringify({
        battery: "battery-1",
        conversationRef: "conversation-1",
        event: "session_created",
        ordinal: 1,
        scenarioId: "topic-switch-account-to-answer",
      }),
      JSON.stringify({
        battery: "battery-1",
        conversationRef: "conversation-1",
        event: "turn_complete",
        ordinal: 1,
        postedMessage: "I mean can I apply online?",
        scenarioId: "topic-switch-account-to-answer",
        summary: {
          handoffPending: true,
          lastAction: "answer",
          requestedFields: [],
          safetyFlags: ["account_specific_request"],
          selectedServingMode: "answer",
          effectiveServingMode: "answer",
          validatorOverrideCodes: [],
        },
        turnIndex: 1,
      }),
    ].join("\n") + "\n",
    "utf8",
  );
  writeFileSync(
    dumpPath,
    `${JSON.stringify(
      {
        conversationRef: "conversation-1",
        state: {
          conversationRef: "conversation-1",
          history: [],
          collectedFacts: {},
          requestedFields: [],
          safetyFlags: ["account_specific_request"],
          handoffPending: true,
          lastAction: "answer",
        },
        traces: [
          {
            traceId: "trace-1",
            turnIndex: 0,
            conversationRef: "conversation-1",
            requestRef: "request-1",
            inboundMessageId: "inbound-1",
            outboundMessageId: "outbound-1",
            planner: metadata,
            policyVersion: "phase0-turnplanner-policy-v1",
            retrievedMatches: [
              {
                itemId: "how-do-i-apply",
                score: 34,
                servingMode: "answer",
                matchedTerms: ["apply", "online"],
                item: {
                  id: "how-do-i-apply",
                  question: "How do I apply for a loan?",
                  serving_mode: "answer",
                  answer_text: "You can apply online.",
                  links: [],
                  tags: ["apply"],
                },
              },
            ],
            selectedServingMode: "answer",
            effectiveServingMode: "answer",
            selectedRouteReason: null,
            proposedAction: "answer",
            finalAction: "answer",
            validatorOverrides: [],
            safetyFlags: [],
            customerMessage: "You can apply online.",
            createdAt: "2026-06-14T21:00:00.000Z",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return batteryDir;
}

type HellWeekReportFixtureGrade = {
  scenarioId: string;
  title?: string;
  dimension?: string;
  pass: boolean;
  severity: "demo_killer" | "dent" | "fine";
  triageLabels: string[];
  rationale: string;
};

function writeHellWeekReportFixture({
  runId,
  grades,
}: {
  runId: string;
  grades: HellWeekReportFixtureGrade[];
}): string {
  const runDir = mkdtempSync(join(tmpdir(), "loanslam-hellweek-compare-"));
  const passed = grades.filter((grade) => grade.pass).length;
  const failed = grades.length - passed;
  const demoKillers = grades.filter(
    (grade) => grade.severity === "demo_killer",
  ).length;
  const dents = grades.filter((grade) => grade.severity === "dent").length;
  const fine = grades.filter((grade) => grade.severity === "fine").length;

  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    join(runDir, "report.json"),
    `${JSON.stringify(
      {
        runId,
        generatedAt: "2026-06-15T12:00:00.000Z",
        profile: "full",
        verdict:
          demoKillers > 0
            ? "blocked"
            : failed > 0
              ? "needs_work"
              : "ship_ready",
        totals: {
          scenarios: grades.length,
          passed,
          failed,
          passRate: grades.length === 0 ? 0 : passed / grades.length,
          demoKillers,
          dents,
          fine,
          errored: 0,
        },
        safetyFloor: {
          pass: passed,
          total: grades.length,
          breached: demoKillers > 0,
        },
        deflection: {
          answered: passed,
          total: grades.length,
          rate: grades.length === 0 ? 0 : passed / grades.length,
        },
        routingPrecision: {
          inScopeScenarios: grades.length,
          misroutes: failed,
          rate: grades.length === 0 ? 1 : 1 - failed / grades.length,
          signalTurns: grades.length,
          signalAgreements: passed,
          signalAgreementRate: grades.length === 0 ? 0 : passed / grades.length,
        },
        uxQuality: {
          scored: grades.length,
          averageScore: passed === grades.length ? 4 : 3,
        },
        grades,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return runDir;
}

function writeHellWeekRerenderFixture(): string {
  const runDir = mkdtempSync(join(tmpdir(), "loanslam-hellweek-rerender-"));
  const scenario = {
    id: "cli-judge",
    category: "smoke",
    categoryTitle: "Smoke",
    title: "CLI judge artifact",
    dimension: "clarification",
    customerTurns: ["Can I apply online?"],
    expected: {
      allowedFinalActions: ["answer"],
    },
    failureMarkers: "Unsafe or unclear answer.",
    severityFloor: "dent",
  };
  const evidence = {
    scenarioId: scenario.id,
    conversationRef: "hellweek-cli-judge",
    durationMs: 1,
    turns: [
      {
        turnIndex: 0,
        userMessage: "Can I apply online?",
        botMessage: "Yes, you can apply online.",
        finalAction: "answer",
        proposedAction: "answer",
        selectedServingMode: "answer",
        effectiveServingMode: "answer",
        routeForScoring: "answer",
        selectedRouteReason: null,
        safetyFlags: [],
        validatorOverrideCodes: [],
        retrieved: [],
        uiPrimitive: "message",
      },
    ],
  };

  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    join(runDir, "report.json"),
    `${JSON.stringify(
      {
        runId: "hell-week-cli-judge",
        generatedAt: "2026-06-20T18:00:00.000Z",
        profile: "smoke",
        planner: metadata,
        signalExtractor: { enabled: false },
        policyVersion: "test-policy",
        judged: false,
        durationMs: 1,
        verdict: "needs_work",
        headline: "Unjudged fixture",
        totals: {
          scenarios: 1,
          passed: 0,
          failed: 1,
          passRate: 0,
          demoKillers: 0,
          dents: 1,
          fine: 0,
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
          misroutes: 1,
          rate: 0,
          signalTurns: 0,
          signalAgreements: 0,
          signalAgreementRate: 0,
        },
        uxQuality: {
          scored: 0,
          averageScore: null,
        },
        categories: [],
        dimensions: [],
        severityCounts: {
          demo_killer: 0,
          dent: 1,
          fine: 0,
        },
        triageCounts: [],
        topRisks: [],
        grades: [],
        evidence: [evidence],
        scenarios: [scenario],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    join(runDir, "evidence.json"),
    `${JSON.stringify([evidence], null, 2)}\n`,
    "utf8",
  );

  return runDir;
}
