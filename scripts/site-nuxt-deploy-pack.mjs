#!/usr/bin/env node
// Assemble the Railway deploy artifact for the loanslam-site-nuxt service.
// Same prebuilt-artifact pattern as scripts/ipoc-deploy-pack.mjs: the upload
// indexer drops dot-directories and node_modules, so the Nitro output ships
// as a non-dot dir and its emitted dependency manifest is declared for
// Railpack to install. The site build bundles all content, CSS, and public
// assets, so nothing else is needed at runtime.
//
// Usage:
//   npm run site-nuxt-build && node scripts/site-nuxt-deploy-pack.mjs
//   cd packages/site-nuxt/.railway-pack && railway up --ci

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root, "packages/site-nuxt/.output");
const pack = resolve(root, "packages/site-nuxt/.railway-pack");

if (!existsSync(resolve(output, "server/index.mjs"))) {
  console.error("No build output found. Run `npm run site-nuxt-build` first.");
  process.exit(1);
}

rmSync(pack, { recursive: true, force: true });
mkdirSync(pack, { recursive: true });
cpSync(output, resolve(pack, "output"), { recursive: true });

// The contact chat runs the engine on this service; the corpus is read from
// the filesystem at runtime (cwd/data candidate in engineAdapter).
const corpus = "data/public-info/loanslam-synthetic-kb.json";
mkdirSync(resolve(pack, "data/public-info"), { recursive: true });
cpSync(resolve(root, corpus), resolve(pack, corpus));

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

// The repo-root .gitignore excludes reports/ and the upload indexer honors
// it; re-include the packed dashboards the same way the root file re-includes
// the review-host originals.
writeFileSync(
  resolve(pack, ".gitignore"),
  "!output/public/reports/\n!output/public/reports/*.html\n",
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
