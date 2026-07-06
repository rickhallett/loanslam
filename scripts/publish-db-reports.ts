#!/usr/bin/env tsx
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";

import {
  openHellWeekReportStore,
  type HellWeekReportListItem,
  type HellWeekStabilityReportListItem,
} from "../packages/core/src/hellweek/db";
import type { HellWeekReport } from "../packages/core/src/hellweek/types";
import { renderHellWeekReportHtml } from "../packages/core/src/hellweek/htmlReport";
import { renderHellWeekStabilityHtml } from "../packages/core/src/hellweek/stability";
import {
  renderHellWeekTrendDashboardHtml,
  trendDashboardPath,
} from "./publish-db-trends";

type ReportIndexEntry = {
  id: string;
  title: string;
  href: string;
  generatedAt: string;
  kind: "hell-week-run" | "stability";
  summary: string;
  details: string[];
};

const root = resolve(import.meta.dirname, "..");
const defaultOutputDir = "var/reports";
const markerFile = ".loanslam-db-reports";

async function main(): Promise<void> {
  const options = parseArgs(
    process.argv.slice(2).filter((arg) => arg !== "--"),
  );
  if (options.help) {
    printHelp();
    return;
  }

  const outDir = resolve(root, options.outputDir);
  const store = openHellWeekReportStore(options.databaseUrl);

  try {
    const runListings = await store.listReports();
    const stabilityListings = await store.listStabilityReports();
    const outputs = new Map<string, string>();
    const entries: ReportIndexEntry[] = [];
    const trendReports: HellWeekReport[] = [];

    for (const listing of runListings) {
      const report = await store.loadReport(listing.runId);
      if (!report) {
        throw new Error(`DB listed missing Hell Week run ${listing.runId}.`);
      }

      const href = `runs/${safeSlug(listing.runId)}.html`;
      outputs.set(href, renderHellWeekReportHtml(report));
      trendReports.push(report);
      entries.push(runIndexEntry(listing, href));
    }

    for (const listing of stabilityListings) {
      const report = await store.loadStabilityReport(listing.setId);
      if (!report) {
        throw new Error(
          `DB listed missing Hell Week stability set ${listing.setId}.`,
        );
      }

      const href = `stability/${safeSlug(listing.setId)}.html`;
      outputs.set(href, renderHellWeekStabilityHtml(report));
      entries.push(stabilityIndexEntry(listing, href));
    }

    entries.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    outputs.set(trendDashboardPath, renderHellWeekTrendDashboardHtml(trendReports));
    outputs.set("index.html", renderReportsIndex(entries));

    if (options.check) {
      checkOutputs(outDir, outputs);
      console.log(`reports up to date: ${outputs.size} HTML file(s)`);
      return;
    }

    prepareOutputDir(outDir, options);
    for (const [href, html] of outputs) {
      writeOutput(outDir, href, html);
    }
    writeFileSync(resolve(outDir, markerFile), `${new Date().toISOString()}\n`);
    console.log(
      `wrote ${outputs.size} HTML file(s): ${runListings.length} run report(s), ${stabilityListings.length} stability report(s)`,
    );
    console.log(`reports dir: ${relative(root, outDir) || "."}`);
  } finally {
    await store.close();
  }
}

