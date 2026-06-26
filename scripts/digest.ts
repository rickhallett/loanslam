#!/usr/bin/env tsx
/**
 * digest: a privacy-preserving Hell Week digest for morning review / PR bodies.
 *
 * Reads ONLY report.json (typed numbers: pass rate, demo-killers, dents,
 * per-dimension safety floor, verdict). It never opens evidence.json or
 * scenarios/*.json, so deliberately-hostile prompt-injection transcripts and any
 * PII they captured cannot leak into a human-read artifact. The privacy contract
 * is structural, not trusted.
 *
 * If a floor-delta receipt for the same run is present, its typed status is
 * folded in. Emits markdown by default, or `--json` for a typed object.
 *
 * Usage: tsx scripts/digest.ts <run-dir-or-report.json> [--json]
 *   [--floor-delta <receipt-path>]
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_RECEIPT = "artifacts/evidence-index/floor-delta-latest.json";

interface FloorDimensionSummary {
  dimension: string;
  label: string;
  pass: number;
  total: number;
}

interface Digest {
  runId: string;
  profile: string;
  policyVersion: string;
  judged: boolean;
  verdict: string;
  totals: {
    scenarios: number;
    passed: number;
    passRate: number;
    demoKillers: number;
    dents: number;
  };
  safetyFloor: {
    breached: boolean;
    pass: number;
    total: number;
    dimensions: FloorDimensionSummary[];
  };
  floorDelta: { status: string; candidateRunId: string } | null;
}

function fail(message: string): never {
  console.error(`digest: ${message}`);
  process.exit(2);
}

function resolveReportPath(input: string): string {
  try {
    if (statSync(input).isDirectory()) return join(input, "report.json");
  } catch {
    fail(`path does not exist: ${input}`);
  }
  return input;
}

function readReportJson(path: string): any {
  // Intentionally only ever reads report.json - never evidence.json/scenarios.
  if (!path.endsWith("report.json")) {
    fail(`refusing to read non-report file: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`cannot read/parse ${path}`);
  }
}

function buildDigest(report: any, receiptPath: string): Digest {
  const floor = report.safetyFloor ?? {};
  const totals = report.totals ?? {};
  const dimensions: FloorDimensionSummary[] = (floor.dimensions ?? []).map(
    (d: any) => ({
      dimension: String(d.dimension),
      label: String(d.label ?? d.dimension),
      pass: Number(d.pass),
      total: Number(d.total),
    }),
  );

  let floorDelta: Digest["floorDelta"] = null;
  if (existsSync(receiptPath)) {
    try {
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
      // Only fold in a receipt that belongs to THIS run.
      if (receipt?.candidateRunId === report.runId) {
        floorDelta = {
          status: String(receipt.status),
          candidateRunId: String(receipt.candidateRunId),
        };
      }
    } catch {
      /* a malformed receipt is simply omitted */
    }
  }

  return {
    runId: String(report.runId ?? "unknown"),
    profile: String(report.profile ?? "unknown"),
    policyVersion: String(report.policyVersion ?? "unknown"),
    judged: Boolean(report.judged),
    verdict: String(report.verdict ?? "unknown"),
    totals: {
      scenarios: Number(totals.scenarios ?? 0),
      passed: Number(totals.passed ?? 0),
      passRate: Number(totals.passRate ?? 0),
      demoKillers: Number(totals.demoKillers ?? 0),
      dents: Number(totals.dents ?? 0),
    },
    safetyFloor: {
      breached: Boolean(floor.breached),
      pass: Number(floor.pass ?? 0),
      total: Number(floor.total ?? 0),
      dimensions,
    },
    floorDelta,
  };
}

function toMarkdown(d: Digest): string {
  const pct = (d.totals.passRate * 100).toFixed(1);
  const floorState = d.safetyFloor.breached ? "BREACHED" : "holding";
  const lines = [
    `## Hell Week digest - ${d.runId}`,
    `- profile: ${d.profile} | policy: ${d.policyVersion} | judged: ${d.judged}`,
    `- verdict: **${d.verdict}**`,
    `- pass rate: ${d.totals.passed}/${d.totals.scenarios} (${pct}%) | dents: ${d.totals.dents}`,
    `- **safety floor: ${d.safetyFloor.pass}/${d.safetyFloor.total} ${floorState}**`,
    `- **demo-killers: ${d.totals.demoKillers}**`,
  ];
  if (d.floorDelta) {
    lines.push(`- floor-delta vs anchor: **${d.floorDelta.status}**`);
  }
  lines.push("- per-dimension safety floor:");
  for (const dim of d.safetyFloor.dimensions) {
    const flag = dim.pass < dim.total ? " <-" : "";
    lines.push(`  - ${dim.label}: ${dim.pass}/${dim.total}${flag}`);
  }
  return lines.join("\n");
}

export function main(argv: string[]): void {
  let input: string | undefined;
  let asJson = false;
  let receiptPath = DEFAULT_RECEIPT;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--" ) continue;
    else if (arg === "--json") asJson = true;
    else if (arg === "--floor-delta") receiptPath = argv[(i += 1)] ?? receiptPath;
    else if (!arg.startsWith("--") && !input) input = arg;
    else fail(`unexpected argument: ${arg}`);
  }
  if (!input) fail("usage: digest <run-dir-or-report.json> [--json]");

  const report = readReportJson(resolveReportPath(input));
  const digest = buildDigest(report, receiptPath);
  console.log(asJson ? JSON.stringify(digest, null, 2) : toMarkdown(digest));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
