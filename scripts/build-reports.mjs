#!/usr/bin/env node
// Build the /reports static pages from the publish manifest.
//
// Reads packages/review-host/reports-manifest.json (the opt-in allowlist of
// publishable, already-sanitized reports), renders each markdown source to a
// styled HTML page, and regenerates the landing index (hero = most recent,
// then the full record grouped by campaign). Static-html entries are served
// as-is and only listed. Output is deterministic: no timestamps, so reruns
// are byte-identical and diffs stay meaningful.
//
// Usage:
//   node scripts/build-reports.mjs            # write pages + index
//   node scripts/build-reports.mjs --check    # exit 1 if disk drifts from manifest
//
// The renderer intentionally covers only the markdown constructs used in
// docs/reports/ (headings, paragraphs, lists with one nesting level, fenced
// code, tables, rules, bold, inline code). Anything else renders as an
// escaped paragraph rather than mangling silently.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import prettier from "prettier";

const root = process.cwd();
const manifestPath = resolve(
  root,
  "packages/review-host/reports-manifest.json",
);
const outDir = resolve(root, "packages/review-host/public/reports");
const checkMode = process.argv.includes("--check");

// --------------------------------------------------------------------------
// Manifest

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const reports = manifest.reports;
if (!Array.isArray(reports) || reports.length === 0) {
  fail("manifest has no reports");
}

