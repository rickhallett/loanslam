import { describe, expect, it } from "vitest";

import { parseDotenv, serializeDotenv } from "./dotenv";

describe("dotenv helpers", () => {
  it("parses export, quoted, and plain values", () => {
    const values = parseDotenv("export A=one\nB=\"two words\"\nC='three'\n");
    expect(Object.fromEntries(values)).toEqual({
      A: "one",
      B: "two words",
      C: "three",
    });
  });

  it("serializes manifest keys first and quotes unsafe values", () => {
    const values = new Map([
      ["B", "two words"],
      ["A", "one"],
    ]);
    expect(serializeDotenv(values, ["A", "B"])).toBe('A=one\nB="two words"\n');
  });
});
