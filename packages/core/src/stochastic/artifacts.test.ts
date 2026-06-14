import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  StochasticRunArtifact,
  StochasticScenario,
  StochasticTraceRow,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import {
  buildStochasticArtifactPaths,
  fingerprintCorpus,
  writeStochasticArtifacts,
} from "./artifacts";

describe("STS artifacts", () => {
  it("builds default artifact paths and lets summary output override only markdown", () => {
    expect(buildStochasticArtifactPaths({ seed: "demo" })).toEqual({
      runJson: "artifacts/phase0/stochastic-run-demo.json",
      scenariosJsonl: "artifacts/phase0/stochastic-scenarios-demo.jsonl",
      tracesJsonl: "artifacts/phase0/stochastic-traces-demo.jsonl",
      summaryMarkdown: "artifacts/phase0/stochastic-summary-demo.md",
      dashboardHtml: "artifacts/phase0/stochastic-dashboard-demo.html",
    });

    const paths = buildStochasticArtifactPaths({
      outputDir: "tmp/sts",
      seed: "demo",
      summaryOutput: "tmp/summary.md",
    });

    expect(paths).toEqual({
      runJson: "tmp/sts/stochastic-run-demo.json",
      scenariosJsonl: "tmp/sts/stochastic-scenarios-demo.jsonl",
      tracesJsonl: "tmp/sts/stochastic-traces-demo.jsonl",
      summaryMarkdown: "tmp/summary.md",
      dashboardHtml: "tmp/sts/stochastic-dashboard-demo.html",
    });
  });

  it("rejects seeds that are unsafe for artifact filenames", () => {
    expect(() =>
      buildStochasticArtifactPaths({ seed: "../demo seed" }),
    ).toThrow("filename-safe");
  });

  it("writes schema-valid newline-terminated artifacts and overwrites stale content", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts-artifacts-"));
    const summaryOutput = join(outputDir, "custom-summary.md");
    const paths = buildStochasticArtifactPaths({
      outputDir,
      seed: "demo",
      summaryOutput,
    });

    for (const path of Object.values(paths)) {
      writeFileSync(path, "stale content that must disappear", "utf8");
    }

    writeStochasticArtifacts({
      paths,
      run: runArtifact(paths),
      scenarios: [scenario("smoke/001/faq/cooperative/single-turn")],
      traces: [
        trace("smoke/001/faq/cooperative/single-turn", 0),
        trace("smoke/001/faq/cooperative/single-turn", 1),
      ],
      summaryMarkdown: "# Summary",
      dashboardHtml: "<!doctype html><title>Summary</title>",
    });

    expect(readFileSync(paths.runJson, "utf8")).toMatch(/\n$/);
    expect(readFileSync(paths.runJson, "utf8")).not.toContain("stale");
    expect(JSON.parse(readFileSync(paths.runJson, "utf8"))).toMatchObject({
      seed: "demo",
      scenarioCount: 1,
    });

    const scenarioJsonl = readFileSync(paths.scenariosJsonl, "utf8");
    expect(scenarioJsonl).toMatch(/\n$/);
    expect(scenarioJsonl.trim().split("\n")).toHaveLength(1);

    const traceJsonl = readFileSync(paths.tracesJsonl, "utf8");
    expect(traceJsonl).toMatch(/\n$/);
    expect(traceJsonl.trim().split("\n")).toHaveLength(2);

    expect(readFileSync(paths.summaryMarkdown, "utf8")).toBe("# Summary\n");
    expect(readFileSync(paths.dashboardHtml, "utf8")).toContain(
      "<!doctype html>",
    );
  });

  it("rejects run artifacts that do not match the paths being written", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts-mismatch-"));
    const paths = buildStochasticArtifactPaths({ outputDir, seed: "demo" });
    const run = runArtifact(paths);

    expect(() =>
      writeStochasticArtifacts({
        paths,
        run: {
          ...run,
          artifacts: {
            ...run.artifacts,
            runJson: join(outputDir, "other-run.json"),
          },
        },
        scenarios: [scenario("smoke/001/faq/cooperative/single-turn")],
        traces: [trace("smoke/001/faq/cooperative/single-turn", 0)],
        summaryMarkdown: "# Summary\n",
        dashboardHtml: "<!doctype html>",
      }),
    ).toThrow("run.artifacts.runJson");
  });

  it("writes empty JSONL files without blank rows", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts-empty-jsonl-"));
    const paths = buildStochasticArtifactPaths({ outputDir, seed: "demo" });

    writeStochasticArtifacts({
      paths,
      run: runArtifact(paths),
      scenarios: [scenario("smoke/001/faq/cooperative/single-turn")],
      traces: [],
      summaryMarkdown: "# Summary\n",
      dashboardHtml: "<!doctype html>",
    });

    expect(readFileSync(paths.tracesJsonl, "utf8")).toBe("");
  });

  it("validates run, scenario, and trace rows before writing", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts-invalid-"));
    const paths = buildStochasticArtifactPaths({ outputDir, seed: "demo" });

    expect(() =>
      writeStochasticArtifacts({
        paths,
        run: runArtifact(paths),
        scenarios: [scenario("smoke/001/faq/cooperative/single-turn")],
        traces: [
          {
            ...trace("smoke/001/faq/cooperative/single-turn", 0),
            traceId: "",
          },
        ],
        summaryMarkdown: "Summary",
        dashboardHtml: "<!doctype html>",
      }),
    ).toThrow();
  });

  it("fingerprints corpus with stable object key ordering and id sorting", () => {
    const first = fingerprintCorpus([
      {
        id: "b",
        question: "Can I apply?",
        serving_mode: "answer",
        answer_text: "Yes.",
        links: [{ label: "Apply", url: "https://loanslam.example/apply" }],
        tags: ["apply", "online"],
      },
      {
        tags: ["status"],
        route_reason: "Status is account-specific.",
        serving_mode: "handoff_account_specific",
        question: "What is my status?",
        id: "a",
      },
    ]);
    const second = fingerprintCorpus([
      {
        id: "a",
        question: "What is my status?",
        serving_mode: "handoff_account_specific",
        route_reason: "Status is account-specific.",
        tags: ["status"],
      },
      {
        tags: ["apply", "online"],
        links: [{ url: "https://loanslam.example/apply", label: "Apply" }],
        answer_text: "Yes.",
        serving_mode: "answer",
        question: "Can I apply?",
        id: "b",
      },
    ]);

    expect(first).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first).toBe(second);
  });
});

