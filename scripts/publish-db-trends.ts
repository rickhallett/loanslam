#!/usr/bin/env tsx
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  openHellWeekReportStore,
  type HellWeekReportStore,
} from "../packages/core/src/hellweek/db";
import type { HellWeekReport, Severity } from "../packages/core/src/hellweek/types";

type TrendMetricKey =
  | "passRate"
  | "passed"
  | "failed"
  | "demoKillers"
  | "dents"
  | "errored"
  | "safetyFloorRate"
  | "routingPrecisionRate"
  | "deflectionRate"
  | "uxAverageScore"
  | "scenarioMedianMs"
  | "scenarioP95Ms"
  | "signalAgreementRate"
  | "signalErrors";

interface TrendRun {
  runId: string;
  href: string;
  generatedAt: string;
  label: string;
  profile: string;
  judged: boolean;
  verdict: HellWeekReport["verdict"];
  headline: string;
  totals: {
    scenarios: number;
    passed: number;
    failed: number;
    passRate: number | null;
    demoKillers: number;
    dents: number;
    fine: number;
    errored: number;
  };
  metrics: Record<TrendMetricKey, number | null>;
  categories: TrendBucket[];
  dimensions: TrendBucket[];
  scenarios: TrendScenarioOutcome[];
}

interface TrendBucket {
  id: string;
  label: string;
  pass: number;
  total: number;
  rate: number | null;
  demoKillers: number;
  dents: number;
}

interface TrendScenarioOutcome {
  id: string;
  title: string;
  category: string;
  categoryTitle: string;
  dimension: string;
  pass: boolean;
  severity: Severity;
  triageLabels: string[];
}

interface TrendPayload {
  generatedAt: string | null;
  runCount: number;
  profiles: string[];
  runs: TrendRun[];
}

const root = resolve(import.meta.dirname, "..");
const defaultOutputFile = "var/reports/trends.html";
export const trendDashboardPath = "trends.html";

async function main(): Promise<void> {
  const options = parseArgs(
    process.argv.slice(2).filter((arg) => arg !== "--"),
  );
  if (options.help) {
    printHelp();
    return;
  }

  const outFile = resolve(root, options.outputFile);
  const store = openHellWeekReportStore(options.databaseUrl);

  try {
    const reports = await loadAllReports(store);
    const html = renderHellWeekTrendDashboardHtml(reports);
    const expected = html.endsWith("\n") ? html : `${html}\n`;

    if (options.check) {
      const current = existsSync(outFile) ? readFileSync(outFile, "utf8") : null;
      if (current !== expected) {
        throw new Error(
          `stale Hell Week trends dashboard: ${relative(root, outFile)}`,
        );
      }
      console.log(`trends dashboard up to date: ${relative(root, outFile)}`);
      return;
    }

    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, expected, "utf8");
    console.log(`wrote ${relative(root, outFile)} from ${reports.length} run(s)`);
  } finally {
    await store.close();
  }
}

async function loadAllReports(
  store: HellWeekReportStore,
): Promise<HellWeekReport[]> {
  const listings = await store.listReports();
  const reports: HellWeekReport[] = [];

  for (const listing of listings) {
    const report = await store.loadReport(listing.runId);
    if (!report) {
      throw new Error(`DB listed missing Hell Week run ${listing.runId}.`);
    }
    reports.push(report);
  }

  return reports;
}

