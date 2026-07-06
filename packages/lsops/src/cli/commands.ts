import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { buildReports } from "../reports/buildReports";
import { runSecretsCommand } from "../secrets/commands";
import { judgeConciergeProbes } from "../scenarios/concierge/judge";
import { runConciergeProbes } from "../scenarios/concierge/probes";
import { runContactAssistantProof } from "../scenarios/siteNuxt/contactAssistantProof";
import { runSeamWalkProof } from "../scenarios/siteNuxt/seamWalkProof";

export class UsageError extends Error {
  readonly exitCode = 2;
}

export async function runLsops(root: string, argv: string[]): Promise<number> {
  const [area, action, subject, ...rest] = argv;
  if (area === "--help" || area === "-h") {
    console.log(usage());
    return 0;
  }
  if (!area) {
    throw new UsageError(usage());
  }

  if (area === "proof" && action === "run" && subject) {
    return runProof(subject, rest);
  }

  if (area === "battery" && action === "run" && subject) {
    if (subject === "concierge-probes" || subject === "concierge") {
      return runConciergeProbes({
        base: option(rest, "--base") ?? "http://127.0.0.1:3641",
        outFile:
          option(rest, "--out") ?? "artifacts/concierge-probes/probe-run.json",
      });
    }
    throw new UsageError(`Unknown battery: ${subject}`);
  }

  if (area === "probe" && action === "concierge") {
    return runConciergeProbes({
      base: option([subject, ...rest], "--base") ?? "http://127.0.0.1:3641",
      outFile:
        option([subject, ...rest], "--out") ??
        "artifacts/concierge-probes/probe-run.json",
    });
  }

  if (area === "judge" && action === "concierge-probes") {
    const args = [subject, ...rest].filter(Boolean);
    const inFile = option(args, "--in");
    const outFile = option(args, "--out");
    if (!inFile || !outFile) {
      throw new UsageError(
        "usage: lsops judge concierge-probes --in <file> --out <file>",
      );
    }
    return judgeConciergeProbes({
      inFile,
      outFile,
      measurementOnly: hasFlag(args, "--measurement-only"),
    });
  }

  if (area === "reports" && action === "build") {
    await buildReports({ root, check: hasFlag([subject, ...rest], "--check") });
    return 0;
  }

  if (area === "secrets") {
    return runSecretsCommand(root, filterStrings([action, subject, ...rest]));
  }

  if (area === "parity" && action === "site") {
    return runNodeScript(
      root,
      "scripts/site-parity-harness.mjs",
      filterStrings([subject, ...rest]),
    );
  }

  if (area === "campaign" && action === "check") {
    return runNodeScript(
      root,
      "scripts/campaign-consistency-check.mjs",
      filterStrings([subject, ...rest]),
    );
  }

  throw new UsageError(usage());
}

function runProof(scenario: string, args: string[]): Promise<number> {
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const base =
    option(args, "--base") ??
    positional[0] ??
    (scenario.startsWith("contact") || scenario === "seam-walk"
      ? "http://127.0.0.1:4185"
      : "http://127.0.0.1:3641");
  const outDir =
    option(args, "--out") ??
    positional[1] ??
    (scenario.startsWith("contact")
      ? "artifacts/contact-assistant-ux"
      : "artifacts/seam-walk");
  const json = hasFlag(args, "--json");

  if (scenario === "contact-assistant" || scenario === "contact-assistant-ux") {
    return runContactAssistantProof({ base, outDir, json });
  }
  if (scenario === "seam-walk") {
    return runSeamWalkProof({ base, outDir, json });
  }
  throw new UsageError(`Unknown proof scenario: ${scenario}`);
}

function option(
  args: Array<string | undefined>,
  name: string,
): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function hasFlag(args: Array<string | undefined>, name: string): boolean {
  return args.includes(name);
}

function filterStrings(args: Array<string | undefined>): string[] {
  return args.filter((arg): arg is string => Boolean(arg));
}

function runNodeScript(root: string, script: string, args: string[]): number {
  const result = spawnSync(process.execPath, [resolve(root, script), ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export function usage(): string {
  return `Usage:
  lsops proof run <scenario> [--base <url>] [--out <dir>] [--json]
  lsops battery run <battery> [--base <url>] [--out <file>] [--json]
  lsops probe concierge [--base <url>] [--out <file>]
  lsops judge concierge-probes --in <file> --out <file> [--measurement-only]
  lsops reports build [--check]
  lsops parity site --astro-base <url> --nuxt-base <url> [--routes <csv>]
  lsops secrets status [env]
  lsops secrets render <env>
  lsops secrets run <env> -- <command...>
  lsops secrets sync vercel <env> [--dry-run|--apply]
  lsops secrets sync railway <env> [--dry-run|--apply] [--service <name>]
  lsops campaign check <roadmap.yaml...>`;
}
