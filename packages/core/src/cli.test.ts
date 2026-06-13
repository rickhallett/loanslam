import { describe, expect, it } from "vitest";

import type {
  PlannerMetadata,
  TurnPlan,
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
});
