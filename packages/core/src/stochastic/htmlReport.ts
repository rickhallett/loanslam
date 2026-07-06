import type {
  StochasticCoverageReport,
  StochasticFinding,
  StochasticHardFailure,
  StochasticRunArtifact,
} from "@loanslam/contracts";
import { escapeHtml } from "../html";

export function renderStochasticDashboardHtml(
  report: StochasticRunArtifact,
): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(reportTitle(report))}</title>`,
    "<style>",
    dashboardCss(),
    "</style>",
    "</head>",
    "<body>",
    '<main class="shell">',
    hero(report),
    metrics(report),
    '<section class="grid two">',
    coveragePanel(report.coverage),
    hardFailurePanel(report.hardFailures),
    "</section>",
    '<section class="grid two">',
    findingsPanel(report.findings),
    riskPanel(report),
    "</section>",
    replayPanel(report),
    rawJsonPanel(report),
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

function reportTitle(report: StochasticRunArtifact): string {
  return `STS ${report.profile} ${report.seed}`;
}

function hero(report: StochasticRunArtifact): string {
  return `
<section class="hero ${verdictTone(report.verdict)}">
  <div>
    <p class="eyebrow">LoanSlam Phase 0 Stochastic Test Simulator</p>
    <h1>${escapeHtml(report.profile)} run: ${label(report.verdict)}</h1>
    <p class="takeaway">${escapeHtml(practicalTakeaway(report))}</p>
  </div>
  <dl class="metadata">
    ${metadataRow("Seed", report.seed)}
    ${metadataRow("Generated", report.generatedAt)}
    ${metadataRow("Planner", `${report.planner.provider}/${report.planner.model}`)}
    ${metadataRow("Policy", report.policyVersion)}
  </dl>
</section>`;
}

function metrics(report: StochasticRunArtifact): string {
  const coverageGaps = report.coverage.coverageGaps.length;
  const hardFailureTone = report.hardFailures.length === 0 ? "ok" : "danger";
  const findingTone = report.findings.length === 0 ? "ok" : "warning";
  const gapTone = coverageGaps === 0 ? "ok" : "warning";

  return `
<section class="metric-grid" aria-label="Run metrics">
  ${metric("Scenarios", report.scenarioCount, "info")}
  ${metric("Hard failures", report.hardFailures.length, hardFailureTone)}
  ${metric("Findings", report.findings.length, findingTone)}
  ${metric("Coverage gaps", coverageGaps, gapTone)}
</section>`;
}

function coveragePanel(coverage: StochasticCoverageReport): string {
  const axisRows = Object.entries(coverage.axisCoverage).map(
    ([axis, entry]) => {
      if (entry === undefined) {
        return "";
      }

      const total = entry.coveredValues.length + entry.missingValues.length;
      const percent =
        total === 0 ? 0 : (entry.coveredValues.length / total) * 100;

      return `
    <article class="axis-row">
      <div class="axis-head">
        <strong>${escapeHtml(axis)}</strong>
        <span>${entry.coveredValues.length}/${total} covered</span>
      </div>
      ${bar(percent, entry.missingValues.length === 0 ? "ok" : "warning")}
      <p>${valueList("Missing", entry.missingValues)}</p>
    </article>`;
    },
  );
  const hardFailureRows = coverage.hardFailureTemplateCoverage.map(
    (entry) => `
    <li>
      <span class="dot ${entry.covered ? "ok" : "warning"}"></span>
      <span>${escapeHtml(entry.category)}</span>
      <small>${entry.templateIds.length} sampled template(s)</small>
    </li>`,
  );

  return `
<section class="panel">
  <div class="panel-head">
    <h2>Coverage</h2>
    <span class="badge ${coverage.coverageGaps.length === 0 ? "ok" : "warning"}">${coverage.coverageGaps.length} gap(s)</span>
  </div>
  <div class="stack">
    ${axisRows.join("\n")}
  </div>
  <h3>Hard-Failure Template Coverage</h3>
  <ul class="compact-list">
    ${hardFailureRows.join("\n")}
  </ul>
</section>`;
}

function hardFailurePanel(
  hardFailures: readonly StochasticHardFailure[],
): string {
  const counts = countBy(hardFailures.map((failure) => failure.category)).sort(
    (left, right) => right.count - left.count,
  );
  const max = Math.max(1, ...counts.map((entry) => entry.count));
  const rows =
    counts.length === 0
      ? '<p class="empty">No hard failures observed.</p>'
      : counts
          .map(
            (entry) => `
    <article class="distribution-row">
      <div class="axis-head">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>${entry.count}</span>
      </div>
      ${bar((entry.count / max) * 100, "danger")}
    </article>`,
          )
          .join("\n");
  const details =
    hardFailures.length === 0
      ? ""
      : `
  <h3>Failure Details</h3>
  <ul class="detail-list">
    ${hardFailures.map(hardFailureItem).join("\n")}
  </ul>`;

  return `