for (const r of reports) {
  for (const field of [
    "id",
    "title",
    "date",
    "campaign",
    "kind",
    "source",
    "summary",
  ]) {
    if (!r[field]) fail(`report '${r.id ?? "?"}' is missing '${field}'`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
    fail(`report '${r.id}' has non ISO date '${r.date}'`);
  }
  if (!existsSync(resolve(root, r.source.path))) {
    fail(`report '${r.id}' source does not exist: ${r.source.path}`);
  }
}
const ids = new Set(reports.map((r) => r.id));
if (ids.size !== reports.length) fail("duplicate report ids in manifest");

function fail(message) {
  console.error(`build-reports: ${message}`);
  process.exit(1);
}

// --------------------------------------------------------------------------
// Inline markdown: escape first, then code spans and bold on the safe text.

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(text) {
  // Code spans are lifted out first so the bold pass cannot match a ** pair
  // that spans a code boundary (e.g. two glob patterns in one sentence).
  const codes = [];
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, (_, span) => {
      codes.push(`<code>${span}</code>`);
      return `\u0000${codes.length - 1}\u0000`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\u0000(\d+)\u0000/g, (_, index) => codes[Number(index)]);
}

// --------------------------------------------------------------------------
// Block-level markdown renderer (line state machine).

function renderMarkdown(source) {
  const lines = source.split("\n");
  const html = [];
  let paragraph = [];
  let list = null; // { type: 'ul'|'ol', items: [{ text, children }] }
  let sawFirstH1 = false;
  let i = 0;

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const renderList = (l) =>
    `<${l.type}>${l.items
      .map((item) => {
        const child = item.children ? renderList(item.children) : "";
        return `<li>${inline(item.text)}${child}</li>`;
      })
      .join("")}</${l.type}>`;

  const flushList = () => {
    if (list) {
      html.push(renderList(list));
      list = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (/^```/.test(line)) {
      flushParagraph();
      flushList();
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    // Table: consecutive lines starting with |.
    if (/^\|/.test(line.trim())) {
      flushParagraph();
      flushList();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) {
        rows.push(
          lines[i]
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((cell) => cell.trim()),
        );
        i += 1;
      }
      const isSeparator = (row) => row.every((c) => /^:?-{3,}:?$/.test(c));
      let body = rows;
      let head = "";
      if (rows.length > 1 && isSeparator(rows[1])) {
        head = `<thead><tr>${rows[0].map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
        body = rows.slice(2);
      }
      const bodyHtml = body
        .map(
          (row) =>
            `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`,
        )
        .join("");
      html.push(`<table>${head}<tbody>${bodyHtml}</tbody></table>`);
      continue;
    }

    // Heading.
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      // The page header already shows the report title; drop the source h1.
      if (level === 1 && !sawFirstH1) {
        sawFirstH1 = true;
      } else {
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      }
      i += 1;
      continue;
    }

    // Horizontal rule.
    if (/^---+\s*$/.test(line)) {
      flushParagraph();
      flushList();
      html.push("<hr>");
      i += 1;
      continue;
    }

    // List items: top-level and one nested level.
    const topItem = line.match(/^([-*]|\d+\.)\s+(.*)$/);
    const nestedItem = line.match(/^\s{2,}([-*]|\d+\.)\s+(.*)$/);
    if (topItem || nestedItem) {
      flushParagraph();
      const marker = (topItem ?? nestedItem)[1];
      const text = (topItem ?? nestedItem)[2];
      const type = /\d+\./.test(marker) ? "ol" : "ul";
      if (topItem) {
        if (!list || list.type !== type) {
          flushList();
          list = { type, items: [] };
        }
        list.items.push({ text });
      } else if (list && list.items.length) {
        const parent = list.items[list.items.length - 1];
        parent.children ??= { type, items: [] };
        parent.children.items.push({ text });
      } else {
        // Nested marker with no open list: treat as top-level.
        list = { type, items: [{ text }] };
      }
      i += 1;
      continue;
    }

    // Blank line closes paragraph and list.
    if (!line.trim()) {
      flushParagraph();
      flushList();
      i += 1;
      continue;
    }

    // Indented continuation of the most recent list item.
    if (list && /^\s+/.test(line)) {
      const target = list.items[list.items.length - 1];
      const node = target.children
        ? target.children.items[target.children.items.length - 1]
        : target;
      node.text += ` ${line.trim()}`;
      i += 1;
      continue;
    }

    // Plain paragraph line (lazy continuation joins on flush).
    flushList();
    paragraph.push(line.trim());
    i += 1;
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}

// --------------------------------------------------------------------------
// Shared page chrome.

const css = `
:root { color: #1c1f23; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
body { margin: 0; }
main { max-width: 780px; margin: 0 auto; padding: 48px 24px 72px; }
.kicker { color: #5f6b76; font-size: 0.85rem; letter-spacing: 0.04em; text-transform: uppercase; margin: 0 0 8px; }
.kicker a { color: inherit; text-decoration: none; }
.kicker a:hover { text-decoration: underline; }
h1 { margin: 0 0 8px; font-size: 1.7rem; line-height: 1.2; }
h2 { margin: 36px 0 12px; font-size: 1.25rem; line-height: 1.3; }
h3 { margin: 28px 0 10px; font-size: 1.05rem; }
h4 { margin: 24px 0 8px; font-size: 0.95rem; }
p, li { color: #3a434c; line-height: 1.55; }
p { margin: 0 0 16px; }
ul, ol { margin: 0 0 16px; padding-left: 24px; }
li { margin: 4px 0; }
a { color: #1a8787; }
hr { border: 0; border-top: 1px solid #e4e7ec; margin: 32px 0; }
code { background: #f2f4f6; border-radius: 4px; padding: 1px 5px; font-size: 0.88em; }
pre { background: #f6f8f9; border: 1px solid #e4e7ec; border-radius: 8px; padding: 14px 16px; overflow-x: auto; }
pre code { background: none; padding: 0; font-size: 0.85rem; line-height: 1.5; }
table { border-collapse: collapse; margin: 0 0 20px; width: 100%; font-size: 0.92rem; }
th, td { border: 1px solid #e4e7ec; padding: 7px 10px; text-align: left; vertical-align: top; }
th { background: #f6f8f9; }
.meta { color: #5f6b76; font-size: 0.9rem; margin: 0 0 4px; }
.chips { margin: 8px 0 0; }
.chip { display: inline-block; background: #f2f4f6; border-radius: 999px; color: #5f6b76; font-size: 0.8rem; padding: 3px 10px; margin: 0 6px 6px 0; }
.hero { border: 1px solid #d7dde3; border-radius: 12px; padding: 22px 24px; margin: 0 0 40px; }
.hero h2 { margin: 4px 0 8px; font-size: 1.3rem; }
.hero a { text-decoration: none; }
.hero a:hover { text-decoration: underline; }
.record { list-style: none; margin: 0 0 8px; padding: 0; border-top: 1px solid #e4e7ec; }
.record li { border-bottom: 1px solid #e4e7ec; margin: 0; }
.record a { display: block; padding: 14px 0; text-decoration: none; }
.record a:hover { text-decoration: underline; }
.record span { color: #5f6b76; display: block; font-size: 0.9rem; margin-top: 4px; }
footer { color: #8a949d; font-size: 0.8rem; margin-top: 56px; border-top: 1px solid #e4e7ec; padding-top: 16px; }
`.trim();

const generatedNote =
  "<!-- Generated by scripts/build-reports.mjs from packages/review-host/reports-manifest.json. Do not edit by hand; edit the manifest or source and run `just reports-build`. -->";

function page(title, body) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    generatedNote,
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="robots" content="noindex, nofollow" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>\n${css}\n</style>`,
    "</head>",
    "<body>",
    "<main>",
    body,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

const chips = (report) =>
  [`<span class="chip">${escapeHtml(report.kind)}</span>`]
    .concat(
      (report.provenance ?? []).map(
        (p) => `<span class="chip">${escapeHtml(p)}</span>`,
      ),
    )
    .join("");

function reportHref(report) {
  return report.source.type === "static-html"
    ? basename(report.source.path)
    : `${report.id}.html`;
}

function renderReportPage(report) {
  const body = renderMarkdown(
    readFileSync(resolve(root, report.source.path), "utf8"),
  );
  return page(
    `${report.title} — LoanSlam evidence`,
    [
      "<header>",
      '<p class="kicker"><a href="./">LoanSlam · Evidence reports</a></p>',
      `<h1>${escapeHtml(report.title)}</h1>`,
      `<p class="meta">${escapeHtml(report.date)} · ${escapeHtml(report.campaign)}</p>`,
      `<p class="chips">${chips(report)}</p>`,
      "</header>",
      `<article>\n${body}\n</article>`,
      "<footer>Sanitized summary. Generated from the publish manifest; the full run data stays internal.</footer>",
    ].join("\n"),
  );
}

function renderIndex() {
  const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
  const hero = sorted[0];

  const groups = new Map();
  for (const report of sorted) {
    if (!groups.has(report.campaign)) groups.set(report.campaign, []);
    groups.get(report.campaign).push(report);
  }

  const entry = (report) =>
    [
      "<li>",
      `<a href="${reportHref(report)}">${escapeHtml(report.title)}`,
      `<span>${escapeHtml(report.date)} — ${escapeHtml(report.summary)}</span>`,
      "</a>",
      "</li>",
    ].join("");

  const groupsHtml = [...groups.entries()]
    .map(
      ([campaign, entries]) =>
        `<h2>${escapeHtml(campaign)}</h2>\n<ul class="record">${entries.map(entry).join("\n")}</ul>`,
    )
    .join("\n");

  return page(
    "LoanSlam evidence reports",
    [
      "<header>",
      '<p class="kicker">LoanSlam</p>',
      "<h1>Evidence reports</h1>",
      "<p>Sanitized report views from the testing record: Hell Week gauntlets, adversarial probes, audits, and reviews across the product's evolution. These pages are generated summaries, not raw traces, run JSON, or lab session dumps.</p>",
      "</header>",
      '<section class="hero">',
      '<p class="kicker">Latest</p>',
      `<h2><a href="${reportHref(hero)}">${escapeHtml(hero.title)}</a></h2>`,
      `<p class="meta">${escapeHtml(hero.date)} · ${escapeHtml(hero.campaign)}</p>`,
      `<p>${escapeHtml(hero.summary)}</p>`,
      `<p class="chips">${chips(hero)}</p>`,
      "</section>",
      `<h2 style="font-size:1.05rem;color:#5f6b76;">Full record — ${reports.length} reports</h2>`,
      groupsHtml,
      "<footer>Regenerated by <code>just reports-build</code> from the publish manifest.</footer>",
    ].join("\n"),
  );
}

// --------------------------------------------------------------------------
// Emit (or check).

// Checked-in review-host HTML is Prettier-formatted (format-check covers
// packages/**/*.html), so emit Prettier-canonical output. Still deterministic.
async function canonical(html) {
  return prettier.format(html, { parser: "html" });
}

const outputs = new Map(); // filename -> content
for (const report of reports) {
  if (report.source.type === "markdown") {
    outputs.set(`${report.id}.html`, await canonical(renderReportPage(report)));
  }
}
outputs.set("index.html", await canonical(renderIndex()));

const staticFiles = new Set(
  reports
    .filter((r) => r.source.type === "static-html")
    .map((r) => basename(r.source.path)),
);

let drift = [];
for (const [name, content] of outputs) {
  const target = resolve(outDir, name);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (current === content) continue;
  if (checkMode) {
    drift.push(name);
  } else {
    writeFileSync(target, content);
    console.log(`wrote ${name}`);
  }
}

// Guard against leftovers: every .html in the folder must be generated,
// a manifest-listed static dashboard, or the index.
const known = new Set([...outputs.keys(), ...staticFiles]);
for (const file of readdirSync(outDir)) {
  if (file.endsWith(".html") && !known.has(file)) {
    console.warn(
      `build-reports: warning: ${file} is not in the manifest and will be served anyway; list it or delete it`,
    );
  }
}

if (checkMode) {
  if (drift.length) {
    fail(
      `stale /reports pages (run \`just reports-build\`): ${drift.join(", ")}`,
    );
  }
  console.log("reports up to date");
} else {
  console.log(
    `reports: ${reports.length} listed, ${outputs.size - 1} rendered, index regenerated`,
  );
}
