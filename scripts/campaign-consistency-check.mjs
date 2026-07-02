#!/usr/bin/env node
// Mechanical roadmap/card/diff/receipt consistency check required by
// docs/campaign-workflow-protocol.md before any promotion.
//
// Usage: node scripts/campaign-consistency-check.mjs <roadmap.yaml> [more.yaml...]
//
// Checks, per roadmap:
//   1. Every completed chain item has a receipt.
//   2. Path receipts exist on disk; "commit <hash>" receipts are ancestors
//      of HEAD; "live ..." receipts are accepted with a warning (URLs are
//      not verifiable offline).
//   3. Every completed item's depends_on entries are also completed.
//   4. active_slice names a real slice_label/id and its status matches
//      active_slice_status.
//   5. Write scope: commits whose message names "Slice: <slice_label>" only
//      touch paths inside that item's write_scope. Process bookkeeping is
//      implicitly allowed (receipts under artifacts/, roadmaps, agenda
//      cards/PRDs, reports, the decision log); write scopes enforce
//      implementation blast radius, per established convention.
// Failures exit 1 with findings; warnings do not fail.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";

const roadmapPaths = process.argv.slice(2);
if (roadmapPaths.length === 0) {
  console.error("usage: campaign-consistency-check.mjs <roadmap.yaml> [...]");
  process.exit(2);
}

const failures = [];
const warnings = [];

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function isAncestor(hash) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", hash, "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

function checkReceipt(roadmap, item) {
  const receipt = String(item.receipt ?? "").trim();
  if (!receipt) {
    failures.push(`${roadmap}: ${item.id} is completed but has no receipt`);
    return;
  }
  const commitMatch = receipt.match(/^commit ([0-9a-f]{7,40})\b/);
  if (commitMatch) {
    if (!isAncestor(commitMatch[1])) {
      failures.push(
        `${roadmap}: ${item.id} receipt commit ${commitMatch[1]} is not an ancestor of HEAD`,
      );
    }
    return;
  }
  if (/^(live |https?:\/\/)/.test(receipt)) {
    warnings.push(`${roadmap}: ${item.id} has a live-URL receipt (not verifiable offline)`);
    return;
  }
  const path = receipt.split(/\s/)[0];
  if (!existsSync(path)) {
    failures.push(`${roadmap}: ${item.id} receipt path does not exist: ${path}`);
  }
}

const BOOKKEEPING_PREFIXES = [
  "artifacts/",
  "docs/roadmaps/",
  "docs/prds/",
  "docs/reports/",
];
const BOOKKEEPING_FILES = ["docs/core-product-decision-log.yaml"];

function isBookkeeping(file) {
  return (
    BOOKKEEPING_FILES.includes(file) ||
    BOOKKEEPING_PREFIXES.some((prefix) => file.startsWith(prefix))
  );
}

function checkWriteScope(roadmap, roadmapPath, item) {
  const label = item.slice_label;
  const scopes = item.write_scope ?? [];
  if (!label || scopes.length === 0) return;
  const logOut = git(
    "log",
    `--grep=Slice: ${label}`,
    "--format=%H",
    "--name-only",
  );
  if (!logOut) return; // no labeled commits (pre-label-era slices)
  const files = logOut
    .split("\n")
    .filter((line) => line && !/^[0-9a-f]{40}$/.test(line));
  for (const file of files) {
    const inScope =
      isBookkeeping(file) ||
      scopes.some((scope) =>
        scope.endsWith("/") ? file.startsWith(scope) : file === scope,
      );
    if (!inScope) {
      failures.push(
        `${roadmap}: slice ${label} touched ${file}, outside write_scope [${scopes.join(", ")}]`,
      );
    }
  }
}

for (const roadmapPath of roadmapPaths) {
  const doc = parse(readFileSync(roadmapPath, "utf8"));
  const roadmap = roadmapPath;
  const items = Object.entries(doc)
    .filter(([key, value]) => key.endsWith("_chain") && Array.isArray(value))
    .flatMap(([, value]) => value);
  const byId = new Map(items.map((item) => [item.id, item]));
  const byLabel = new Map(
    items.filter((item) => item.slice_label).map((item) => [item.slice_label, item]),
  );

  for (const item of items) {
    if (item.status !== "completed") continue;
    checkReceipt(roadmap, item);
    checkWriteScope(roadmap, roadmapPath, item);
    for (const dep of item.depends_on ?? []) {
      const depItem = byId.get(dep);
      if (!depItem) {
        failures.push(`${roadmap}: ${item.id} depends on unknown id ${dep}`);
      } else if (depItem.status !== "completed") {
        failures.push(
          `${roadmap}: ${item.id} is completed but dependency ${dep} is ${depItem.status}`,
        );
      }
    }
  }

  if (doc.active_slice) {
    const active = byLabel.get(doc.active_slice) ?? byId.get(doc.active_slice);
    if (!active) {
      failures.push(`${roadmap}: active_slice ${doc.active_slice} not found in any chain`);
    } else if (doc.active_slice_status && active.status !== doc.active_slice_status) {
      failures.push(
        `${roadmap}: active_slice_status is ${doc.active_slice_status} but ${active.id} is ${active.status}`,
      );
    }
  }
  console.log(`${roadmap}: checked ${items.length} chain items`);
}

for (const warning of warnings) console.log(`WARN  ${warning}`);
for (const failure of failures) console.log(`FAIL  ${failure}`);
console.log(
  failures.length === 0
    ? `consistency check passed (${warnings.length} warning(s))`
    : `consistency check FAILED with ${failures.length} finding(s)`,
);
process.exit(failures.length === 0 ? 0 : 1);
