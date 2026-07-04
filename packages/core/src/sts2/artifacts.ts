import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  Sts2Initialization,
  Sts2RunReport,
  Sts2Trajectory,
} from "@loanslam/contracts";
import {
  sts2InitializationSchema,
  sts2RunReportSchema,
  sts2TrajectorySchema,
} from "@loanslam/contracts";

// Run-folder layout per the keel spec, section 5:
// artifacts/phase0/sts2-<profile>-<stamp>/
//   report.json, report.html, inits.jsonl, transcripts.jsonl, summary.md
// (judge/ packets arrive with arc-002.)

export interface Sts2ArtifactPaths {
  runDir: string;
  reportJson: string;
  reportHtml: string;
  initsJsonl: string;
  transcriptsJsonl: string;
  summaryMarkdown: string;
}

const safeArtifactTokenPattern = /^[A-Za-z0-9._-]+$/;

export interface BuildSts2ArtifactPathsInput {
  profile: string;
  stamp: string;
  outputDir?: string;
}

export function buildSts2ArtifactPaths({
  profile,
  stamp,
  outputDir = "artifacts/phase0",
}: BuildSts2ArtifactPathsInput): Sts2ArtifactPaths {
  assertSafeArtifactToken(profile);
  assertSafeArtifactToken(stamp);
  const runDir = join(outputDir, `sts2-${profile}-${stamp}`);

  return {
    runDir,
    reportJson: join(runDir, "report.json"),
    reportHtml: join(runDir, "report.html"),
    initsJsonl: join(runDir, "inits.jsonl"),
    transcriptsJsonl: join(runDir, "transcripts.jsonl"),
    summaryMarkdown: join(runDir, "summary.md"),
  };
}

export interface WriteSts2ArtifactsInput {
  paths: Sts2ArtifactPaths;
  report: Sts2RunReport;
  initializations: readonly Sts2Initialization[];
  trajectories: readonly Sts2Trajectory[];
  summaryMarkdown: string;
  reportHtml: string;
}

export function writeSts2Artifacts({
  paths,
  report,
  initializations,
  trajectories,
  summaryMarkdown,
  reportHtml,
}: WriteSts2ArtifactsInput): void {
  const parsedReport = sts2RunReportSchema.parse(report);
  const parsedInits = sts2InitializationSchema.array().parse(initializations);
  const parsedTrajectories = sts2TrajectorySchema
    .array()
    .parse(trajectories);

  writeText(paths.reportJson, `${JSON.stringify(parsedReport, null, 2)}\n`);
  writeText(paths.initsJsonl, toJsonl(parsedInits));
  writeText(paths.transcriptsJsonl, toJsonl(parsedTrajectories));
  writeText(paths.summaryMarkdown, newlineTerminate(summaryMarkdown));
  writeText(paths.reportHtml, newlineTerminate(reportHtml));
}

// The regrade surface: load a persisted run back from disk so a fresh report
// (and, from arc-002, a fresh judge pass) can be produced without
// re-simulation.
export interface ReadSts2RunInput {
  runDir: string;
}

export interface Sts2PersistedRun {
  report: Sts2RunReport;
  initializations: Sts2Initialization[];
  trajectories: Sts2Trajectory[];
}

export function readSts2Run({ runDir }: ReadSts2RunInput): Sts2PersistedRun {
  const report = sts2RunReportSchema.parse(
    JSON.parse(readFileSync(join(runDir, "report.json"), "utf8")),
  );
  const initializations = sts2InitializationSchema
    .array()
    .parse(fromJsonl(readFileSync(join(runDir, "inits.jsonl"), "utf8")));
  const trajectories = sts2TrajectorySchema
    .array()
    .parse(fromJsonl(readFileSync(join(runDir, "transcripts.jsonl"), "utf8")));

  return { report, initializations, trajectories };
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function assertSafeArtifactToken(token: string): void {
  if (!safeArtifactTokenPattern.test(token)) {
    throw new Error(
      "sts2 artifact tokens must be filename-safe: letters, numbers, dot, underscore, and hyphen only.",
    );
  }
}

function toJsonl(rows: readonly unknown[]): string {
  if (rows.length === 0) {
    return "";
  }

  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

function fromJsonl(content: string): unknown[] {
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function newlineTerminate(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