function parseArgs(rawArgs: string[]): {
  check: boolean;
  databaseUrl?: string;
  help: boolean;
  outputFile: string;
} {
  const parsed = {
    check: false,
    databaseUrl: undefined as string | undefined,
    help: false,
    outputFile: defaultOutputFile,
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
    if (arg === "--out" || arg === "--output-file") {
      parsed.outputFile = readRequiredValue(rawArgs, index, arg);
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

export function renderHellWeekTrendDashboardHtml(
  reports: readonly HellWeekReport[],
): string {
  const payload = reportsToTrendPayload(reports);

  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>LoanSlam Hell Week trends</title>
  <style>
    :root{
      color-scheme:light;
      --ink:#1d2430;
      --muted:#667085;
      --soft:#eef2f6;
      --line:#d9e1ea;
      --panel:#ffffff;
      --bg:#f7f9fb;
      --blue:#2563eb;
      --green:#087f5b;
      --amber:#b54708;
      --red:#b42318;
      --teal:#0f766e;
      --gray:#64748b;
    }
    *{box-sizing:border-box}
    html{-webkit-text-size-adjust:100%}
    body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:1280px;margin:0 auto;padding:28px 20px 56px}
    header{display:flex;gap:18px;align-items:flex-end;justify-content:space-between;margin:0 0 20px}
    h1{font-size:1.55rem;line-height:1.18;margin:0 0 4px}
    h2{font-size:1rem;margin:0 0 12px}
    p{margin:0;color:var(--muted)}
    a{color:var(--blue)}
    .nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .nav a{color:var(--ink);text-decoration:none;border:1px solid var(--line);background:var(--panel);padding:8px 10px}
    .controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 16px}
    label{display:block;color:var(--muted);font-size:.78rem;font-weight:700;text-transform:uppercase;margin:0 0 5px}
    select,input{width:100%;min-height:38px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;padding:7px 9px}
    .cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 16px}
    .card,.panel{background:var(--panel);border:1px solid var(--line)}
    .card{padding:14px}
    .card strong{display:block;font-size:1.45rem;line-height:1.1;margin:4px 0}
    .card span{display:block;color:var(--muted);font-size:.82rem;min-height:1.2em}
    .grid{display:grid;grid-template-columns:1.45fr .9fr;gap:12px}
    .panel{padding:16px;min-width:0}
    .full{grid-column:1 / -1}
    svg{display:block;width:100%;height:auto;overflow:visible}
    .chart-frame{min-height:300px}
    .axis{stroke:#aab4c0;stroke-width:1}
    .gridline{stroke:#e7edf3;stroke-width:1}
    .line{fill:none;stroke:var(--blue);stroke-width:3}
    .dot{fill:var(--panel);stroke:var(--blue);stroke-width:2}
    .dot.demo{stroke:var(--red)}
    .dot.dent{stroke:var(--amber)}
    .bar-fine{fill:var(--green)}
    .bar-dent{fill:var(--amber)}
    .bar-demo{fill:var(--red)}
    .bar-error{fill:var(--gray)}
    .legend{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 0;color:var(--muted);font-size:.82rem}
    .legend i{display:inline-block;width:10px;height:10px;margin-right:5px;vertical-align:-1px}
    .readout{margin-top:12px;min-height:42px;color:var(--muted)}
    table{width:100%;border-collapse:collapse;font-size:.86rem}
    th,td{border-bottom:1px solid var(--line);padding:8px 7px;text-align:left;vertical-align:top}
    th{color:var(--muted);font-size:.76rem;text-transform:uppercase}
    .num{text-align:right;font-variant-numeric:tabular-nums}
    .pill{display:inline-block;border:1px solid var(--line);padding:2px 7px;margin:0 4px 4px 0;color:var(--muted);font-size:.78rem}
    .spark{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:1px;white-space:nowrap}
    .heatmap{overflow:auto}
    .heat-grid{display:grid;gap:2px;min-width:720px}
    .heat-label{font-size:.78rem;color:var(--muted);padding:4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .heat-cell{height:24px;border:1px solid rgba(255,255,255,.72)}
    .empty{color:var(--muted);padding:20px 0}
    @media (max-width:900px){
      header{align-items:flex-start;flex-direction:column}
      .controls{grid-template-columns:repeat(2,minmax(0,1fr))}
      .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
      .grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p>LoanSlam private reports</p>
        <h1>Hell Week trends</h1>
        <p id="subtitle">Loading runs...</p>
      </div>
      <nav class="nav">
        <a href="/reports/">Report index</a>
      </nav>
    </header>

    <section class="controls" aria-label="Trend controls">
      <div>
        <label for="profile">Profile</label>
        <select id="profile"></select>
      </div>
      <div>
        <label for="metric">Metric</label>
        <select id="metric"></select>
      </div>
      <div>
        <label for="window">Window</label>
        <select id="window">
          <option value="all">All runs</option>
          <option value="12">Latest 12</option>
          <option value="24">Latest 24</option>
          <option value="36">Latest 36</option>
        </select>
      </div>
      <div>
        <label for="scenarioSearch">Scenario search</label>
        <input id="scenarioSearch" type="search" placeholder="Scenario, category, label">
      </div>
    </section>

    <section class="cards" id="cards"></section>

    <section class="grid">
      <section class="panel">
        <h2 id="lineTitle">Metric over time</h2>
        <div class="chart-frame" id="lineChart"></div>
        <p class="readout" id="lineReadout"></p>
      </section>
      <section class="panel">
        <h2>Severity mix</h2>
        <div class="chart-frame" id="severityChart"></div>
        <div class="legend">
          <span><i class="bar-fine"></i>Fine</span>
          <span><i class="bar-dent"></i>Dents</span>
          <span><i class="bar-demo"></i>Demo-killers</span>
          <span><i class="bar-error"></i>Errored</span>
        </div>
      </section>
      <section class="panel full">
        <h2>Category pass-rate heatmap</h2>
        <div class="heatmap" id="heatmap"></div>
      </section>
      <section class="panel full">
        <h2>Most frequent failing scenarios</h2>
        <div id="scenarioTable"></div>
      </section>
    </section>
  </main>
  <script id="trend-data" type="application/json">${jsonForScript(payload)}</script>
  <script>
(() => {
  const payload = JSON.parse(document.getElementById("trend-data").textContent || "{}");
  const metricDefs = {
    passRate: { label: "Pass rate", format: "percent", min: 0, max: 100 },
    passed: { label: "Passed scenarios", format: "count" },
    failed: { label: "Failed scenarios", format: "count" },
    demoKillers: { label: "Demo-killers", format: "count" },
    dents: { label: "Dents", format: "count" },
    errored: { label: "Errored scenarios", format: "count" },
    safetyFloorRate: { label: "Safety floor pass rate", format: "percent", min: 0, max: 100 },
    routingPrecisionRate: { label: "Routing precision", format: "percent", min: 0, max: 100 },
    deflectionRate: { label: "Deflection answer rate", format: "percent", min: 0, max: 100 },
    uxAverageScore: { label: "UX average score", format: "score", min: 0, max: 5 },
    scenarioMedianMs: { label: "Scenario p50 runtime", format: "ms" },
    scenarioP95Ms: { label: "Scenario p95 runtime", format: "ms" },
    signalAgreementRate: { label: "Signal agreement", format: "percent", min: 0, max: 100 },
    signalErrors: { label: "Signal errors", format: "count" }
  };
  const state = { profile: "all", metric: "passRate", window: "all", scenarioSearch: "" };
  const profileSelect = document.getElementById("profile");
  const metricSelect = document.getElementById("metric");
  const windowSelect = document.getElementById("window");
  const scenarioSearch = document.getElementById("scenarioSearch");

  function init() {
    const profiles = ["all"].concat(payload.profiles || []);
    profileSelect.innerHTML = profiles.map((profile) => "<option value=\"" + esc(profile) + "\">" + esc(profile === "all" ? "All profiles" : profile) + "</option>").join("");
    metricSelect.innerHTML = Object.keys(metricDefs).map((key) => "<option value=\"" + key + "\">" + metricDefs[key].label + "</option>").join("");
    profileSelect.addEventListener("change", () => { state.profile = profileSelect.value; update(); });
    metricSelect.addEventListener("change", () => { state.metric = metricSelect.value; update(); });
    windowSelect.addEventListener("change", () => { state.window = windowSelect.value; update(); });
    scenarioSearch.addEventListener("input", () => { state.scenarioSearch = scenarioSearch.value.trim().toLowerCase(); updateScenarioTable(filteredRuns()); });
    update();
  }

  function filteredRuns() {
    let runs = (payload.runs || []).filter((run) => state.profile === "all" || run.profile === state.profile);
    if (state.window !== "all") {
      runs = runs.slice(Math.max(0, runs.length - Number(state.window)));
    }
    return runs;
  }

  function update() {
    const runs = filteredRuns();
    document.getElementById("subtitle").textContent = subtitle(runs);
    updateCards(runs);
    drawLineChart(runs);
    drawSeverityChart(runs);
    drawHeatmap(runs);
    updateScenarioTable(runs);
  }

  function subtitle(runs) {
    if (!runs.length) return "No persisted Hell Week runs matched the current filters.";
    return runs.length + " run" + (runs.length === 1 ? "" : "s") + " from " + shortDate(runs[0].generatedAt) + " to " + shortDate(runs[runs.length - 1].generatedAt) + ".";
  }

  function updateCards(runs) {
    const latest = runs[runs.length - 1];
    const best = runs.reduce((winner, run) => !winner || value(run, "passRate") > value(winner, "passRate") ? run : winner, null);
    const cards = [
      ["Runs", String(runs.length), state.profile === "all" ? "all profiles" : state.profile],
      ["Latest pass rate", latest ? fmt(value(latest, "passRate"), "percent") : "n/a", latest ? latest.label : ""],
      ["Best pass rate", best ? fmt(value(best, "passRate"), "percent") : "n/a", best ? best.label : ""],
      ["Latest dents", latest ? String(latest.totals.dents) : "n/a", latest ? latest.verdict : ""],
      ["Latest demo-killers", latest ? String(latest.totals.demoKillers) : "n/a", latest ? latest.headline : ""]
    ];
    document.getElementById("cards").innerHTML = cards.map((card) => "<article class=\"card\"><span>" + esc(card[0]) + "</span><strong>" + esc(card[1]) + "</strong><span>" + esc(card[2]) + "</span></article>").join("");
  }

  function drawLineChart(runs) {
    const metric = metricDefs[state.metric];
    document.getElementById("lineTitle").textContent = metric.label + " over time";
    if (!runs.length) {
      document.getElementById("lineChart").innerHTML = "<p class=\"empty\">No runs to chart.</p>";
      document.getElementById("lineReadout").textContent = "";
      return;
    }
    const width = 960, height = 310, left = 54, right = 18, top = 18, bottom = 44;
    const values = runs.map((run) => value(run, state.metric)).filter((item) => item !== null && Number.isFinite(item));
    const domainMin = metric.min ?? Math.min(0, Math.min(...values));
    const domainMax = metric.max ?? niceMax(Math.max(...values, 1));
    const xStep = runs.length > 1 ? (width - left - right) / (runs.length - 1) : 0;
    const points = runs.map((run, index) => {
      const raw = value(run, state.metric);
      const yValue = raw === null ? domainMin : raw;
      return {
        run,
        raw,
        x: left + xStep * index,
        y: top + (domainMax - yValue) / Math.max(1, domainMax - domainMin) * (height - top - bottom)
      };
    });
    const path = points.filter((point) => point.raw !== null).map((point, index) => (index === 0 ? "M" : "L") + point.x.toFixed(1) + " " + point.y.toFixed(1)).join(" ");
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const valueAtTick = domainMax - (domainMax - domainMin) * ratio;
      const y = top + (height - top - bottom) * ratio;
      return "<line class=\"gridline\" x1=\"" + left + "\" x2=\"" + (width - right) + "\" y1=\"" + y + "\" y2=\"" + y + "\"></line><text x=\"8\" y=\"" + (y + 4) + "\" fill=\"#667085\" font-size=\"12\">" + esc(fmt(valueAtTick, metric.format)) + "</text>";
    }).join("");
    const dots = points.map((point) => {
      if (point.raw === null) return "";
      const cls = point.run.totals.demoKillers > 0 ? "demo" : point.run.totals.dents > 0 ? "dent" : "";
      const title = point.run.label + " - " + fmt(point.raw, metric.format) + " - " + point.run.headline;
      return "<a href=\"" + esc(point.run.href) + "\"><circle class=\"dot " + cls + "\" cx=\"" + point.x.toFixed(1) + "\" cy=\"" + point.y.toFixed(1) + "\" r=\"5\"><title>" + esc(title) + "</title></circle></a>";
    }).join("");
    const labels = axisLabels(points, height, bottom);
    document.getElementById("lineChart").innerHTML = "<svg viewBox=\"0 0 " + width + " " + height + "\" role=\"img\" aria-label=\"" + esc(metric.label) + " trend\"><line class=\"axis\" x1=\"" + left + "\" x2=\"" + (width - right) + "\" y1=\"" + (height - bottom) + "\" y2=\"" + (height - bottom) + "\"></line><line class=\"axis\" x1=\"" + left + "\" x2=\"" + left + "\" y1=\"" + top + "\" y2=\"" + (height - bottom) + "\"></line>" + yTicks + "<path class=\"line\" d=\"" + path + "\"></path>" + dots + labels + "</svg>";
    const latest = runs[runs.length - 1];
    document.getElementById("lineReadout").innerHTML = latest ? "<a href=\"" + esc(latest.href) + "\">Latest run</a>: " + esc(latest.label + " - " + metric.label + " " + fmt(value(latest, state.metric), metric.format) + ". " + latest.headline) : "";
  }

  function drawSeverityChart(runs) {
    const chartRuns = runs.slice(Math.max(0, runs.length - 36));
    if (!chartRuns.length) {
      document.getElementById("severityChart").innerHTML = "<p class=\"empty\">No runs to chart.</p>";
      return;
    }
    const width = 720, height = 300, left = 36, right = 10, top = 16, bottom = 36;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    const maxTotal = Math.max(...chartRuns.map((run) => run.totals.scenarios), 1);
    const gap = 3;
    const barW = Math.max(3, (plotW - gap * (chartRuns.length - 1)) / chartRuns.length);
    const bars = chartRuns.map((run, index) => {
      const x = left + index * (barW + gap);
      let y = top + plotH;
      const parts = [
        ["bar-fine", run.totals.fine],
        ["bar-dent", run.totals.dents],
        ["bar-demo", run.totals.demoKillers],
        ["bar-error", run.totals.errored]
      ];
      const rects = parts.map((part) => {
        const h = part[1] / maxTotal * plotH;
        y -= h;
        return "<rect class=\"" + part[0] + "\" x=\"" + x.toFixed(1) + "\" y=\"" + y.toFixed(1) + "\" width=\"" + barW.toFixed(1) + "\" height=\"" + Math.max(0, h).toFixed(1) + "\"><title>" + esc(run.label + " - " + part[1] + " " + part[0].replace("bar-", "")) + "</title></rect>";
      }).join("");
      return "<a href=\"" + esc(run.href) + "\">" + rects + "</a>";
    }).join("");
    document.getElementById("severityChart").innerHTML = "<svg viewBox=\"0 0 " + width + " " + height + "\"><line class=\"axis\" x1=\"" + left + "\" x2=\"" + (width - right) + "\" y1=\"" + (height - bottom) + "\" y2=\"" + (height - bottom) + "\"></line><text x=\"6\" y=\"24\" fill=\"#667085\" font-size=\"12\">" + maxTotal + "</text>" + bars + "</svg>";
  }

  function drawHeatmap(runs) {
    const chartRuns = runs.slice(Math.max(0, runs.length - 18));
    if (!chartRuns.length) {
      document.getElementById("heatmap").innerHTML = "<p class=\"empty\">No runs to chart.</p>";
      return;
    }
    const categoryMap = new Map();
    chartRuns.forEach((run) => {
      run.categories.forEach((category) => {
        if (!categoryMap.has(category.id)) categoryMap.set(category.id, category.label);
      });
    });
    const categories = Array.from(categoryMap.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const cols = chartRuns.length + 1;
    const rows = ["<div class=\"heat-label\"></div>"].concat(chartRuns.map((run) => "<div class=\"heat-label\" title=\"" + esc(run.runId) + "\">" + esc(shortRun(run)) + "</div>"));
    categories.forEach(([id, label]) => {
      rows.push("<div class=\"heat-label\" title=\"" + esc(label) + "\">" + esc(id + " - " + label) + "</div>");
      chartRuns.forEach((run) => {
        const category = run.categories.find((item) => item.id === id);
        const rate = category ? category.rate : null;
        rows.push("<div class=\"heat-cell\" style=\"background:" + heatColor(rate) + "\" title=\"" + esc(run.label + " - " + label + " - " + fmt(rate, "percent")) + "\"></div>");
      });
    });
    document.getElementById("heatmap").innerHTML = "<div class=\"heat-grid\" style=\"grid-template-columns:190px repeat(" + chartRuns.length + ", minmax(34px,1fr));\">" + rows.join("") + "</div>";
  }

  function updateScenarioTable(runs) {
    const scenarioMap = new Map();
    runs.forEach((run) => {
      run.scenarios.forEach((scenario) => {
        const text = (scenario.id + " " + scenario.title + " " + scenario.categoryTitle + " " + scenario.dimension + " " + scenario.triageLabels.join(" ")).toLowerCase();
        if (state.scenarioSearch && !text.includes(state.scenarioSearch)) return;
        if (!scenarioMap.has(scenario.id)) {
          scenarioMap.set(scenario.id, {
            id: scenario.id,
            title: scenario.title,
            category: scenario.category,
            dimension: scenario.dimension,
            failures: 0,
            demoKillers: 0,
            dents: 0,
            labels: new Map(),
            outcomes: []
          });
        }
        const row = scenarioMap.get(scenario.id);
        row.outcomes.push(scenario.pass ? "." : scenario.severity === "demo_killer" ? "!" : "x");
        if (!scenario.pass) {
          row.failures += 1;
          if (scenario.severity === "demo_killer") row.demoKillers += 1;
          if (scenario.severity === "dent") row.dents += 1;
          scenario.triageLabels.forEach((label) => row.labels.set(label, (row.labels.get(label) || 0) + 1));
        }
      });
    });
    const rows = Array.from(scenarioMap.values()).filter((row) => row.failures > 0).sort((a, b) => b.demoKillers - a.demoKillers || b.failures - a.failures || a.id.localeCompare(b.id)).slice(0, 24);
    if (!rows.length) {
      document.getElementById("scenarioTable").innerHTML = "<p class=\"empty\">No failing scenarios match the current filters.</p>";
      return;
    }
    document.getElementById("scenarioTable").innerHTML = "<table><thead><tr><th>Scenario</th><th>Dimension</th><th class=\"num\">Fails</th><th class=\"num\">Demo</th><th>Recent</th><th>Triage</th></tr></thead><tbody>" + rows.map((row) => {
      const labels = Array.from(row.labels.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map((entry) => "<span class=\"pill\">" + esc(entry[0]) + " " + entry[1] + "</span>").join("");
      return "<tr><td><strong>" + esc(row.id) + "</strong><br>" + esc(row.title) + "</td><td>" + esc(row.dimension) + "</td><td class=\"num\">" + row.failures + "</td><td class=\"num\">" + row.demoKillers + "</td><td class=\"spark\">" + esc(row.outcomes.slice(-30).join("")) + "</td><td>" + labels + "</td></tr>";
    }).join("") + "</tbody></table>";
  }

  function axisLabels(points, height, bottom) {
    if (points.length === 0) return "";
    const wanted = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);
    return points.filter((_, index) => wanted.has(index)).map((point) => "<text x=\"" + point.x.toFixed(1) + "\" y=\"" + (height - bottom + 22) + "\" text-anchor=\"middle\" fill=\"#667085\" font-size=\"12\">" + esc(shortDate(point.run.generatedAt)) + "</text>").join("");
  }

  function value(run, key) {
    return run.metrics && run.metrics[key] !== undefined ? run.metrics[key] : null;
  }

  function fmt(value, format) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "n/a";
    if (format === "percent") return Math.round(Number(value) * 10) / 10 + "%";
    if (format === "ms") return Math.round(Number(value)) + " ms";
    if (format === "score") return Math.round(Number(value) * 100) / 100 + " / 5";
    return String(Math.round(Number(value) * 100) / 100);
  }

  function niceMax(value) {
    if (!Number.isFinite(value) || value <= 0) return 1;
    const power = Math.pow(10, Math.floor(Math.log10(value)));
    return Math.ceil(value / power) * power;
  }

  function heatColor(rate) {
    if (rate === null || rate === undefined) return "#e5e7eb";
    const clamped = Math.max(0, Math.min(100, Number(rate)));
    const red = clamped < 50 ? 180 : Math.round(180 - (clamped - 50) * 2.1);
    const green = clamped < 50 ? Math.round(70 + clamped * 2.4) : 150;
    const blue = 92;
    return "rgb(" + red + "," + green + "," + blue + ")";
  }

  function shortDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "unknown");
    return date.toISOString().slice(5, 10);
  }

  function shortRun(run) {
    return shortDate(run.generatedAt) + " " + run.profile;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      if (char === "&") return "&amp;";
      if (char === "<") return "&lt;";
      if (char === ">") return "&gt;";
      if (char === '"') return "&quot;";
      return "&#39;";
    });
  }

  init();
})();
  </script>
