#!/usr/bin/env tsx
/**
 * floor-delta: turn a candidate Hell Week run into a typed safety-floor receipt.
 *
 * Reads a candidate report.json and the committed anchor
 * (artifacts/evidence-index/baseline.json), then scores the per-dimension
 * safety-floor delta and emits one of:
 *
 *   REPAIRED      every safety-floor dimension passes (breached == false)
 *   HOLDING       no floor dimension regressed below the anchor, still breached
 *   REGRESSED     a floor dimension dropped, a new demo-killer appeared, or the
 *                 aggregate floor pass fell below the anchor
 *   INCONCLUSIVE  the candidate is not comparable to the anchor (different
 *                 profile or scenario count) - the receipt cannot be trusted
 *
 * Exit code is 0 only for REPAIRED and HOLDING; REGRESSED and INCONCLUSIVE exit
 * non-zero so a gate cannot pass on a regression or an untrustworthy receipt.
 * The verdict is also written to disk for gate-slice / promote-hop to parse.
 *
 * Usage:
 *   tsx scripts/floor-delta.ts <candidate-run-dir-or-report.json>
 *     [--baseline <path>] [--out <path>] [--json] [--quiet]
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_BASELINE = "artifacts/evidence-index/baseline.json";
const DEFAULT_OUT = "artifacts/evidence-index/floor-delta-latest.json";

export type FloorDeltaStatus =
  | "REPAIRED"
  | "HOLDING"
  | "REGRESSED"
  | "INCONCLUSIVE";

interface FloorDimension {
  dimension: string;
  label: string;
  pass: number;
  total: number;
}

interface FloorSummary {
  runId: string;
  profile: string;
  breached: boolean;
  pass: number;
  total: number;
  scenarios: number;
  demoKillers: number;
  passRate: number;
  dimensions: FloorDimension[];
}

export interface FloorDeltaVerdict {
  status: FloorDeltaStatus;
  generatedAt: string;
  baselineRunId: string;
  candidateRunId: string;
  candidateReportPath: string;
  comparable: boolean;
  reasons: string[];
  totals: {
    baselineDemoKillers: number;
    candidateDemoKillers: number;
    baselinePassRate: number;
    candidatePassRate: number;
  };
  safetyFloor: {
    baselinePass: number;
    candidatePass: number;
    total: number;
    candidateBreached: boolean;
    dimensions: Array<{
      dimension: string;
      label: string;
      baselinePass: number;
      candidatePass: number;
      total: number;
      delta: number;
      regressed: boolean;
    }>;
  };
}

function fail(message: string): never {
  console.error(`floor-delta: ${message}`);
  process.exit(2);
}

function readJson(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    fail(`cannot read ${path}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`invalid JSON in ${path}`);
  }
}

function resolveReportPath(candidate: string): string {
  try {
    if (statSync(candidate).isDirectory()) {
      return join(candidate, "report.json");
    }
  } catch {
    fail(`candidate path does not exist: ${candidate}`);
  }
  return candidate;
}

function asFloorSummary(report: any, source: string): FloorSummary {
  const floor = report?.safetyFloor;
  const totals = report?.totals;
  if (!floor || !Array.isArray(floor.dimensions) || !totals) {
    fail(`${source} is missing safetyFloor/totals; not a Hell Week report`);
  }
  return {
    runId: String(report.runId ?? "unknown"),
    profile: String(report.profile ?? "unknown"),
    breached: Boolean(floor.breached),
    pass: Number(floor.pass),
    total: Number(floor.total),
    scenarios: Number(totals.scenarios),
    demoKillers: Number(totals.demoKillers ?? 0),
    passRate: Number(totals.passRate ?? 0),
    dimensions: floor.dimensions.map((dimension: any) => ({
      dimension: String(dimension.dimension),
      label: String(dimension.label ?? dimension.dimension),
      pass: Number(dimension.pass),
      total: Number(dimension.total),
    })),
  };
}

// The committed baseline.json nests the floor anchor; lift it to the same shape.
function baselineToSummary(baseline: any): FloorSummary {
  return asFloorSummary(
    {
      runId: baseline.runId,
      profile: baseline.profile,
      safetyFloor: baseline.safetyFloor,
      totals: baseline.totals,
    },
    "baseline.json",
  );
}

export function scoreFloorDelta(
  baseline: FloorSummary,
  candidate: FloorSummary,
  candidateReportPath: string,
): FloorDeltaVerdict {
  const reasons: string[] = [];
  const baselineByDim = new Map(baseline.dimensions.map((d) => [d.dimension, d]));

  const comparable =
    baseline.profile === candidate.profile &&
    baseline.scenarios === candidate.scenarios;
  if (!comparable) {
    reasons.push(
      `not comparable to the anchor: profile ${baseline.profile} vs ${candidate.profile}, scenarios ${baseline.scenarios} vs ${candidate.scenarios}`,
    );
  }

  let regressed = false;
  const dimensions = baseline.dimensions.map((base) => {
    const cand = candidate.dimensions.find(
      (d) => d.dimension === base.dimension,
    );
    const candidatePass = cand ? cand.pass : 0;
    const delta = candidatePass - base.pass;
    const dimRegressed = delta < 0;
    if (dimRegressed) {
      regressed = true;
      reasons.push(
        `${base.label} regressed ${base.pass}->${candidatePass} (${delta})`,
      );
    } else if (delta > 0) {
      reasons.push(`${base.label} improved ${base.pass}->${candidatePass} (+${delta})`);
    }
    return {
      dimension: base.dimension,
      label: base.label,
      baselinePass: base.pass,
      candidatePass,
      total: base.total,
      delta,
      regressed: dimRegressed,
    };
  });

  // Surface candidate floor dimensions the anchor does not know about.
  for (const cand of candidate.dimensions) {
    if (!baselineByDim.has(cand.dimension)) {
      reasons.push(`new floor dimension not in anchor: ${cand.label}`);
    }
  }

  if (candidate.demoKillers > baseline.demoKillers) {
    regressed = true;
    reasons.push(
      `new demo-killer(s): ${baseline.demoKillers}->${candidate.demoKillers}`,
    );
  }
  if (candidate.pass < baseline.pass) {
    regressed = true;
    reasons.push(
      `aggregate floor pass fell ${baseline.pass}->${candidate.pass}`,
    );
  }

  let status: FloorDeltaStatus;
  if (!comparable) {
    status = "INCONCLUSIVE";
  } else if (regressed) {
    status = "REGRESSED";
  } else if (!candidate.breached) {
    status = "REPAIRED";
    reasons.push("safety floor fully passing (breached == false)");
  } else {
    status = "HOLDING";
    reasons.push("no floor dimension regressed; floor still breached");
  }

  return {
    status,
    generatedAt: new Date().toISOString(),
    baselineRunId: baseline.runId,
    candidateRunId: candidate.runId,
    candidateReportPath,
    comparable,
    reasons,
    totals: {
      baselineDemoKillers: baseline.demoKillers,
      candidateDemoKillers: candidate.demoKillers,
      baselinePassRate: baseline.passRate,
      candidatePassRate: candidate.passRate,
    },
    safetyFloor: {
      baselinePass: baseline.pass,
      candidatePass: candidate.pass,
      total: baseline.total,
      candidateBreached: candidate.breached,
      dimensions,
    },
  };
}

function parseArgs(argv: string[]): {
  candidate?: string;
  baseline: string;
  out: string;
  json: boolean;
  quiet: boolean;
} {
  const result = {
    candidate: undefined as string | undefined,
    baseline: DEFAULT_BASELINE,
    out: DEFAULT_OUT,
    json: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue; // tolerate the separator passed via `just <recipe> -- ...`
    else if (arg === "--baseline") result.baseline = argv[(i += 1)] ?? fail("--baseline needs a path");
    else if (arg === "--out") result.out = argv[(i += 1)] ?? fail("--out needs a path");
    else if (arg === "--json") result.json = true;
    else if (arg === "--quiet") result.quiet = true;
    else if (!arg.startsWith("--") && !result.candidate) result.candidate = arg;
    else fail(`unexpected argument: ${arg}`);
  }
  return result;
}

const EXIT_FOR_STATUS: Record<FloorDeltaStatus, number> = {
  REPAIRED: 0,
  HOLDING: 0,
  REGRESSED: 1,
  INCONCLUSIVE: 1,
};

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  if (!args.candidate) {
    fail("usage: floor-delta <candidate-run-dir-or-report.json> [--baseline p] [--out p] [--json]");
  }

  const reportPath = resolveReportPath(args.candidate);
  const baseline = baselineToSummary(readJson(args.baseline));
  const candidate = asFloorSummary(readJson(reportPath), reportPath);
  const verdict = scoreFloorDelta(baseline, candidate, reportPath);

  writeFileSync(args.out, `${JSON.stringify(verdict, null, 2)}\n`);

  if (args.json) {
    console.log(JSON.stringify(verdict, null, 2));
  } else if (!args.quiet) {
    console.log(`floor-delta: ${verdict.status}`);
    console.log(
      `  anchor ${verdict.baselineRunId} (${baseline.pass}/${baseline.total}) vs candidate ${verdict.candidateRunId} (${candidate.pass}/${candidate.total})`,
    );
    for (const reason of verdict.reasons) console.log(`  - ${reason}`);
    console.log(`  receipt: ${args.out}`);
  }

  process.exit(EXIT_FOR_STATUS[verdict.status]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
