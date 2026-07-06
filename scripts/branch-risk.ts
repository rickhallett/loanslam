#!/usr/bin/env tsx
/**
 * branch-risk: map a branch's changed files to the proof bar they require.
 *
 * Encodes the repo doctrine that the proof surface is determined by what
 * changed - and that for engine behaviour, integration evidence (Hell Week +
 * floor-delta), not unit/build, is what counts. Pure path classification; reads
 * git, changes nothing.
 *
 * Usage: tsx scripts/branch-risk.ts [--base <ref>] [--json]
 *   default base: dev (falls back to origin/dev, then to working-tree only)
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

type Tier =
  | "ENGINE"
  | "SECRET"
  | "DEPLOY"
  | "BEHAVIOR_ADJACENT"
  | "UI"
  | "TOOLING"
  | "DOCS"
  | "BASELINE";

interface Rule {
  tier: Tier;
  severity: number;
  bar: string;
  test: (file: string) => boolean;
}

const rules: Rule[] = [
  {
    tier: "ENGINE",
    severity: 5,
    bar: "Full Hell Week + judge + floor-delta REPAIRED/HOLDING receipt. Unit/build are scaffolding, not proof, for routing/planner/validator/safety.",
    test: (f) =>
      f.startsWith("packages/core/src/") &&
      !f.endsWith(".test.ts") &&
      !f.endsWith(".md"),
  },
  {
    tier: "SECRET",
    severity: 5,
    bar: "Secret discipline: never commit decrypted values; sync deployment sinks dry-run first.",
    test: (f) =>
      f.startsWith("secrets/") ||
      f.endsWith(".sops") ||
      /(?:^|\/)\.env(?:\.|$)/.test(f),
  },
  {
    tier: "DEPLOY",
    severity: 4,
    bar: "Migration review: vercel-build runs prisma migrate deploy against the real DB on promotion to main.",
    test: (f) => f.startsWith("prisma/"),
  },
  {
    tier: "BEHAVIOR_ADJACENT",
    severity: 4,
    bar: "Lab-API/integration check + verify; route-audit on a captured run if routing-relevant.",
    test: (f) =>
      f.startsWith("packages/core/") ||
      f.startsWith("api/") ||
      f.startsWith("packages/mcp-server/"),
  },
  {
    tier: "UI",
    severity: 2,
    bar: "verify + live read-back of the affected widget/host/current site/IPOC surface; no Hell Week needed.",
    test: (f) =>
      /^packages\/(?:demo|review)-(?:widget|host)\//.test(f) ||
      f.startsWith("packages/site-nuxt/") ||
      f.startsWith("packages/integrated-poc/") ||
      f.startsWith("packages/lab-ui/") ||
      f.startsWith("site/"),
  },
  {
    tier: "TOOLING",
    severity: 2,
    bar: "verify (test + typecheck + build + reports check + source-policy).",
    test: (f) =>
      f.startsWith("scripts/") ||
      f === "Justfile" ||
      f === "justfile" ||
      f === "package.json" ||
      /(?:^|\/)(?:tsconfig|vitest\.config|prisma\.config)/.test(f),
  },
  {
    tier: "DOCS",
    severity: 1,
    bar: "verify (cheap); no behaviour proof required.",
    test: (f) => f.startsWith("docs/") || f.endsWith(".md"),
  },
];

const BASELINE: Rule = {
  tier: "BASELINE",
  severity: 1,
  bar: "verify.",
  test: () => true,
};

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

function tryResolveRef(ref: string): string | null {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return ref;
  } catch {
    return null;
  }
}

function changedFiles(base: string | null): { files: string[]; mode: string } {
  const working = git(["status", "--porcelain"])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").pop() as string);

  if (!base) {
    return { files: [...new Set(working)], mode: "working-tree only" };
  }

  const committed = git(["diff", "--name-only", `${base}...HEAD`])
    .split(/\r?\n/)
    .filter(Boolean);
  return {
    files: [...new Set([...committed, ...working])],
    mode: `vs ${base} (merge-base) + working tree`,
  };
}

function classify(file: string): Rule {
  return rules.find((rule) => rule.test(file)) ?? BASELINE;
}

export function main(argv: string[]): void {
  let baseArg = "dev";
  let asJson = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    else if (arg === "--base") baseArg = argv[(i += 1)] ?? baseArg;
    else if (arg === "--json") asJson = true;
    else {
      console.error(`branch-risk: unexpected argument: ${arg}`);
      process.exit(2);
    }
  }

  const base =
    tryResolveRef(baseArg) ?? tryResolveRef(`origin/${baseArg}`) ?? null;
  const { files, mode } = changedFiles(base);

  const byTier = new Map<Tier, { rule: Rule; files: string[] }>();
  for (const file of files) {
    const rule = classify(file);
    const entry = byTier.get(rule.tier) ?? { rule, files: [] };
    entry.files.push(file);
    byTier.set(rule.tier, entry);
  }

  const tiers = [...byTier.values()].sort(
    (a, b) => b.rule.severity - a.rule.severity,
  );
  const headline = tiers[0]?.rule ?? BASELINE;

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          base,
          mode,
          changedFiles: files.length,
          requiredProofBar: { tier: headline.tier, bar: headline.bar },
          tiers: tiers.map((t) => ({
            tier: t.rule.tier,
            bar: t.rule.bar,
            files: t.files,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("## branch risk");
  console.log(`- compared: ${mode}`);
  console.log(`- changed files: ${files.length}`);
  console.log(`- **required proof bar: ${headline.tier}**`);
  console.log(`  ${headline.bar}`);
  if (tiers.length > 0) console.log("- tiers touched:");
  for (const t of tiers) {
    console.log(`  - ${t.rule.tier} (${t.files.length}): ${t.rule.bar}`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}
