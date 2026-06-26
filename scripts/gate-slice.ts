#!/usr/bin/env tsx
/**
 * gate-slice: the deterministic keep-commit gate for the loanslam ops loop.
 *
 * Runs over the STAGED diff and blocks the commit (exit 1) on any of:
 *
 *   1. Forbidden staged paths - rendered env caches (.env, .env.local,
 *      .env.staging, .env.production) and Hell Week evidence.json transcripts.
 *      Encrypted secrets/*.env.sops and .env.example stay allowed.
 *   2. Forbidden staged content - added lines that look like a decrypted API
 *      key (sk-...) or a private key block.
 *   3. Engine-touch without a behaviour receipt - if the diff changes
 *      packages/core/src/** (non-test), a floor-delta receipt must exist and
 *      parse to status REPAIRED or HOLDING. REGRESSED/INCONCLUSIVE/missing
 *      blocks. This is content-aware: the verdict is parsed, not just present.
 *   4. demo <-> review widget cross-pollination - the two widget/host families
 *      are intentionally separate (repo memory); an import across the boundary
 *      blocks.
 *
 * It is the closest thing to CI this repo has and is meant to run from the
 * scripts/hooks/pre-commit hook. It does NOT try to detect "static routing
 * restraints" by regex - a fuzzy lexical detector would be exactly the brittle
 * pattern the repo guardrails warn against; that stays a human-review item in
 * references/write-scope-guardrails.md.
 *
 * Usage: tsx scripts/gate-slice.ts [--staged] [--receipt <path>]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_RECEIPT = "artifacts/evidence-index/floor-delta-latest.json";
const ACCEPTABLE_RECEIPT_STATUSES = new Set(["REPAIRED", "HOLDING"]);

const secretContentPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "API key (sk-...)", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  {
    label: "private key block",
    pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/,
  },
];

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

function stagedFiles(): string[] {
  return git([
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR",
  ])
    .split(/\r?\n/)
    .filter(Boolean);
}

function addedLines(file: string): string[] {
  const diff = git(["diff", "--cached", "--unified=0", "--", file]);
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

function isForbiddenSecretPath(file: string): boolean {
  const base = basename(file);
  if (base === "evidence.json") return true;
  if (base === ".env.example") return false;
  if (base.endsWith(".sops")) return false;
  return /\.env(?:\.|$)/.test(base);
}

function isEngineSource(file: string): boolean {
  return (
    file.startsWith("packages/core/src/") &&
    !file.endsWith(".test.ts") &&
    !file.endsWith(".md")
  );
}

const widgetFamilies: Array<{ self: RegExp; foreignImport: RegExp; label: string }> = [
  {
    label: "demo-widget/demo-host importing review-*",
    self: /^packages\/demo-(?:widget|host)\//,
    foreignImport: /@loanslam\/review-(?:widget|host)/,
  },
  {
    label: "review-widget/review-host importing demo-*",
    self: /^packages\/review-(?:widget|host)\//,
    foreignImport: /@loanslam\/demo-(?:widget|host)/,
  },
];

export interface GateResult {
  violations: string[];
  notes: string[];
}

export function evaluateGate(
  files: string[],
  receiptPath: string,
): GateResult {
  const violations: string[] = [];
  const notes: string[] = [];

  // 1. Forbidden paths.
  for (const file of files) {
    if (isForbiddenSecretPath(file)) {
      violations.push(`secret/cache file staged: ${file}`);
    }
  }

  // 2 + 4. Content scans on added lines.
  for (const file of files) {
    let added: string[] | null = null;
    const ensureAdded = (): string[] => (added ??= addedLines(file));

    for (const { label, pattern } of secretContentPatterns) {
      if (ensureAdded().some((line) => pattern.test(line))) {
        violations.push(`possible ${label} in staged content: ${file}`);
      }
    }

    for (const family of widgetFamilies) {
      if (family.self.test(file)) {
        if (ensureAdded().some((line) => family.foreignImport.test(line))) {
          violations.push(
            `widget cross-pollination (${family.label}): ${file}`,
          );
        }
      }
    }
  }

  // 3. Engine-touch requires a valid behaviour receipt.
  const engineFiles = files.filter(isEngineSource);
  if (engineFiles.length > 0) {
    notes.push(
      `engine-touching change (${engineFiles.length} file(s) under packages/core/src/)`,
    );
    const receipt = readReceipt(receiptPath);
    if (!receipt) {
      violations.push(
        `engine-touching commit requires a floor-delta receipt at ${receiptPath} (run \`just floor-delta -- <run-dir>\`)`,
      );
    } else if (!ACCEPTABLE_RECEIPT_STATUSES.has(receipt.status)) {
      violations.push(
        `floor-delta receipt status is ${receipt.status}; must be REPAIRED or HOLDING (candidate ${receipt.candidateRunId})`,
      );
    } else {
      notes.push(
        `floor-delta receipt ${receipt.status} (candidate ${receipt.candidateRunId}, ${receipt.generatedAt})`,
      );
    }
  }

  return { violations, notes };
}

function readReceipt(
  path: string,
): { status: string; candidateRunId?: string; generatedAt?: string } | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed?.status !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function main(argv: string[]): void {
  let receiptPath = DEFAULT_RECEIPT;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--" || arg === "--staged") continue;
    if (arg === "--receipt") {
      receiptPath = argv[(i += 1)] ?? receiptPath;
      continue;
    }
    console.error(`gate-slice: unexpected argument: ${arg}`);
    process.exit(2);
  }

  const files = stagedFiles();
  if (files.length === 0) {
    console.log("gate-slice: no staged changes.");
    return;
  }

  const { violations, notes } = evaluateGate(files, receiptPath);
  for (const note of notes) console.log(`gate-slice: ${note}`);

  if (violations.length > 0) {
    console.error("gate-slice failed:");
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(`gate-slice passed: scanned ${files.length} staged file(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
