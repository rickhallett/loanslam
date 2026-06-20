import type {
  CategoryStat,
  DimensionStat,
  HellWeekGrade,
  HellWeekReport,
  HellWeekScenario,
  HellWeekScenarioEvidence,
  HellWeekTurnEvidence,
  RiskItem,
  Severity,
} from "./types";

type Tone = "neg" | "warn" | "pos" | "mute";

export function renderHellWeekReportHtml(report: HellWeekReport): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Hell Week report — ${escapeHtml(report.runId)}</title>`,
    "<style>",
    css(),
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    header(report),
    keyFigures(report),
    safetyFloor(report),
    sectionTable(report),
    dimensionTable(report),
    failureBreakdown(report),
    findings(report),
    allScenarios(report),
    footer(report),
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

// ---------------------------------------------------------------------------

function verdictTone(verdict: HellWeekReport["verdict"]): Tone {
  if (verdict === "blocked") return "neg";
  if (verdict === "needs_work") return "warn";
  return "pos";
}

function verdictWord(verdict: HellWeekReport["verdict"]): string {
  if (verdict === "blocked") return "Blocked";
  if (verdict === "needs_work") return "Needs work";
  return "Ship-ready";
}

function header(report: HellWeekReport): string {
  const grading = report.judged
    ? "Independent LLM judge"
    : "Deterministic backstops only";
  return `
<header>
  <p class="kicker">LoanSlam · Hell Week</p>
  <h1>${escapeHtml(profileLabel(report.profile))} report</h1>
  <p class="verdict">Verdict: <span class="${verdictTone(report.verdict)}">${escapeHtml(verdictWord(report.verdict))}</span></p>
  <p class="summary">${escapeHtml(report.headline)}</p>
  <dl class="meta">
    ${metaItem("Scenarios", String(report.totals.scenarios))}
    ${metaItem("Planner", `${report.planner.provider}/${report.planner.model}`)}
    ${metaItem("Signals", report.signalExtractor.enabled ? (report.signalExtractor.model ?? "on") : "off")}
    ${metaItem("Grading", grading)}
    ${metaItem("Policy", report.policyVersion)}
    ${metaItem("Generated", report.generatedAt.replace("T", " ").replace(/\..+/, " UTC"))}
    ${metaItem("Duration", formatDuration(report.durationMs))}
  </dl>
</header>`;
}

function profileLabel(profile: string): string {
  if (profile === "smoke") return "Smoke gate";
  if (profile === "full") return "Full gauntlet";
  return profile;
}

// ---------------------------------------------------------------------------

function keyFigures(report: HellWeekReport): string {
  const t = report.totals;
  const r = report.routingPrecision;
  const figures: { label: string; value: string; tone?: Tone }[] = [
    { label: "Passed", value: `${t.passed}/${t.scenarios}` },
    {
      label: "Demo-killers",
      value: String(t.demoKillers),
      tone: t.demoKillers > 0 ? "neg" : "pos",
    },
    {
      label: "Dents",
      value: String(t.dents),
      tone: t.dents > 0 ? "warn" : "pos",
    },
    {
      label: "Deflection",
      value: report.deflection.total === 0 ? "—" : pct(report.deflection.rate),
    },
    { label: "Routing precision", value: pct(r.rate) },
    {
      label: "Signal agreement",
      value: r.signalTurns === 0 ? "—" : pct(r.signalAgreementRate),
    },
    {
      label: "Avg UX",
      value:
        report.uxQuality.averageScore === null
          ? "—"
          : `${report.uxQuality.averageScore.toFixed(1)}/5`,
    },
  ];
  return `
<section class="figures">
  ${figures
    .map(
      (figure) => `
  <div class="figure">
    <span class="fig-val ${figure.tone ?? ""}">${escapeHtml(figure.value)}</span>
    <span class="fig-label">${escapeHtml(figure.label)}</span>
  </div>`,
    )
    .join("")}
</section>`;
}

// ---------------------------------------------------------------------------

function safetyFloor(report: HellWeekReport): string {
  const floor = report.safetyFloor;
  const tone: Tone = floor.breached ? "neg" : "pos";
  const status = floor.breached ? "Breached" : "Holding";

  const dimRows = floor.dimensions
    .map(
      (dimension) => `
    <tr>
      <td>${escapeHtml(dimension.label)}</td>
      <td class="num">${dimension.pass}/${dimension.total}</td>
      <td class="num">${dimension.demoKillers > 0 ? `<span class="neg">${dimension.demoKillers}</span>` : "0"}</td>
    </tr>`,
    )
    .join("");

  const breaches = floor.breached
    ? `<ul class="finding-list">${floor.demoKillers.map(findingItem).join("")}</ul>`
    : '<p class="muted">No credential, account-fact, approval-estimate, or internal-data breaches.</p>';

  return `
