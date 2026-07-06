import { describe, expect, it } from "vitest";

import { CheckRun } from "./CheckRun";
import { exitCodeForSummary, failIfAnyFailure } from "./exitPolicy";

describe("lsops exit policy", () => {
  it("exits zero for all-passing runs", () => {
    const run = new CheckRun("example", { log: { log: () => undefined } });
    run.pass("one");
    expect(exitCodeForSummary(run.summary())).toBe(0);
  });

  it("exits non-zero on failures by default", () => {
    const run = new CheckRun("example", { log: { log: () => undefined } });
    run.fail("one");
    expect(exitCodeForSummary(run.summary())).toBe(1);
    expect(() => failIfAnyFailure(run.summary())).toThrow("failed 1/1 checks");
  });

  it("allows explicit measurement-only runs to exit zero", () => {
    const run = new CheckRun("example", { log: { log: () => undefined } });
    run.fail("finding");
    expect(exitCodeForSummary(run.summary(), { measurementOnly: true })).toBe(
      0,
    );
  });
});
