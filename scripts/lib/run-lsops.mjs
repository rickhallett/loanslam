#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function runLsops(args) {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const tsx = resolve(repoRoot, "node_modules/.bin/tsx");
  const command = existsSync(tsx) ? tsx : "npx";
  const commandArgs = existsSync(tsx)
    ? ["packages/lsops/src/cli/main.ts", ...args]
    : ["tsx", "packages/lsops/src/cli/main.ts", ...args];
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}