<section>
  <h2>Compliance floor <span class="status ${tone}">${status}</span> <span class="muted">${floor.pass}/${floor.total}</span></h2>
  <table class="grid">
    <thead><tr><th>Dimension</th><th class="num">Pass</th><th class="num">Demo-killers</th></tr></thead>
    <tbody>${dimRows}</tbody>
  </table>
  ${breaches}
</section>`;
}

// ---------------------------------------------------------------------------

function sectionTable(report: HellWeekReport): string {
  const rows = report.categories
    .map((category) => {
      const rate = category.total === 0 ? 0 : category.pass / category.total;
      return `
    <tr>
      <td class="tag">${escapeHtml(category.category.toUpperCase())}</td>
      <td>${escapeHtml(stripPrefix(category.categoryTitle))}</td>
      <td class="num">${category.pass}/${category.total}</td>
      <td class="rate">${miniBar(rate)}<span>${pct(rate)}</span></td>
      <td class="num">${category.demoKillers > 0 ? `<span class="neg">${category.demoKillers}</span>` : ""}</td>
      <td class="num">${category.dents > 0 ? `<span class="warn">${category.dents}</span>` : ""}</td>
    </tr>`;
    })
    .join("");
  return `
<section>
  <h2>By section</h2>
  <table class="grid">
    <thead><tr><th></th><th>Section</th><th class="num">Pass</th><th>Rate</th><th class="num">DK</th><th class="num">Dent</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

function dimensionTable(report: HellWeekReport): string {
  const rows = report.dimensions
    .map((dimension) => {
      const rate = dimension.total === 0 ? 0 : dimension.pass / dimension.total;
      return `
    <tr>
      <td>${escapeHtml(dimension.label)}${dimension.isSafetyFloor ? ' <span class="floor-mark">floor</span>' : ""}</td>
      <td class="num">${dimension.pass}/${dimension.total}</td>
      <td class="rate">${miniBar(rate)}<span>${pct(rate)}</span></td>
      <td class="num">${dimension.demoKillers > 0 ? `<span class="neg">${dimension.demoKillers}</span>` : ""}</td>
      <td class="num">${dimension.dents > 0 ? `<span class="warn">${dimension.dents}</span>` : ""}</td>
    </tr>`;
    })
    .join("");
  return `
<section>
  <h2>By dimension</h2>
  <table class="grid">
    <thead><tr><th>Dimension</th><th class="num">Pass</th><th>Rate</th><th class="num">DK</th><th class="num">Dent</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

// ---------------------------------------------------------------------------

function failureBreakdown(report: HellWeekReport): string {
  const sev = report.severityCounts;
  const total = report.totals.scenarios || 1;
  const sevRows: { label: string; count: number; tone: Tone }[] = [
    { label: "Demo-killer", count: sev.demo_killer, tone: "neg" },
    { label: "Dent", count: sev.dent, tone: "warn" },
    { label: "Fine", count: sev.fine, tone: "pos" },
  ];
  const severity = sevRows
    .map(
      (row) => `
    <div class="dist-row">
      <span class="dist-label">${row.label}</span>
      <span class="track"><span class="fill ${row.tone}" style="width:${clamp((row.count / total) * 100)}%"></span></span>
      <span class="dist-num">${row.count}</span>
    </div>`,
    )
    .join("");

  const triage = report.triageCounts.slice(0, 12);
  const triageBody =
    triage.length === 0
      ? '<p class="muted">No failure reasons recorded.</p>'
      : `<table class="grid compact"><tbody>${triage
          .map(
            (entry) => `
      <tr><td>${escapeHtml(prettyLabel(entry.label))}</td><td class="num">${entry.count}</td></tr>`,
          )
          .join("")}</tbody></table>`;

  return `
<section class="cols">
  <div>
    <h2>Severity</h2>
    <div class="dist">${severity}</div>
  </div>
  <div>
    <h2>Failure reasons</h2>
    ${triageBody}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------

function findings(report: HellWeekReport): string {
  if (report.topRisks.length === 0) {
    return `
<section>
  <h2>Findings</h2>
  <p class="muted">No failing scenarios.</p>
</section>`;
  }
  return `
<section>
  <h2>Findings <span class="muted">${report.topRisks.length}</span></h2>
  <ul class="finding-list">${report.topRisks.map(findingItem).join("")}</ul>
</section>`;
}

function findingItem(risk: RiskItem): string {
  return `
    <li>
      <div class="finding-head">
        <span class="sev ${severityTone(risk.severity)}">${escapeHtml(severityLabel(risk.severity))}</span>
        <span class="finding-id">${escapeHtml(risk.scenarioId)}</span>
        <span class="muted">${escapeHtml(prettyLabel(risk.dimension))}</span>
      </div>
      <p class="finding-why">${escapeHtml(risk.rationale)}</p>
    </li>`;
}

// ---------------------------------------------------------------------------

function allScenarios(report: HellWeekReport): string {
  const scenarioById = new Map<string, HellWeekScenario>();
  for (const scenario of report.scenarios) {
    scenarioById.set(scenario.id, scenario);
  }
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

  const groups = [...byCategory.entries()]
    .sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]))
    .map(([category, grades]) => {
      const title = grades[0]?.categoryTitle ?? category;
      const fails = grades.filter((g) => !g.pass).length;
      const items = grades
        .map((grade) =>
          scenarioDetail(
            grade,
            scenarioById.get(grade.scenarioId),
            evidenceById.get(grade.scenarioId),
          ),
        )
        .join("");
      return `
    <details class="group"${fails > 0 ? " open" : ""}>
      <summary>${escapeHtml(title)} <span class="muted">${grades.length - fails}/${grades.length}</span></summary>
      <div class="group-body">${items}</div>
    </details>`;
    })
    .join("");

  return `
<section>
  <h2>All scenarios</h2>
  ${groups}
</section>`;
}

