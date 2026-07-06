import type {
  HellWeekGrade,
  HellWeekReport,
  HellWeekScenarioEvidence,
  HellWeekTurnEvidence,
} from "./types";

/**
 * A homage renderer: the Hell Week run dressed up as the classic Jasmine 1.x
 * SpecRunner. Battery sections become suites, scenarios become specs, and a
 * failing scenario expands into the familiar pink "stack trace" inset.
 */
export function renderHellWeekJasmineHtml(report: HellWeekReport): string {
  const failures = report.totals.failed;
  const passing = failures === 0;

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Hell Week Spec Runner</title>`,
    "<style>",
    css(),
    "</style>",
    "</head>",
    "<body>",
    banner(report),
    `<div class="version">${escapeHtml(versionLine(report))}</div>`,
    runnerBar(report),
    summaryBar(report, passing),
    `<div class="specs">${suites(report)}</div>`,
    toggleScript(),
    "</body>",
    "</html>",
  ].join("\n");
}

function versionLine(report: HellWeekReport): string {
  return `Hell Week ${report.profile} · ${report.planner.provider}/${report.planner.model} · policy ${report.policyVersion}`;
}

function banner(report: HellWeekReport): string {
  void report;
  return `
<div class="banner">
  <span class="logo">${flower()}<span class="wordmark">Hell Week</span></span>
  <span class="powered">Powered by <strong>LoanSlam</strong></span>
</div>`;
}

function runnerBar(report: HellWeekReport): string {
  const total = report.totals.scenarios;
  return `
<div class="runner-bar">
  <span>Ran ${total} of ${total} scenarios &mdash; <a href="#" onclick="return false">run all</a></span>
  <label class="show-passed"><input type="checkbox" id="show-passed" checked> show passed</label>
</div>`;
}

function summaryBar(report: HellWeekReport, passing: boolean): string {
  const t = report.totals;
  const cls = passing ? "passing" : "failing";
  const dk =
    t.demoKillers > 0
      ? `, <strong>${t.demoKillers} demo-killer${t.demoKillers === 1 ? "" : "s"}</strong>`
      : "";
  const finished = report.generatedAt
    .replace("T", " ")
    .replace(/\..+/, "")
    .concat(" UTC");
  return `
<div class="summary-bar ${cls}">
  <span class="counts">${t.scenarios} scenarios, ${t.failed} failures${dk} in ${formatDuration(report.durationMs)}</span>
  <span class="finished">Finished at ${escapeHtml(finished)}</span>
</div>`;
}

function suites(report: HellWeekReport): string {
  const evidenceById = new Map<string, HellWeekScenarioEvidence>();
  for (const item of report.evidence) {
    evidenceById.set(item.scenarioId, item);
  }

  const byCategory = new Map<string, HellWeekGrade[]>();
  for (const grade of report.grades) {
    const list = byCategory.get(grade.category) ?? [];
    list.push(grade);
    byCategory.set(grade.category, list);
  }

  return [...byCategory.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([category, grades]) => {
      const title = grades[0]?.categoryTitle ?? category;
      const fails = grades.filter((g) => !g.pass).length;
      const suiteClass =
        fails === 0 ? "suite all-passed" : "suite has-failures";
      const specs = grades
        .map((grade) => spec(grade, evidenceById.get(grade.scenarioId)))
        .join("");
      return `
  <div class="${suiteClass}">
    <div class="suite-head">
      <a class="description ${fails === 0 ? "passed" : "failed"}" href="#" onclick="return false">${escapeHtml(title)}</a>
      <span class="run">run</span>
    </div>
    <div class="suite-body">${specs}</div>
  </div>`;
    })
    .join("");
}

function spec(
  grade: HellWeekGrade,
  evidence: HellWeekScenarioEvidence | undefined,
): string {
  const status = grade.pass ? "passed" : "failed";
  const detail = grade.pass ? "" : failureDetail(grade, evidence);
  const dkTag =
    grade.severity === "demo_killer"
      ? '<span class="dk-tag">demo-killer</span>'
      : "";
  return `
    <div class="spec ${status}">
      <div class="spec-head">
        <a class="description ${status}" href="#" onclick="return false">${escapeHtml(grade.title)}</a>
        ${dkTag}
        <span class="spec-id">${escapeHtml(grade.scenarioId)}</span>
        <span class="run">run</span>
      </div>
      ${detail}
    </div>`;
}

function failureDetail(
  grade: HellWeekGrade,
  evidence: HellWeekScenarioEvidence | undefined,
): string {
  const label =
    grade.severity === "demo_killer" ? "DemoKillerError" : "ExpectationError";
  const message = `${label}: ${grade.rationale}`;
  const lines = (evidence?.turns ?? []).flatMap((turn) => traceLines(turn));
  const stack = [message, ...lines].map(escapeHtml).join("\n");
  return `
      <div class="messages">
        <div class="result-message ${grade.severity}">${escapeHtml(message)}</div>
        <div class="stack-trace"><pre>${stack}</pre></div>
      </div>`;
}

function traceLines(turn: HellWeekTurnEvidence): string[] {
  const route = turn.routeForScoring ?? "—";
  const flags = turn.safetyFlags.length ? turn.safetyFlags.join(",") : "none";
  const planner = formatMaybeMs(turn.plannerLatencyMs);
  const signal = formatMaybeMs(turn.signalLatencyMs);
  const signalError = turn.signalError
    ? ` signalError=${turn.signalError}`
    : "";
  return [
    `    customer> ${oneLine(turn.userMessage)}`,
    `    bot> ${oneLine(turn.botMessage)}`,
    `      at action=${turn.finalAction} route=${route} flags=[${flags}] planner=${planner} signal=${signal}${signalError}`,
  ];
}

// ---------------------------------------------------------------------------

function flower(): string {
  const petals = Array.from({ length: 8 }, (_, index) => {
    const angle = index * 45;
    return `<ellipse cx="50" cy="26" rx="12" ry="22" transform="rotate(${angle} 50 50)"/>`;
  }).join("");
  return `
<svg class="flower" width="30" height="30" viewBox="0 0 100 100" aria-hidden="true">
  <g fill="#8a4f9e">${petals}</g>
  <circle cx="50" cy="50" r="15" fill="#ffffff"/>
  <circle cx="50" cy="50" r="9" fill="#8a4f9e"/>
</svg>`;
}

function toggleScript(): string {
  return `
<script>
(function () {
  var box = document.getElementById('show-passed');
  if (!box) return;
  function apply() {
    document.body.classList.toggle('hide-passed', !box.checked);
  }
  box.addEventListener('change', apply);
  apply();
})();
</script>`;
}

function rank(category: string): number {
  return category === "smoke" ? -1 : category.charCodeAt(0);
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 200 ? `${flat.slice(0, 199)}…` : flat;
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `${(ms / 1000).toFixed(3)}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatMaybeMs(value: number | undefined): string {
  return typeof value === "number" ? formatDuration(value) : "n/a";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function css(): string {
  return `
body{
  margin:0;padding:0 0 40px;background:#fff;color:#333;
  font:14px/1.5 "Helvetica Neue",Helvetica,Arial,sans-serif;
}
a{color:inherit}
/* banner */
.banner{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 16px;background:#fbf7fd;border-bottom:1px solid #e6d9ee;
}
.logo{display:flex;align-items:center;gap:8px}
.flower{display:block}
.wordmark{font-size:30px;font-weight:400;color:#8a4f9e;letter-spacing:.5px;font-family:Georgia,"Times New Roman",serif}
.powered{color:#9b9b9b;font-size:13px}
.powered strong{color:#8a4f9e;font-weight:600}
.version{padding:4px 16px;color:#aaa;font-size:11px;background:#fbf7fd;border-bottom:1px solid #f0e8f5}
/* runner + summary bars */
.runner-bar{
  display:flex;align-items:center;justify-content:space-between;
  padding:7px 16px;background:#5e5e5e;color:#fff;font-size:13px;
}
.runner-bar a{color:#fff;text-decoration:underline}
.show-passed{display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer}
.summary-bar{
  display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;
  padding:9px 16px;font-size:15px;border-bottom:1px solid rgba(0,0,0,.15);
}
.summary-bar .counts{font-weight:700}
.summary-bar .finished{font-size:12px;opacity:.85;font-weight:400}
.summary-bar.passing{background:#a6b779;color:#1a2e00}
.summary-bar.failing{background:#cf867e;color:#3a0a06}
.summary-bar.failing .counts strong{color:#7a0c00}
/* specs */
.specs{padding:10px 16px 0}
.suite{margin:0 0 2px}
.suite-head{display:flex;align-items:center;gap:10px;padding:5px 0}
.suite-head .description{font-size:15px;font-weight:600;text-decoration:none;font-family:Georgia,serif}
.suite-body{margin-left:18px;padding-left:14px;border-left:1px solid #e7e7e7}
.spec{padding:2px 0}
.spec-head{display:flex;align-items:center;gap:10px;padding:3px 0}
.description{font-family:Georgia,"Times New Roman",serif;text-decoration:underline;cursor:pointer}
.description.passed{color:#137a13}
.description.failed{color:#a31919}
.spec-id{color:#bbb;font-size:11px;font-family:ui-monospace,Menlo,monospace}
.run{margin-left:auto;color:#9b9b9b;font-size:12px;text-decoration:underline}
.dk-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#fff;background:#a31919;border-radius:3px;padding:1px 5px}
/* failure detail */
.messages{margin:4px 0 8px 6px}
.result-message{font-family:Georgia,serif;font-size:13px;margin-bottom:5px}
.result-message.demo_killer{color:#7a0c00;font-weight:700}
.result-message.dent{color:#a31919}
.stack-trace{
  background:#eeeef6;border:1px solid #d7d7e6;border-radius:2px;
  max-height:180px;overflow:auto;
}
.stack-trace pre{
  margin:0;padding:8px 10px;font-family:ui-monospace,Menlo,Consolas,monospace;
  font-size:11.5px;line-height:1.55;color:#444;white-space:pre;
}
/* boxed homage when failing: tint the failing spec/suite */
.spec.failed{background:#fdeceb;border:1px solid #e9b4b0;border-radius:3px;margin:3px 0;padding:2px 8px}
.spec.passed{background:#eef6e9;border:1px solid #cfe2bf;border-radius:3px;margin:3px 0;padding:1px 8px}
.suite.has-failures>.suite-head .description{color:#a31919}
.suite.all-passed>.suite-head .description{color:#137a13}
/* show/hide passed */
body.hide-passed .spec.passed{display:none}
body.hide-passed .suite.all-passed{display:none}
`;
}
