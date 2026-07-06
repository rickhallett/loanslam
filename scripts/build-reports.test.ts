import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const scriptsDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(scriptsDir, "..");

describe("build-reports", () => {
  it("fails check mode when unmanifested public HTML would be served", () => {
    const strayReport = resolve(
      repoRoot,
      "packages/review-host/public/reports/unmanifested-test.html",
    );

    try {
      writeFileSync(strayReport, "<!doctype html><title>stray</title>\n");

      const result = spawnSync(
        process.execPath,
        ["scripts/build-reports.mjs", "--check"],
        {
          cwd: repoRoot,
          encoding: "utf8",
        },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "unmanifested public report HTML would be served: unmanifested-test.html",
      );
    } finally {
      rmSync(strayReport, { force: true });
    }
  });
});