function scenarioDetail(
  grade: HellWeekGrade,
  scenario: HellWeekScenario | undefined,
  evidence: HellWeekScenarioEvidence | undefined,
): string {
  const turns = (evidence?.turns ?? []).map(turnBlock).join("");
  const judge = grade.judge
    ? `<p class="line"><span class="k">judge</span>${escapeHtml(grade.judge.rationale)} (ux ${grade.judge.uxScore}/5)</p>`
    : "";
  const expectation = scenario ? expectationLine(scenario) : "";
  const tags = grade.triageLabels.length
    ? `<p class="line"><span class="k">triage</span>${grade.triageLabels
        .map((t) => escapeHtml(prettyLabel(t)))
        .join(", ")}</p>`
    : "";
  return `
    <details class="sc">
      <summary>
        <span class="sc-mark ${grade.pass ? "pos" : severityTone(grade.severity)}"></span>
        <span class="sc-title">${escapeHtml(grade.title)}</span>
        <span class="sc-id">${escapeHtml(grade.scenarioId)}</span>
        <span class="sc-status ${grade.pass ? "pos" : severityTone(grade.severity)}">${grade.pass ? "pass" : severityLabel(grade.severity)}</span>
      </summary>
      <div class="sc-body">
        <p class="line"><span class="k">verdict</span>${escapeHtml(grade.rationale)} <span class="src">[${escapeHtml(grade.graderSource.replace("_", " "))}]</span></p>
        ${expectation}${tags}${judge}
        <div class="turns">${turns}</div>
      </div>
    </details>`;
}

function expectationLine(scenario: HellWeekScenario): string {
  const e = scenario.expected;
  const parts: string[] = [];
  if (e.requiredFinalAction) parts.push(`action=${e.requiredFinalAction}`);
  else if (e.allowedFinalActions)
    parts.push(`action in {${e.allowedFinalActions.join("|")}}`);
  if (e.requiredServingModes?.length)
    parts.push(`route=${e.requiredServingModes.join(",")}`);
  if (e.forbiddenServingModes?.length)
    parts.push(`not=${e.forbiddenServingModes.join(",")}`);
  if (e.contentChecks?.length)
    parts.push(`checks=${e.contentChecks.join(",")}`);
  return parts.length
    ? `<p class="line"><span class="k">expected</span>${escapeHtml(parts.join(" · "))}</p>`
    : "";
}

function turnBlock(turn: HellWeekTurnEvidence): string {
  const route = turn.routeForScoring ?? "—";
  const flags = turn.safetyFlags.length ? turn.safetyFlags.join(", ") : "none";
  const signal = turn.signalPrimaryIntent
    ? ` · signal=${turn.signalPrimaryIntent}→${turn.signalRecommendedServingMode ?? "null"}${turn.signalComparisonStatus ? `(${turn.signalComparisonStatus})` : ""}`
    : "";
  const overrides = turn.validatorOverrideCodes.length
    ? ` · overrides=${turn.validatorOverrideCodes.join(",")}`
    : "";
  return `
      <div class="turn">
        <p class="msg cust"><span class="role">customer</span>${escapeHtml(turn.userMessage)}</p>
        <p class="msg bot"><span class="role">bot</span>${escapeHtml(turn.botMessage)}</p>
        <p class="meta-line">action=${escapeHtml(turn.finalAction)} · route=${escapeHtml(route)} · flags=${escapeHtml(flags)}${escapeHtml(signal)}${escapeHtml(overrides)}</p>
      </div>`;
}

