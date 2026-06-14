import { describe, expect, it } from "vitest";

import { createSeededRandom, deriveScenarioSeed } from "./seededRandom";

describe("seeded STS random", () => {
  it("produces the same sequence for the same seed", () => {
    const first = createSeededRandom("demo-seed");
    const second = createSeededRandom("demo-seed");

    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(),
      second.next(),
      second.next(),
    ]);
  });

  it("derives stable scenario seeds from run seed and path", () => {
    expect(deriveScenarioSeed("run", "review/001/faq/cooperative")).toBe(
      deriveScenarioSeed("run", "review/001/faq/cooperative"),
    );
    expect(deriveScenarioSeed("run", "review/001/faq/cooperative")).not.toBe(
      deriveScenarioSeed("run", "review/002/faq/cooperative"),
    );
  });

  it("fails clearly for empty pick and integer ranges", () => {
    const random = createSeededRandom("demo-seed");

    expect(() => random.pick([])).toThrow("Cannot pick from an empty array");
    expect(() => random.integer(0)).toThrow(
      "maxExclusive must be greater than 0",
    );
  });

  it("shuffles without mutating the input", () => {
    const values = ["a", "b", "c", "d"];
    const shuffled = createSeededRandom("demo-seed").shuffle(values);

    expect(shuffled).toHaveLength(values.length);
    expect(shuffled.sort()).toEqual(values);
    expect(values).toEqual(["a", "b", "c", "d"]);
  });
});
