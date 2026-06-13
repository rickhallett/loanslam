import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
    expect(io.output).toEqual(["Loanslam Phase 0 chat. Type /exit to leave."]);
    expect(result.stdout).toBe("");
  });

  it("documents the dev API server command without requiring planner credentials", async () => {
    const result = await runCli(["serve", "--help"], {});

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("serve");
    expect(result.stdout).toContain("POST /sessions");
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