// ---------------------------------------------------------------------------

function footer(report: HellWeekReport): string {
  const grading = report.judged
    ? "routing, deflection, tone and nuance are scored by an independent LLM judge reading each transcript and trace, with demo-killers re-checked adversarially"
    : "routing, deflection and tone are scored by deterministic envelope backstops (no LLM judge in this run)";
  return `
<footer>
  <p>Each scenario ran against the live model-backed engine (the lab API <code>processTurn</code> path). A small deterministic safety floor (credential leaks, invented account facts, directional approval estimates, internal-data exposure) is non-negotiable; ${grading}.</p>
  <p class="run-id">${escapeHtml(report.runId)} · ${escapeHtml(report.profile)} · policy ${escapeHtml(report.policyVersion)}</p>
</footer>`;
}

// ---------------------------------------------------------------------------

function metaItem(term: string, detail: string): string {
  return `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(detail)}</dd></div>`;
}

function miniBar(rate: number): string {
  const tone: Tone = rate >= 0.9 ? "pos" : rate >= 0.6 ? "warn" : "neg";
  return `<span class="track sm"><span class="fill ${tone}" style="width:${clamp(rate * 100)}%"></span></span>`;
}

function severityTone(severity: Severity): Tone {
  if (severity === "demo_killer") return "neg";
  if (severity === "dent") return "warn";
  return "pos";
}

function severityLabel(severity: Severity): string {
  if (severity === "demo_killer") return "demo-killer";
  if (severity === "dent") return "dent";
  return "fine";
}

function prettyLabel(label: string): string {
  return label.replaceAll("_", " ");
}

function stripPrefix(title: string): string {
  return title.replace(/^[A-Z]\.\s*/, "");
}

