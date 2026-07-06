#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fallbackRevision = "7897a8b";

const reports = [
  {
    id: "hell-week-full",
    label: "Hell Week full styled report",
    target: "packages/review-host/public/reports/hell-week-full.html",
    sourceOption: "--full-source",
    localSources: [
      "artifacts/phase0/hell-week-full-2026-06-16T07-47-56-459Z/report.html",
    ],
    gitFallbackPath: "packages/review-host/public/reports/hell-week-full.html",
    minLines: 1000,
    markers: [
      "hell-week-full-2026-06-16T07-47-56-459Z",
      "Safety floor holds. 27 dents to tune. 78% of scenarios pass.",
      "All scenarios",
      "Each scenario ran against the live model-backed engine",
    ],
    provenance: [
      "Generator: packages/core/src/hellweek/htmlReport.ts via core:hell-week.",
      "Replay command: just hell-week -- --from-db hell-week-full-2026-06-16T07-47-56-459Z --out artifacts/phase0",
    ],
  },
  {
    id: "iteration-1-stability",
    label: "Iteration 1 styled stability/variance report",
    target: "packages/review-host/public/reports/iteration-1-stability.html",
    sourceOption: "--stability-source",
    localSources: [
      "artifacts/phase0/hell-week-iteration-1-stability-2026-06-16.html",
    ],
    gitFallbackPath:
      "packages/review-host/public/reports/iteration-1-stability.html",
    minLines: 1000,
    markers: [
      "Hell Week Iteration 1 stability report",
      "Keep Iteration 1, do not start Iteration 2 from one-offs",
      "Built from the three committed post-Iteration-1 Hell Week report",
      "No model calls were made while rendering this stability",
    ],
    provenance: [
      "Recovered artifact: curated static HTML from three post-Iteration-1 Hell Week runs.",
      "Current reusable DB-backed path: just hell-week-stability -- --runs <run1,run2,run3> --set-id <setId> --out artifacts/phase0",
      "The original curated one-off renderer was not committed; republish this page with --stability-source <html> when replacing it.",
    ],
  },
];

const args = stripOptionSeparator(process.argv.slice(2));
const options = parseArgs(args);

if (options.help) {
  printHelp();
  process.exit(0);
}