function parseArgs(rawArgs: string[]): {
  check: boolean;
  clean: boolean;
  databaseUrl?: string;
  forceClean: boolean;
  help: boolean;
  outputDir: string;
} {
  const parsed = {
    check: false,
    clean: true,
    databaseUrl: undefined as string | undefined,
    forceClean: false,
    help: false,
    outputDir: defaultOutputDir,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--check") {
      parsed.check = true;
      continue;
    }
    if (arg === "--no-clean") {
      parsed.clean = false;
      continue;
    }
    if (arg === "--force-clean") {
      parsed.forceClean = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--out" || arg === "--output-dir") {
      parsed.outputDir = readRequiredValue(rawArgs, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--db" || arg === "--database-url") {
      parsed.databaseUrl = readRequiredValue(rawArgs, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

function readRequiredValue(
  args: string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function prepareOutputDir(
  outDir: string,
  options: { clean: boolean; forceClean: boolean },
): void {
  if (options.clean && existsSync(outDir)) {
    const hasMarker = existsSync(resolve(outDir, markerFile));
    const hasFiles = readdirSync(outDir).length > 0;
    if (hasFiles && !hasMarker && !options.forceClean) {
      throw new Error(
        `${relative(root, outDir)} is not marked as a generated reports directory. Re-run with --force-clean or choose a different --out path.`,
      );
    }
    rmSync(outDir, { recursive: true, force: true });
  }

  mkdirSync(outDir, { recursive: true });
}

function writeOutput(outDir: string, href: string, html: string): void {
  const target = resolve(outDir, href);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html.endsWith("\n") ? html : `${html}\n`, "utf8");
}

function checkOutputs(outDir: string, outputs: Map<string, string>): void {
  const drift: string[] = [];

  for (const [href, html] of outputs) {
    const target = resolve(outDir, href);
    const expected = html.endsWith("\n") ? html : `${html}\n`;
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current !== expected) {
      drift.push(href);
    }
  }

  if (drift.length > 0) {
    throw new Error(
      `stale DB report output in ${relative(root, outDir)}: ${drift.join(", ")}`,
    );
  }
}

function runIndexEntry(
  listing: HellWeekReportListItem,
  href: string,
): ReportIndexEntry {
  return {
    id: listing.runId,
    title: `Hell Week ${listing.profile} run`,
    href,
    generatedAt: listing.generatedAt,
    kind: "hell-week-run",
    summary: listing.headline,
    details: [
      `${listing.totals.passed}/${listing.totals.scenarios} passed`,
      `${listing.totals.demoKillers} demo-killers`,
      `${listing.totals.dents} dents`,
      listing.judged ? "judged" : "deterministic",
      listing.verdict,
    ],
  };
}

function stabilityIndexEntry(
  listing: HellWeekStabilityReportListItem,
  href: string,
): ReportIndexEntry {
  return {
    id: listing.setId,
    title: listing.label,
    href,
    generatedAt: listing.generatedAt,
    kind: "stability",
    summary: `${listing.runCount} run(s), ${listing.scenarioCount} scenario(s): ${listing.summary.stableFailure} stable failure(s), ${listing.summary.recurringFailure} recurring failure(s), ${listing.summary.oneOffFailure} one-off failure(s).`,
    details: [
      `${listing.summary.stablePass} stable passes`,
      `${listing.summary.stableFailure} stable failures`,
      `${listing.summary.recurringFailure} recurring failures`,
      `${listing.summary.oneOffFailure} one-off failures`,
      `${listing.summary.mixed} mixed`,
    ],
  };
}

function renderReportsIndex(entries: ReportIndexEntry[]): string {
  const rows = entries
    .map(
      (entry) => `<li>
        <a href="${escapeHtml(reportRouteHref(entry.href))}">
          <strong>${escapeHtml(entry.title)}</strong>
          <span>${escapeHtml(formatTimestamp(entry.generatedAt))} - ${escapeHtml(entry.summary)}</span>
          <small>${entry.details.map(escapeHtml).join(" - ")}</small>
        </a>
      </li>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>LoanSlam private reports</title>
  <style>
    :root{--ink:#1c1f23;--muted:#6b7280;--line:#e4e7ec;--bg:#fff;--accent:#1f6feb}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:920px;margin:0 auto;padding:48px 24px 80px}
    h1{font-size:1.55rem;margin:.1rem 0 .5rem}
    p{color:var(--muted);max-width:68ch}
    ul{list-style:none;margin:30px 0 0;padding:0;border-top:1px solid var(--line)}
    li{border-bottom:1px solid var(--line)}
    a{display:block;padding:16px 0;color:inherit;text-decoration:none}
    a:hover strong{color:var(--accent)}
    .dashboard-link{display:inline-block;padding:8px 11px;border:1px solid var(--line);color:var(--accent)}
    strong,span,small{display:block}
    span{margin-top:3px;color:var(--muted)}
    small{margin-top:4px;color:#7b8490}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
  </style>
</head>
<body>
  <main>
    <p>LoanSlam</p>
    <h1>Private reports</h1>
    <p>Generated from persisted Hell Week run and stability records. Reports are listed newest first and include full report detail from the database.</p>
    <p><a class="dashboard-link" href="/reports/${trendDashboardPath}">Open Hell Week trends dashboard</a></p>
    <p>${entries.length} report${entries.length === 1 ? "" : "s"} generated.</p>
    <ul>
      ${rows || "<li><span>No persisted reports found.</span></li>"}
    </ul>
  </main>
</body>
</html>`;
}

function reportRouteHref(href: string): string {
  return `/reports/${href.replace(/^\/+/, "")}`;
}

function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function formatTimestamp(value: string): string {
  return value.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function printHelp(): void {
  console.log(`Generate private /reports HTML from all persisted Hell Week DB records.

Usage:
  npm run reports:publish-db -- [--out var/reports] [--check]

Options:
  --out, --output-dir <dir>  output directory; default ${defaultOutputDir}
  --db <url>                 override DB URL; otherwise uses Hell Week DB env
  --check                    verify generated files are current without writing
  --no-clean                 keep existing files in the output directory
  --force-clean              allow cleaning an unmarked output directory
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
