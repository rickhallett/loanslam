#!/usr/bin/env node
import { findRepoRoot } from "../repoRoot";
import { runLsops, UsageError } from "./commands";

try {
  const root = findRepoRoot();
  process.exitCode = await runLsops(root, process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = error instanceof UsageError ? error.exitCode : 1;
}
