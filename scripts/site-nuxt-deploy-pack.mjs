#!/usr/bin/env node
// Assemble the Railway deploy artifact for the loanslam-site-nuxt service.
// The upload indexer drops dot-directories and node_modules, so the Nitro
// output ships as a non-dot dir and its emitted dependency manifest is declared
// for Railpack to install. The site build bundles all content, CSS, and public
// assets, so nothing else is needed at runtime.
//
// Usage:
//   npm run site-nuxt-build && node scripts/site-nuxt-deploy-pack.mjs
//   cd packages/site-nuxt/.railway-pack && railway up --ci

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root, "packages/site-nuxt/.output");
const pack = resolve(root, "packages/site-nuxt/.railway-pack");
const corpus = "data/public-info/loanslam-synthetic-kb.json";
const corpusPath = resolve(root, corpus);
const syntheticCorpusOptIn = "ALLOW_SYNTHETIC_CORPUS_DEPLOY_PACK";
const corpusDocument = JSON.parse(readFileSync(corpusPath, "utf8"));
const corpusIsNonDeployableSynthetic =
  corpusDocument &&
  typeof corpusDocument === "object" &&
  (corpusDocument.deployment_status === "non_deployable_synthetic" ||
    corpusDocument.deployable === false);

if (
  corpusIsNonDeployableSynthetic &&
  process.env[syntheticCorpusOptIn] !== "1"
) {
  console.error(
    `Refusing to pack non-deployable synthetic corpus ${corpus}. Set ${syntheticCorpusOptIn}=1 only for an explicit proof/demo deployment, or replace it with an approved runtime corpus.`,
  );
  process.exit(1);
}

if (corpusIsNonDeployableSynthetic) {
  console.warn(
    `Packing ${corpus} because ${syntheticCorpusOptIn}=1 is set. Do not treat this corpus as approved public copy.`,
  );
}

if (!existsSync(resolve(output, "server/index.mjs"))) {
  console.error("No build output found. Run `npm run site-nuxt-build` first.");
  process.exit(1);
}

// The /reports pages are served by Nitro from var/reports. Refuse to pack a
// stale generated set, then copy it into the artifact beside the server output.
const reportsCheck = spawnSync(
  "npm",
  ["--silent", "run", "reports:publish-db", "--", "--check"],
  {
    cwd: root,
    stdio: "inherit",
  },
);
if (reportsCheck.status !== 0) {
  console.error(
    "Stale DB-backed /reports output. Run `just reports-publish-db`, then re-pack.",
  );
  process.exit(1);
}
const reportsSrc = resolve(root, "var/reports");
if (!existsSync(resolve(reportsSrc, "index.html"))) {
  console.error(
    "No DB-backed reports found. Run `just reports-publish-db` first.",
  );
  process.exit(1);
}

rmSync(pack, { recursive: true, force: true });
mkdirSync(pack, { recursive: true });
cpSync(output, resolve(pack, "output"), { recursive: true });

// The contact chat runs the engine on this service; the corpus is read from
// the filesystem at runtime (cwd/data candidate in engineAdapter).
mkdirSync(resolve(pack, "data/public-info"), { recursive: true });
cpSync(corpusPath, resolve(pack, corpus));
cpSync(reportsSrc, resolve(pack, "var/reports"), { recursive: true });

const nitroPackage = JSON.parse(
  readFileSync(resolve(output, "server/package.json"), "utf8"),
);

writeFileSync(
  resolve(pack, "package.json"),
  `${JSON.stringify(
    {
      name: "loanslam-site-nuxt-artifact",
      private: true,
      scripts: { start: "node output/server/index.mjs" },
      engines: { node: ">=22" },
      dependencies: nitroPackage.dependencies ?? {},
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  resolve(pack, ".gitignore"),
  "!var/\n!var/reports/\n!var/reports/**\n",
);

writeFileSync(
  resolve(pack, "railway.json"),
  `${JSON.stringify(
    {
      $schema: "https://railway.com/railway.schema.json",
      build: { builder: "RAILPACK" },
      deploy: {
        startCommand: "npm start",
        restartPolicyType: "ON_FAILURE",
        restartPolicyMaxRetries: 10,
      },
    },
    null,
    2,
  )}\n`,
);

console.log(`Packed deploy artifact at ${pack}`);