try {
  validateManifest();

  if (options.check) {
    for (const report of reports) {
      const target = resolve(root, report.target);
      if (!existsSync(target)) {
        throw new Error(`${report.target} is missing.`);
      }
      const content = readFileSync(target, "utf8");
      validateReport(report, content, report.target);
      console.log(`ok ${report.id}: ${lineCount(content)} lines`);
    }
    runReportsBuild(["--check"]);
    printProvenance();
    process.exit(0);
  }

  for (const report of reports) {
    const resolved = resolveSource(report, options.sources.get(report.id));
    const target = resolve(root, report.target);
    mkdirSync(dirname(target), { recursive: true });
    validateReport(report, resolved.content, resolved.label);

    const existing = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (existing === resolved.content) {
      console.log(`kept ${report.target} (${lineCount(resolved.content)} lines)`);
    } else if (resolved.filePath) {
      copyFileSync(resolved.filePath, target);
      console.log(`copied ${resolved.label} -> ${report.target}`);
    } else {
      writeFileSync(target, resolved.content, "utf8");
      console.log(`restored ${report.target} from ${resolved.label}`);
    }
  }

  runReportsBuild([]);
  printProvenance();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function parseArgs(rawArgs) {
  const parsed = {
    check: false,
    help: false,
    sources: new Map(),
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--check") {
      parsed.check = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    const report = reports.find((item) => item.sourceOption === arg);
    if (report) {
      const value = rawArgs[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a path or git:<rev>:<path> source.`);
      }
      parsed.sources.set(report.id, value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

function resolveSource(report, explicitSource) {
  const specs = explicitSource
    ? [explicitSource]
    : [
        ...report.localSources,
        report.target,
        `git:${fallbackRevision}:${report.gitFallbackPath}`,
      ];

  const failures = [];
  for (const spec of specs) {
    try {
      const source = readSource(spec);
      validateReport(report, source.content, source.label);
      return source;
    } catch (error) {
      failures.push(
        `${spec}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  throw new Error(
    `No valid source found for ${report.id}.\nTried:\n- ${failures.join("\n- ")}`,
  );
}

function readSource(spec) {
  if (spec.startsWith("git:")) {
    const match = /^git:([^:]+):(.+)$/.exec(spec);
    if (!match) {
      throw new Error("git source must be git:<rev>:<path>.");
    }
    const [, revision, blobPath] = match;
    const content = execFileSync("git", ["show", `${revision}:${blobPath}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      label: spec,
      content,
    };
  }

  const filePath = resolve(root, spec);
  if (!existsSync(filePath)) {
    throw new Error("file does not exist");
  }

  return {
    label: spec,
    filePath,
    content: readFileSync(filePath, "utf8"),
  };
}

function validateReport(report, html, label) {
  const lines = lineCount(html);
  if (lines < report.minLines) {
    throw new Error(
      `${label} is too short for ${report.label}: ${lines} lines, expected at least ${report.minLines}.`,
    );
  }

  const missing = report.markers.filter((marker) => !html.includes(marker));
  if (missing.length > 0) {
    throw new Error(
      `${label} is not the expected styled ${report.label}; missing marker(s): ${missing.join(", ")}`,
    );
  }
}

function validateManifest() {
  const manifestPath = resolve(
    root,
    "packages/review-host/reports-manifest.json",
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const manifestReports = Array.isArray(manifest.reports)
    ? manifest.reports
    : [];
  const ids = new Set(reports.map((report) => report.id));
  const unexpected = manifestReports
    .map((report) => report.id)
    .filter((id) => !ids.has(id));

  if (unexpected.length > 0) {
    throw new Error(
      `reports manifest contains non-Hell-Week public report(s): ${unexpected.join(", ")}`,
    );
  }

  for (const report of reports) {
    const entry = manifestReports.find((item) => item.id === report.id);
    if (!entry) {
      throw new Error(`reports manifest is missing ${report.id}.`);
    }
    if (entry.source?.type !== "static-html") {
      throw new Error(`${report.id} must be a static-html manifest entry.`);
    }
    if (entry.source?.path !== report.target) {
      throw new Error(
        `${report.id} manifest path is ${entry.source?.path}, expected ${report.target}.`,
      );
    }
  }
}

function runReportsBuild(extraArgs) {
  const result = spawnSync(
    "npm",
    ["--silent", "run", "lsops", "--", "reports", "build", ...extraArgs],
    {
      cwd: root,
      encoding: "utf8",
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    throw new Error(`reports build failed with exit code ${result.status}.`);
  }
}

function printProvenance() {
  console.log("");
  console.log("Styled report provenance:");
  for (const report of reports) {
    console.log(`- ${report.id}`);
    for (const line of report.provenance) {
      console.log(`  ${line}`);
    }
  }
}

function lineCount(value) {
  if (!value) return 0;
  return value.endsWith("\n")
    ? value.split("\n").length - 1
    : value.split("\n").length;
}

function stripOptionSeparator(rawArgs) {
  return rawArgs.filter((arg) => arg !== "--");
}

function printHelp() {
  console.log(`Recover/publish the rich styled Hell Week reports served at /reports.

Usage:
  node scripts/recover-styled-hellweek-reports.mjs [--check]
  node scripts/recover-styled-hellweek-reports.mjs [--full-source <html>] [--stability-source <html>]

Sources can be file paths or git blobs in the form git:<rev>:<path>.
Without explicit sources, the script tries local artifacts, the current public HTML,
then the recovered styled pages from ${fallbackRevision}.
`);
}
