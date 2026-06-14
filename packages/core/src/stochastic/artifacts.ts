import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  CorpusItem,
  StochasticRunArtifact,
  StochasticScenario,
  StochasticTraceRow,
} from "@loanslam/contracts";
import {
  stochasticRunArtifactSchema,
  stochasticScenarioSchema,
  stochasticTraceRowSchema,
} from "@loanslam/contracts";

export interface BuildStochasticArtifactPathsInput {
  outputDir?: string;
  seed: string;
  summaryOutput?: string;
}

export type StochasticArtifactPaths = StochasticRunArtifact["artifacts"];

const artifactPathKeys = [
  "runJson",
  "scenariosJsonl",
  "tracesJsonl",
  "summaryMarkdown",
  "dashboardHtml",
] as const satisfies readonly (keyof StochasticArtifactPaths)[];
const safeArtifactTokenPattern = /^[A-Za-z0-9._-]+$/;

export function buildStochasticArtifactPaths({
  outputDir = "artifacts/phase0",
  seed,
  summaryOutput,
}: BuildStochasticArtifactPathsInput): StochasticArtifactPaths {
  assertSafeArtifactToken(seed);

  return {
    runJson: join(outputDir, `stochastic-run-${seed}.json`),
    scenariosJsonl: join(outputDir, `stochastic-scenarios-${seed}.jsonl`),
    tracesJsonl: join(outputDir, `stochastic-traces-${seed}.jsonl`),
    summaryMarkdown:
      summaryOutput ?? join(outputDir, `stochastic-summary-${seed}.md`),
    dashboardHtml: join(outputDir, `stochastic-dashboard-${seed}.html`),
  };
}

export interface WriteStochasticArtifactsInput {
  paths: StochasticArtifactPaths;
  run: StochasticRunArtifact;
  scenarios: readonly StochasticScenario[];
  traces: readonly StochasticTraceRow[];
  summaryMarkdown: string;
  dashboardHtml: string;
}

export function writeStochasticArtifacts({
  paths,
  run,
  scenarios,
  traces,
  summaryMarkdown,
  dashboardHtml,
}: WriteStochasticArtifactsInput): void {
  const parsedRun = stochasticRunArtifactSchema.parse(run);
  const parsedScenarios = stochasticScenarioSchema.array().parse(scenarios);
  const parsedTraces = stochasticTraceRowSchema.array().parse(traces);

  assertRunArtifactsMatchPaths(paths, parsedRun.artifacts);

  writeText(paths.runJson, `${JSON.stringify(parsedRun, null, 2)}\n`);
  writeText(paths.scenariosJsonl, toJsonl(parsedScenarios));
  writeText(paths.tracesJsonl, toJsonl(parsedTraces));
  writeText(paths.summaryMarkdown, newlineTerminate(summaryMarkdown));
  writeText(paths.dashboardHtml, newlineTerminate(dashboardHtml));
}

export function fingerprintCorpus(corpus: readonly CorpusItem[]): string {
  const sortedCorpus = [...corpus].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const stableJson = JSON.stringify(stableSortValue(sortedCorpus));
  const digest = createHash("sha256").update(stableJson).digest("hex");

  return `sha256:${digest}`;
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function assertSafeArtifactToken(seed: string): void {
  if (!safeArtifactTokenPattern.test(seed)) {
    throw new Error(
      "STS seed must be filename-safe: use only letters, numbers, dot, underscore, and hyphen.",
    );
  }
}

function assertRunArtifactsMatchPaths(
  paths: StochasticArtifactPaths,
  runArtifacts: StochasticArtifactPaths,
): void {
  for (const key of artifactPathKeys) {
    if (runArtifacts[key] !== paths[key]) {
      throw new Error(
        `run.artifacts.${key} must match the ${key} path being written.`,
      );
    }
  }
}

function toJsonl(rows: readonly unknown[]): string {
  if (rows.length === 0) {
    return "";
  }

  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

function newlineTerminate(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, stableSortValue(entryValue)]),
    );
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
