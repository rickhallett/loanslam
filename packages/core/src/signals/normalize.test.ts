import { describe, expect, it } from "vitest";

import { parseSignalBundle } from "./normalize";

describe("parseSignalBundle", () => {
  it("keeps a valid recommended serving mode", () => {
    const bundle = parseSignalBundle({
      primaryIntent: "account_specific",
      recommendedServingMode: "handoff_account_specific",
      uncertainty: 0.3,
    });

    expect(bundle.recommendedServingMode).toBe("handoff_account_specific");
  });

  it("nulls an unrecognized recommended serving mode", () => {
    const bundle = parseSignalBundle({
      primaryIntent: "other",
      recommendedServingMode: "book_a_train",
      uncertainty: 0.3,
    });

    expect(bundle.recommendedServingMode).toBeNull();
  });

  it("trims and drops empty string-array entries", () => {
    const bundle = parseSignalBundle({
      primaryIntent: "answer",
      recommendedServingMode: "answer",
      uncertainty: 0.1,
      retrievalQueries: ["  loan ", "", "   ", "application"],
      routeHints: "not-an-array",
    });

    expect(bundle.retrievalQueries).toEqual(["loan", "application"]);
    expect(bundle.routeHints).toEqual([]);
  });

  it("clamps uncertainty and coerces negatedOrCorrected", () => {
    expect(
      parseSignalBundle({ primaryIntent: "answer", uncertainty: 1.5 })
        .uncertainty,
    ).toBe(1);
    expect(
      parseSignalBundle({ primaryIntent: "answer", uncertainty: -2 })
        .uncertainty,
    ).toBe(0);
    expect(
      parseSignalBundle({ primaryIntent: "answer" }).uncertainty,
    ).toBe(0.5);
    expect(
      parseSignalBundle({ primaryIntent: "answer", negatedOrCorrected: 0 })
        .negatedOrCorrected,
    ).toBe(false);
  });
});