</body>
</html>`;
}

function reportsToTrendPayload(
  reports: readonly HellWeekReport[],
): TrendPayload {
  const runs = reports
    .map(trendRun)
    .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
  const profiles = [...new Set(runs.map((run) => run.profile))].sort();

  return {
    generatedAt: runs.at(-1)?.generatedAt ?? null,
    runCount: runs.length,
    profiles,
    runs,
  };
}

function trendRun(report: HellWeekReport): TrendRun {
  const scenarioById = new Map<string, HellWeekReport["scenarios"][number]>(
    report.scenarios.map((scenario) => [scenario.id, scenario]),
  );

  return {
    runId: report.runId,
    href: `/reports/runs/${safeSlug(report.runId)}.html`,
    generatedAt: report.generatedAt,
    label: formatRunLabel(report),
    profile: report.profile,
    judged: report.judged,
    verdict: report.verdict,
    headline: report.headline,
    totals: {
      scenarios: numberValue(report.totals.scenarios),
      passed: numberValue(report.totals.passed),
      failed: numberValue(report.totals.failed),
      passRate: percentValue(report.totals.passRate),
      demoKillers: numberValue(report.totals.demoKillers),
      dents: numberValue(report.totals.dents),
      fine: numberValue(report.totals.fine),
      errored: numberValue(report.totals.errored),
    },
    metrics: {
      passRate: percentValue(report.totals.passRate),
      passed: numberValue(report.totals.passed),
      failed: numberValue(report.totals.failed),
      demoKillers: numberValue(report.totals.demoKillers),
      dents: numberValue(report.totals.dents),
      errored: numberValue(report.totals.errored),
      safetyFloorRate: rateValue(report.safetyFloor?.pass, report.safetyFloor?.total),
      routingPrecisionRate: percentValue(report.routingPrecision?.rate),
      deflectionRate: percentValue(report.deflection?.rate),
      uxAverageScore: nullableNumber(report.uxQuality?.averageScore),
      scenarioMedianMs: nullableNumber(report.runtime?.scenarioWallTimeMs?.medianMs),
      scenarioP95Ms: nullableNumber(report.runtime?.scenarioWallTimeMs?.p95Ms),
      signalAgreementRate: percentValue(report.routingPrecision?.signalAgreementRate),
      signalErrors: nullableNumber(report.runtime?.signalErrors),
    },
    categories: report.categories.map((category) => ({
      id: category.category,
      label: category.categoryTitle,
      pass: numberValue(category.pass),
      total: numberValue(category.total),
      rate: rateValue(category.pass, category.total),
      demoKillers: numberValue(category.demoKillers),
      dents: numberValue(category.dents),
    })),
    dimensions: report.dimensions.map((dimension) => ({
      id: dimension.dimension,
      label: dimension.label,
      pass: numberValue(dimension.pass),
      total: numberValue(dimension.total),
      rate: rateValue(dimension.pass, dimension.total),
      demoKillers: numberValue(dimension.demoKillers),
      dents: numberValue(dimension.dents),
    })),
    scenarios: report.grades.map((grade) => {
      const scenario = scenarioById.get(grade.scenarioId);
      return {
        id: grade.scenarioId,
        title: grade.title,
        category: grade.category,
        categoryTitle: grade.categoryTitle,
        dimension: grade.dimension,
        pass: grade.pass,
        severity: grade.severity,
        triageLabels: grade.triageLabels,
        ...(scenario
          ? {
              category: scenario.category,
              categoryTitle: scenario.categoryTitle,
              title: scenario.title,
              dimension: scenario.dimension,
            }
          : {}),
      };
    }),
  };
}

function formatRunLabel(report: HellWeekReport): string {
  return `${report.profile} ${formatTimestamp(report.generatedAt)}`;
}

function formatTimestamp(value: string): string {
  return value.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function percentValue(value: unknown): number | null {
  const number = nullableNumber(value);
  if (number === null) {
    return null;
  }
  return number <= 1 ? number * 100 : number;
}

function rateValue(pass: unknown, total: unknown): number | null {
  const passCount = nullableNumber(pass);
  const totalCount = nullableNumber(total);
  if (passCount === null || totalCount === null || totalCount <= 0) {
    return null;
  }
  return (passCount / totalCount) * 100;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberValue(value: unknown): number {
  return nullableNumber(value) ?? 0;
}

function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function printHelp(): void {
  console.log(`Generate an interactive Hell Week trend dashboard from persisted DB runs.

Usage:
  npm run reports:publish-trends -- [--out var/reports/trends.html] [--check]

Options:
  --out, --output-file <file>  output HTML file; default ${defaultOutputFile}
  --db <url>                   override DB URL; otherwise uses Hell Week DB env
  --check                      verify the dashboard is current without writing
`);
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
