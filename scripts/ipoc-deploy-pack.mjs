#!/usr/bin/env node
// Assemble the Railway deploy artifact for the loanslam-ipoc service.
//
// The ipoc service deploys as a prebuilt artifact (railway up of this pack
// directory) rather than a repo-root build: the root railway.json belongs to
// the loanslam-site service (prisma pre-deploy and all), and service-level
// config file paths are not settable from the CLI. Packing keeps the two
// services fully independent.
//
// Usage:
//   npm run ipoc-build && node scripts/ipoc-deploy-pack.mjs
//   railway up packages/integrated-poc/.railway-pack --service loanslam-ipoc --ci

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
const output = resolve(root, "packages/integrated-poc/.output");
const pack = resolve(root, "packages/integrated-poc/.railway-pack");
const corpus = "data/public-info/loanslam-synthetic-kb.json";

if (!existsSync(resolve(output, "server/index.mjs"))) {
  console.error("No build output found. Run `npm run ipoc-build` first.");
  process.exit(1);
}

rmSync(pack, { recursive: true, force: true });
mkdirSync(pack, { recursive: true });

// Packed as a non-dot directory: the Railway upload indexer drops
// dot-directories, which left /app/.output missing on the first deploy.
cpSync(output, resolve(pack, "output"), { recursive: true });
mkdirSync(resolve(pack, "data/public-info"), { recursive: true });
cpSync(resolve(root, corpus), resolve(pack, corpus));

// The upload indexer also drops node_modules, so the Nitro server's external
// runtime deps (emitted in .output/server/package.json) are declared on the
// artifact package for Railpack to npm-install in the image.
const nitroPackage = JSON.parse(
  readFileSync(resolve(output, "server/package.json"), "utf8"),
);

writeFileSync(
  resolve(pack, "package.json"),
  `${JSON.stringify(
    {
      name: "loanslam-ipoc-artifact",
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
