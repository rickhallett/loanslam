import { describe, expect, it } from "vitest";
import type {
  StochasticAxisValues,
  StochasticScenario,
} from "@loanslam/contracts";

import {
  generateStochasticScenarios,
  replayStochasticScenario,
} from "./generator";
import { stochasticTemplateAxes } from "./templates";

describe("STS generator", () => {
  it("generates deterministic scenarios for the same seed and profile", () => {
    const first = generateStochasticScenarios({
      seed: "demo",
      profile: "review",
    });
    const second = generateStochasticScenarios({
      seed: "demo",
      profile: "review",
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(60);
  });

  it("defaults to the review profile", () => {
    expect(generateStochasticScenarios({ seed: "demo" })).toHaveLength(60);
  });

  it("generates configured smoke and soak counts", () => {
    expect(
      generateStochasticScenarios({ seed: "demo", profile: "smoke" }),
    ).toHaveLength(12);
    expect(
      generateStochasticScenarios({ seed: "demo", profile: "soak" }),
    ).toHaveLength(180);
  });

  it.each(["seed-163", "seed-127", "seed-5873", "coverage-demo"])(
    "covers every review axis value for %s",
    (seed) => {
      expectAllAxisValuesCovered(
        generateStochasticScenarios({ seed, profile: "review" }),
      );
    },
  );

  it("covers review-profile regression values for previously fragile seeds", () => {
    expectAxisValueCovered("seed-163", "riskMarker", "legal_threat");
    expectAxisValueCovered("seed-127", "personaStyle", "adversarial");
    expectAxisValueCovered("seed-5873", "languageNoise", "overshare");
  });

  it("covers every soak axis value through the coverage overlay", () => {
    expectAllAxisValuesCovered(
      generateStochasticScenarios({ seed: "coverage-demo", profile: "soak" }),
    );
  });

  it("materializes non-none risk markers into customer turns", () => {
    const scenarios = generateStochasticScenarios({
      seed: "coverage-demo",
      profile: "review",
    });

    const piiText = customerTextForRiskMarker(scenarios, "pii");
    expect(piiText).toMatch(
      /full name is Jamie Taylor.*date of birth 12 April 1988.*address 24 Market Street.*phone 07123 456789.*email jamie\.taylor@example\.com/i,
    );
    expect(piiText).not.toMatch(
      /card number|cvv|cvc|sort code|account number|bank login|payment credentials/i,
    );

    expect(
      customerTextForRiskMarker(scenarios, "forbidden_credentials"),
    ).toMatch(/share my card number and CVV/i);
    expect(customerTextForRiskMarker(scenarios, "hardship")).toMatch(
      /cannot afford the repayment.*financial hardship/i,
    );
    expect(customerTextForRiskMarker(scenarios, "legal_threat")).toMatch(
      /formal complaint.*legal action/i,
    );
  });

  it("keeps persona style as axis data instead of duplicated persona fields", () => {
    const [scenario] = generateStochasticScenarios({
      seed: "demo",
      profile: "review",
    });

    expect(scenario).toBeDefined();
    expect(scenario?.axisValues.personaStyle).toBe("impatient");
    expect(scenario?.persona).toEqual({
      id: "impatient-001",
      label: "Impatient",
      traits: ["impatient", "clean", "forbidden-credentials"],
      styleNotes:
        "Impatient style with clean language and forbidden-credentials risk marker.",
    });
  });

  it("builds stable copyable scenario paths", () => {
    const [scenario] = generateStochasticScenarios({
      seed: "demo",
      profile: "review",
    });

    expect(scenario?.scenarioPath).toMatch(
      /^review\/\d{3}\/[a-z-]+\/[a-z-]+\/[a-z-]+$/,
    );
  });

  it("keeps a golden scenario path stable", () => {
    const [scenario] = generateStochasticScenarios({
      seed: "demo",
      profile: "review",
    });

    expect(scenario?.scenarioPath).toBe(
      "review/001/account-specific/impatient/repeated",
    );
  });

  it("replays a scenario from seed, profile, and scenario path", () => {
    const scenarios = generateStochasticScenarios({
      seed: "demo",
      profile: "review",
    });
    const scenario = scenarios[3];

    expect(scenario).toBeDefined();
    expect(
      replayStochasticScenario({
        seed: "demo",
        profile: "review",
        scenarioPath: scenario.scenarioPath,
      }),
    ).toEqual(scenario);
  });

  it("throws a clear error when replay cannot find the scenario path", () => {
    expect(() =>
      replayStochasticScenario({
        seed: "demo",
        profile: "smoke",
        scenarioPath: "review/999/faq/cooperative/single-turn",
      }),
    ).toThrow(
      'No stochastic scenario found for seed "demo", profile "smoke", scenarioPath "review/999/faq/cooperative/single-turn"',
    );
  });
});

function expectAllAxisValuesCovered(scenarios: StochasticScenario[]): void {
  expectAxisCovered(scenarios, "intent", stochasticTemplateAxes.intent);
  expectAxisCovered(
    scenarios,
    "personaStyle",
    stochasticTemplateAxes.personaStyle,
  );
  expectAxisCovered(
    scenarios,
    "journeyShape",
    stochasticTemplateAxes.journeyShape,
  );
  expectAxisCovered(
    scenarios,
    "languageNoise",
    stochasticTemplateAxes.languageNoise,
  );
  expectAxisCovered(scenarios, "riskMarker", stochasticTemplateAxes.riskMarker);
}

function expectAxisCovered<Axis extends keyof StochasticAxisValues>(
  scenarios: StochasticScenario[],
  axis: Axis,
  expectedValues: readonly StochasticAxisValues[Axis][],
): void {
  expect(
    new Set(scenarios.map((scenario) => scenario.axisValues[axis])),
  ).toEqual(new Set(expectedValues));
}

function expectAxisValueCovered<Axis extends keyof StochasticAxisValues>(
  seed: string,
  axis: Axis,
  expectedValue: StochasticAxisValues[Axis],
): void {
  const scenarios = generateStochasticScenarios({ seed, profile: "review" });

  expect(
    scenarios.some((scenario) => scenario.axisValues[axis] === expectedValue),
  ).toBe(true);
}

function customerTextForRiskMarker(
  scenarios: StochasticScenario[],
  riskMarker: Exclude<StochasticAxisValues["riskMarker"], "none">,
): string {
  const scenario = scenarios.find(
    (candidate) => candidate.axisValues.riskMarker === riskMarker,
  );

  expect(scenario).toBeDefined();

  return scenario?.customerTurns.join(" ") ?? "";
}
