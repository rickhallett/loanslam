import { describe, expect, it } from "vitest";

import { formatRemoteSyncSummary, parseSyncMode } from "./remoteSync";

describe("remote secret sync helpers", () => {
  it("dry-runs by default", () => {
    expect(parseSyncMode([])).toEqual({ apply: false, dryRun: true });
    expect(parseSyncMode(["--apply"])).toEqual({ apply: true, dryRun: false });
  });

  it("reports planned, pushed, and failed keys", () => {
    expect(
      formatRemoteSyncSummary({
        planned: ["A", "B"],
        pushed: ["A"],
        failed: ["B"],
      }),
    ).toBe("planned: A, B\npushed: A\nfailed: B");
  });
});