<section class="panel">
  <div class="panel-head">
    <h2>Hard Failures</h2>
    <span class="badge ${hardFailures.length === 0 ? "ok" : "danger"}">${hardFailures.length}</span>
  </div>
  ${rows}
  ${details}
</section>`;
}

function findingsPanel(findings: readonly StochasticFinding[]): string {
  const body =
    findings.length === 0
      ? '<p class="empty">No behavioral findings were raised.</p>'
      : `<ul class="detail-list">${findings.map(findingItem).join("\n")}</ul>`;

  return `
<section class="panel">
  <div class="panel-head">
    <h2>Findings</h2>
    <span class="badge ${findings.length === 0 ? "ok" : "warning"}">${findings.length}</span>
  </div>
  ${body}
</section>`;
}

function riskPanel(report: StochasticRunArtifact): string {
  const items = [
    ...report.hardFailures.map((failure) => ({
      tone: "danger",
      title: failure.category,
      message: failure.message,
      scope: failure.scenarioPath,
      command: failure.replayCommand,
    })),
    ...report.findings.map((finding) => ({
      tone: "warning",
      title: finding.category,
      message: finding.message,
      scope:
        finding.scenarioPath ??
        finding.scenarioPaths?.slice(0, 3).join(", ") ??
        "run",
      command: finding.replayCommand,
    })),
    ...report.coverage.coverageGaps.slice(0, 6).map((gap) => ({
      tone: "warning",
      title: "coverage_gap",
      message: gap,
      scope: "coverage",
      command: undefined,
    })),
  ].slice(0, 10);
  const body =
    items.length === 0
      ? '<p class="empty">No immediate risks to review in this run.</p>'
      : `<ul class="detail-list">${items
          .map(
            (item) => `
    <li>
      <span class="badge ${item.tone}">${escapeHtml(item.title)}</span>
      <p>${escapeHtml(item.message)}</p>
      <small>${escapeHtml(item.scope)}</small>
      ${item.command ? `<code>${escapeHtml(item.command)}</code>` : ""}
    </li>`,
          )
          .join("\n")}
  </ul>`;

  return `
<section class="panel">
  <div class="panel-head">
    <h2>Review Queue</h2>
    <span class="badge info">${items.length} item(s)</span>
  </div>
  ${body}
</section>`;
}

function replayPanel(report: StochasticRunArtifact): string {
  const commands = [
    report.replay.fullRunCommand,
    ...report.replay.hardFailureCommands,
    ...report.replay.topFindingCommands,
  ];

  return `
<section class="panel">
  <div class="panel-head">
    <h2>Replay</h2>
    <span class="badge info">${commands.length} command(s)</span>
  </div>
  <div class="command-list">
    ${commands.map((command) => `<code>${escapeHtml(command)}</code>`).join("\n")}
  </div>
</section>`;
}

function rawJsonPanel(report: StochasticRunArtifact): string {
  return `
<section class="panel">
  <details>
    <summary>Raw Run JSON</summary>
    <pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>
  </details>
</section>`;
}

function metric(
  labelText: string,
  value: number,
  tone: "danger" | "info" | "ok" | "warning",
): string {
  return `
<article class="metric ${tone}">
  <span>${escapeHtml(labelText)}</span>
  <strong>${value}</strong>
</article>`;
}

function metadataRow(term: string, detail: string): string {
  return `
    <div>
      <dt>${escapeHtml(term)}</dt>
      <dd>${escapeHtml(detail)}</dd>
    </div>`;
}

function hardFailureItem(failure: StochasticHardFailure): string {
  return `
    <li>
      <span class="badge danger">${escapeHtml(failure.category)}</span>
      <p>${escapeHtml(failure.message)}</p>
      <small>${escapeHtml(failure.scenarioPath)}</small>
      ${failure.replayCommand ? `<code>${escapeHtml(failure.replayCommand)}</code>` : ""}
    </li>`;
}

function findingItem(finding: StochasticFinding): string {
  const scope =
    finding.scenarioPath ?? finding.scenarioPaths?.join(", ") ?? "run";

  return `
    <li>
      <span class="badge warning">${escapeHtml(finding.category)}</span>
      <p>${escapeHtml(finding.message)}</p>
      <small>${escapeHtml(scope)}</small>
      ${finding.replayCommand ? `<code>${escapeHtml(finding.replayCommand)}</code>` : ""}
    </li>`;
}

function bar(percent: number, tone: "danger" | "ok" | "warning"): string {
  return `<div class="bar ${tone}"><span style="width: ${clampPercent(percent)}%"></span></div>`;
}

function valueList(labelText: string, values: readonly string[]): string {
  if (values.length === 0) {
    return `${labelText}: none.`;
  }

  return `${labelText}: ${values.map(escapeHtml).join(", ")}.`;
}

function countBy(
  values: readonly string[],
): { label: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts].map(([labelText, count]) => ({ label: labelText, count }));
}

function label(value: string): string {
  return escapeHtml(value.replaceAll("_", " "));
}

function verdictTone(verdict: StochasticRunArtifact["verdict"]): string {
  if (verdict === "blocked") {
    return "danger";
  }

  if (verdict === "useful_with_findings") {
    return "warning";
  }

  return "ok";
}

function practicalTakeaway(report: StochasticRunArtifact): string {
  if (report.verdict === "blocked") {
    return "This run is blocked. Fix hard failures before presenting it as Phase 0 promotion evidence.";
  }

  if (report.verdict === "useful_with_findings") {
    return "This run is useful evidence, with findings or coverage gaps still needing review.";
  }

  return "This run has no hard failures and can support provisional v2 planning discussion.";
}

function clampPercent(value: number): string {
  return Math.max(0, Math.min(100, value)).toFixed(1);
}

function dashboardCss(): string {
  return `
