import { describe, expect, it } from "vitest";

import { generateStochasticScenarios } from "./generator";
import { buildStochasticCoverageReport } from "./coverage";

describe("buildStochasticCoverageReport", () => {
  it("reports sampled coverage and review profile gaps honestly", () => {
    const scenarios = generateStochasticScenarios({
      seed: "coverage-demo",
      profile: "review",
    });
    const coverage = buildStochasticCoverageReport(scenarios);

    expect(coverage.coverageGaps).toEqual([]);
    expect(coverage.axisCoverage.intent?.coveredValues).toEqual(
      expect.arrayContaining([
        "faq",
        "account_specific",
        "vulnerability",
        "complaint",
        "excluded",
        "ambiguous",
      ]),
    );
  });

  it("names missing sampled axis values as explicit coverage gaps", () => {
    const [scenario] = generateStochasticScenarios({
      seed: "coverage-demo",
      profile: "review",
    });

    expect(scenario).toBeDefined();

    const coverage = buildStochasticCoverageReport(
      scenario === undefined ? [] : [scenario],
    );

    expect(coverage.axisCoverage.intent?.sampleCount).toBe(1);
    expect(coverage.coverageGaps).toEqual(
      expect.arrayContaining([
        "Missing axis intent value faq.",
        "Missing axis personaStyle value cooperative.",
        "Missing axis journeyShape value single_turn.",
      ]),
    );
  });

  it("uses sampled scenarios for hard-failure template coverage", () => {
    const scenario = generateStochasticScenarios({
      seed: "coverage-demo",
      profile: "review",
    }).find(
      (candidate) =>
        candidate.generatorTemplateId === "account-specific-status",
    );

    expect(scenario).toBeDefined();

    const coverage = buildStochasticCoverageReport(
      scenario === undefined ? [] : [scenario],
    );

    expect(
      coverage.hardFailureTemplateCoverage.find(
        (entry) => entry.category === "account_specific_answer",
      ),
    ).toEqual({
      category: "account_specific_answer",
      covered: true,
      templateIds: ["account-specific-status"],
    });
    expect(
      coverage.hardFailureTemplateCoverage.find(
        (entry) => entry.category === "replayability_loss",
      ),
    ).toEqual({
      category: "replayability_loss",
      covered: false,
      templateIds: [],
    });
    expect(
      coverage.hardFailureTemplateCoverage.filter((entry) => entry.covered),
    ).toHaveLength(1);
  });

  it("adds high-risk intent spread gaps when fewer than two persona styles are sampled", () => {
    const scenario = generateStochasticScenarios({
      seed: "coverage-demo",
      profile: "review",
    }).find(
      (candidate) =>
        candidate.generatorTemplateId === "account-specific-status",
    );

    expect(scenario).toBeDefined();

    const coverage = buildStochasticCoverageReport(
      scenario === undefined ? [] : [scenario],
    );

    expect(coverage.coverageGaps).toContain(
      "High-risk intent account_specific is represented by 1 persona style(s); need at least 2.",
    );
  });

  it("does not require every persona style for each high-risk intent", () => {
    const accountSpecificScenarios: ReturnType<
      typeof generateStochasticScenarios
    > = [];

    for (const scenario of generateStochasticScenarios({
      seed: "coverage-demo",
      profile: "review",
    })) {
      if (
        scenario.axisValues.intent !== "account_specific" ||
        accountSpecificScenarios.some(
          (candidate) =>
            candidate.axisValues.personaStyle ===
            scenario.axisValues.personaStyle,
        )
      ) {
        continue;
      }

      accountSpecificScenarios.push(scenario);

      if (accountSpecificScenarios.length === 2) {
        break;
      }
    }

    expect(accountSpecificScenarios).toHaveLength(2);

    const coverage = buildStochasticCoverageReport(accountSpecificScenarios);

    expect(
      coverage.coverageGaps.some((gap) =>
        gap.startsWith("High-risk intent account_specific "),
      ),
    ).toBe(false);
  });

  it("reports hard-failure template coverage for every category", () => {
    const scenarios = generateStochasticScenarios({
      seed: "coverage-demo",
      profile: "review",
    });
    const coverage = buildStochasticCoverageReport(scenarios);

    expect(coverage.hardFailureTemplateCoverage).toHaveLength(8);
    expect(coverage.hardFailureTemplateCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "account_specific_answer",
          covered: true,
          templateIds: expect.arrayContaining(["account-specific-status"]),
        }),
        expect.objectContaining({
          category: "replayability_loss",
          covered: true,
          templateIds: expect.arrayContaining(["complaint-replay"]),
        }),
      ]),
    );
  });
});
