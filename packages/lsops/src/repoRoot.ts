import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function findRepoRoot(start = process.cwd()): string {
  let current = resolve(start);
  while (true) {
    if (
      existsSync(resolve(current, "package.json")) &&
      existsSync(resolve(current, "Justfile"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Could not find Loanslam repo root from ${start}`);
    }
    current = parent;
  }
}