:root {
  color-scheme: light;
  --ink: #17202a;
  --muted: #5d6d7e;
  --line: #d8dee9;
  --page: #f5f7fb;
  --panel: #ffffff;
  --danger: #c0392b;
  --danger-soft: #fdecea;
  --warning: #b9770e;
  --warning-soft: #fff4dc;
  --ok: #1e8449;
  --ok-soft: #e9f7ef;
  --info: #2874a6;
  --info-soft: #eaf3fb;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--page);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.5;
}

.shell {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0 48px;
}

.hero,
.panel,
.metric {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 12px 30px rgba(23, 32, 42, 0.06);
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
  gap: 28px;
  padding: 28px;
  border-top: 6px solid var(--info);
}

.hero.danger { border-top-color: var(--danger); }
.hero.warning { border-top-color: var(--warning); }
.hero.ok { border-top-color: var(--ok); }

.eyebrow {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 14px;
  font-size: clamp(2rem, 4vw, 4rem);
  line-height: 1.02;
}

h2 {
  margin-bottom: 0;
  font-size: 1.15rem;
}

h3 {
  margin: 22px 0 10px;
  color: var(--muted);
  font-size: 0.92rem;
}

.takeaway {
  max-width: 64ch;
  margin-bottom: 0;
  color: var(--muted);
  font-size: 1.04rem;
}

.metadata {
  display: grid;
  gap: 14px;
  margin: 0;
}

.metadata div {
  border-bottom: 1px solid var(--line);
  padding-bottom: 12px;
}

.metadata dt {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.metadata dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
  font-weight: 700;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin: 16px 0;
}

.metric {
  padding: 18px;
  border-left: 5px solid var(--info);
}

.metric span {
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 700;
  text-transform: uppercase;
}

.metric strong {
  display: block;
  margin-top: 8px;
  font-size: 2.2rem;
  line-height: 1;
}

.metric.danger { border-left-color: var(--danger); }
.metric.warning { border-left-color: var(--warning); }
.metric.ok { border-left-color: var(--ok); }
.metric.info { border-left-color: var(--info); }

.grid {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel {
  min-width: 0;
  padding: 22px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.badge.danger { background: var(--danger-soft); color: var(--danger); }
.badge.warning { background: var(--warning-soft); color: var(--warning); }
.badge.ok { background: var(--ok-soft); color: var(--ok); }
.badge.info { background: var(--info-soft); color: var(--info); }

.stack {
  display: grid;
  gap: 14px;
}

.axis-row,
.distribution-row {
  min-width: 0;
}

.axis-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.axis-head strong,
.axis-head span {
  overflow-wrap: anywhere;
}

.axis-head span,
.axis-row p,
small {
  color: var(--muted);
}

.axis-row p {
  margin: 6px 0 0;
  font-size: 0.88rem;
}

.bar {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf1f7;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--info);
}

.bar.danger span { background: var(--danger); }
.bar.warning span { background: var(--warning); }
.bar.ok span { background: var(--ok); }

.compact-list,
.detail-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.compact-list {
  display: grid;
  gap: 8px;
}

.compact-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--info);
}

.dot.ok { background: var(--ok); }
.dot.warning { background: var(--warning); }

.detail-list {
  display: grid;
  gap: 12px;
}

.detail-list li {
  display: grid;
  gap: 6px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.detail-list p {
  margin: 0;
}

code,
pre {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #101820;
  color: #f4f7fb;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

code {
  display: block;
  overflow-x: auto;
  padding: 9px 10px;
  font-size: 0.82rem;
}

.command-list {
  display: grid;
  gap: 10px;
}

details summary {
  cursor: pointer;
  font-weight: 800;
}

pre {
  margin: 16px 0 0;
  max-height: 460px;
  overflow: auto;
  padding: 16px;
  font-size: 0.82rem;
}

.empty {
  margin-bottom: 0;
  color: var(--muted);
}

@media (max-width: 820px) {
  .shell {
    width: min(100% - 20px, 1180px);
    padding-top: 10px;
  }

  .hero,
  .grid.two,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .hero,
  .panel {
    padding: 18px;
  }
}`;
}