function categoryRank(category: string): number {
  return category === "smoke" ? -1 : category.charCodeAt(0);
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function clamp(value: number): string {
  return Math.max(0, Math.min(100, value)).toFixed(1);
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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
:root{
  --ink:#1c1f23;--muted:#6b7280;--faint:#9aa1ab;--line:#e4e7ec;--line2:#eef0f3;--bg:#ffffff;
  --neg:#b42318;--warn:#b54708;--pos:#067647;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-feature-settings:"tnum" 1}
main{max-width:920px;margin:0 auto;padding:48px 24px 80px}
h1{font-size:1.55rem;font-weight:650;letter-spacing:-.01em;margin:.1rem 0 .5rem}
h2{font-size:1rem;font-weight:650;margin:0 0 .7rem;padding-bottom:.4rem;border-bottom:1px solid var(--line)}
section{margin:38px 0}
p{margin:0 0 .6rem}
.kicker{font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin:0 0 .2rem;font-weight:600}
.verdict{font-size:1.05rem;font-weight:600;margin:.2rem 0 .3rem}
.summary{color:var(--muted);max-width:62ch;margin:0 0 1.1rem}
.neg{color:var(--neg)}.warn{color:var(--warn)}.pos{color:var(--pos)}.mute{color:var(--muted)}
/* meta */
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:2px 28px;margin:0;
  border-top:1px solid var(--line);padding-top:14px}
.meta div{display:flex;flex-direction:column;padding:4px 0}
.meta dt{font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);font-weight:600}
.meta dd{margin:1px 0 0;font-size:.86rem;font-weight:500;overflow-wrap:anywhere}
/* figures */
.figures{display:grid;grid-template-columns:repeat(7,1fr);gap:0;border:1px solid var(--line);border-radius:4px;overflow:hidden}
.figure{display:flex;flex-direction:column;gap:3px;padding:14px 16px;border-right:1px solid var(--line2)}
.figure:last-child{border-right:0}
.fig-val{font-size:1.5rem;font-weight:650;line-height:1;letter-spacing:-.01em}
.fig-label{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
/* status */
.status{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:1px 6px;border:1px solid currentColor;border-radius:3px;vertical-align:middle}
.status.neg{color:var(--neg)}.status.pos{color:var(--pos)}.status.warn{color:var(--warn)}
h2 .muted{font-weight:500;font-size:.85rem}
.muted{color:var(--muted)}
/* tables */
table.grid{width:100%;border-collapse:collapse;font-size:.88rem}
table.grid th{text-align:left;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;color:var(--faint);padding:6px 10px;border-bottom:1px solid var(--line)}
table.grid td{padding:7px 10px;border-bottom:1px solid var(--line2);vertical-align:middle}
table.grid tr:last-child td{border-bottom:0}
table.grid td.num,table.grid th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
table.grid .tag{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:.78rem;color:var(--muted);width:38px}
table.compact td{padding:5px 10px}
.rate{display:flex;align-items:center;gap:8px;white-space:nowrap}
.rate span:last-child{font-variant-numeric:tabular-nums;color:var(--muted);font-size:.82rem;min-width:34px}
.floor-mark{font-size:.66rem;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);border:1px solid var(--line);border-radius:3px;padding:0 4px;margin-left:4px}
/* bars */
.track{display:inline-block;height:5px;width:88px;background:var(--line);border-radius:3px;overflow:hidden;flex:none}
.track.sm{width:64px}
.fill{display:block;height:100%;background:var(--muted)}
.fill.pos{background:var(--pos)}.fill.warn{background:var(--warn)}.fill.neg{background:var(--neg)}
/* distributions */
.cols{display:grid;grid-template-columns:1fr 1fr;gap:36px}
.dist{display:flex;flex-direction:column;gap:9px}
.dist-row{display:grid;grid-template-columns:84px 1fr 34px;align-items:center;gap:10px;font-size:.86rem}
.dist-row .track{width:100%}
.dist-num{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
/* findings */
.finding-list{list-style:none;margin:.4rem 0 0;padding:0;display:flex;flex-direction:column;gap:0}
.finding-list li{padding:11px 0;border-bottom:1px solid var(--line2)}
.finding-list li:last-child{border-bottom:0}
.finding-head{display:flex;align-items:center;gap:10px;font-size:.82rem}
.sev{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.sev.neg{color:var(--neg)}.sev.warn{color:var(--warn)}.sev.pos{color:var(--pos)}
.finding-id{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:.8rem}
.finding-why{margin:5px 0 0;color:var(--ink);font-size:.88rem}
/* drill down */
.group{border:1px solid var(--line);border-radius:4px;margin-bottom:10px}
.group>summary{cursor:pointer;padding:10px 14px;font-weight:600;font-size:.9rem;list-style:none}
.group>summary::-webkit-details-marker{display:none}
.group>summary .muted{font-weight:500}
.group-body{padding:0 14px 8px;border-top:1px solid var(--line2)}
.sc{border-bottom:1px solid var(--line2)}
.sc:last-child{border-bottom:0}
.sc>summary{cursor:pointer;display:flex;align-items:center;gap:10px;padding:9px 0;list-style:none;font-size:.88rem}
.sc>summary::-webkit-details-marker{display:none}
.sc-mark{width:7px;height:7px;border-radius:50%;flex:none;background:var(--muted)}
.sc-mark.pos{background:var(--pos)}.sc-mark.warn{background:var(--warn)}.sc-mark.neg{background:var(--neg)}
.sc-title{flex:1}
.sc-id{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:.78rem;color:var(--faint)}
.sc-status{font-size:.72rem;font-weight:600}
.sc-status.pos{color:var(--pos)}.sc-status.warn{color:var(--warn)}.sc-status.neg{color:var(--neg)}
.sc-body{padding:2px 0 14px 17px}
.line{margin:0 0 5px;font-size:.84rem;color:var(--ink)}
.line .k{display:inline-block;min-width:64px;font-size:.7rem;text-transform:uppercase;letter-spacing:.03em;color:var(--faint);font-weight:600}
.src{color:var(--faint);font-size:.78rem}
.turns{margin-top:8px;display:flex;flex-direction:column;gap:10px}
.turn{border-left:2px solid var(--line);padding-left:12px}
.msg{margin:0 0 3px;font-size:.85rem}
.msg .role{display:inline-block;min-width:64px;font-size:.68rem;text-transform:uppercase;letter-spacing:.03em;color:var(--faint);font-weight:600}
.msg.bot{color:var(--ink)}
.meta-line{margin:3px 0 0;font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:.74rem;color:var(--muted)}
/* footer */
footer{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:.82rem}
footer p{max-width:80ch}
code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:.82em;background:var(--line2);padding:1px 4px;border-radius:3px;color:var(--ink)}
.run-id{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:.76rem;color:var(--faint)}
@media(max-width:760px){
  .figures{grid-template-columns:repeat(2,1fr)}
  .figure{border-bottom:1px solid var(--line2)}
  .cols{grid-template-columns:1fr;gap:24px}
}
`;
}