function scenario(scenarioPath: string): StochasticScenario {
  return {
    scenarioPath,
    persona: {
      id: "cooperative-001",
      label: "Cooperative",
      traits: ["cooperative"],
      styleNotes: "Cooperative style.",
    },
    objective: "Answer a grounded FAQ.",
    customerTurns: ["Can I apply?"],
    axisValues: {
      intent: "faq",
      personaStyle: "cooperative",
      journeyShape: "single_turn",
      languageNoise: "clean",
      riskMarker: "none",
    },
    expectation: {
      allowedFinalActions: ["answer"],
      requiredServingModes: ["answer"],
      forbiddenServingModes: [],
      requiredSafetyFlags: [],
      forbiddenBehaviors: [],
    },
    generatorTemplateId: "grounded-faq",
    seed: "scenario-seed",
  };
}

function trace(scenarioPath: string, turnIndex: number): StochasticTraceRow {
  return {
    scenarioPath,
    turnIndex,
    userMessage: "Can I apply?",
    customerMessage: "You can apply online.",
    proposedAction: "answer",
    finalAction: "answer",
    selectedServingMode: "answer",
    safetyFlags: [],
    validatorOverrides: [],
    validatorOverrideCodes: [],
    retrievedItemIds: ["apply-online"],
    traceId: `trace-${turnIndex}`,
    requestRef: `request-${turnIndex}`,
  };
}

function runArtifact(
  artifacts: StochasticRunArtifact["artifacts"],
): StochasticRunArtifact {
  return {
    seed: "demo",
    profile: "smoke",
    stsVersion: "sts-v1",
    templateSetVersion: "sts-templates-v1",
    policyVersion: "phase0-turnplanner-policy-v1",
    corpusFingerprint: "sha256:test",
    generatedAt: "2026-06-14T12:00:00.000Z",
    planner: {
      provider: "inline",
      model: "test",
      promptVersion: "test",
    },
    scenarioCount: 1,
    artifacts,
    verdict: "useful_with_findings",
    verdictReasons: ["Coverage gaps remain."],
    hardFailures: [],
    findings: [],
    coverage: {
      axisCoverage: {},
      coverageGaps: ["Missing axis intent value complaint."],
      highRiskIntentSpread: [],
      hardFailureTemplateCoverage: [],
    },
    replay: {
      fullRunCommand: "just core-stochastic -- --seed demo --profile smoke",
      topFindingCommands: [],
      hardFailureCommands: [],
    },
  };
}
