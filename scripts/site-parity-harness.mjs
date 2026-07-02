#!/usr/bin/env node
// Astro -> Nuxt site parity harness (sitenuxt-arc-001, D041).
//
// The Astro production build (site/dist) is the parity contract. For every
// route in the manifest this loads the Astro app and the Nuxt app in the
// same headless Chromium, disables animations, waits for fonts, and compares:
//   - normalized body text (must match exactly)
//   - full-page pixels per viewport (diff ratio must be <= threshold)
// Routes above threshold write diff images for human review; passing routes
// need no human eyes.
//
// Usage:
//   node scripts/site-parity-harness.mjs --write-manifest   # regen route manifest from site/dist
//   node scripts/site-parity-harness.mjs [--routes /,/faq/] [--astro-base URL] [--nuxt-base URL]
//
// Defaults expect: astro `npm --prefix site run preview` (4321) and the Nuxt
// build served on 3640.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { chromium } from "playwright-core";

const root = process.cwd();
const manifestPath = resolve(root, "packages/site-nuxt/route-manifest.json");
const distDir = resolve(root, "site/dist");

function flag(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const astroBase = flag("--astro-base", "http://127.0.0.1:4321");
const nuxtBase = flag("--nuxt-base", "http://127.0.0.1:3640");
const routesFilter = flag("--routes", null)?.split(",");
const pixelThreshold = Number(flag("--threshold", "0.005"));
const outDir = resolve(
  root,
  flag("--out", `artifacts/site-nuxt/parity-${new Date().toISOString().replace(/[:.]/g, "-")}`),
);

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 375, height: 812 },
];

// ---------------------------------------------------------------------------
// Route manifest: generated from the Astro build output, the ground truth.
function routesFromDist() {
  const routes = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) {
        const rel = relative(distDir, full);
        if (rel === "404.html") {
          routes.push({ route: "/__parity-not-found__/", kind: "not_found" });
        } else if (rel === "index.html") {
          routes.push({ route: "/", kind: "page" });
        } else {
          routes.push({ route: `/${rel.replace(/\/index\.html$/, "")}/`, kind: "page" });
        }
      }
    }
  };
  walk(distDir);
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}

if (process.argv.includes("--write-manifest")) {
  if (!existsSync(distDir)) {
    console.error("site/dist not found. Run `npm --prefix site run build` first.");
    process.exit(1);
  }
  const routes = routesFromDist();
  writeFileSync(manifestPath, `${JSON.stringify({ source: "site/dist", routes }, null, 2)}\n`);
  console.log(`Wrote ${routes.length} routes to ${manifestPath}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const routes = manifest.routes.filter((r) => !routesFilter || routesFilter.includes(r.route));

const executablePath = `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const settleCss = `*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
}`;

async function capture(page, base, route, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.addStyleTag({ content: settleCss });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const text = await page.evaluate(() =>
    document.body.innerText.replace(/\s+/g, " ").trim(),
  );
  const title = await page.title();
  const png = await page.screenshot({ fullPage: true });
  return { text, title, png };
}

function comparePixels(aBuf, bBuf) {
  const a = PNG.sync.read(aBuf);
  const b = PNG.sync.read(bBuf);
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pad = (img) => {
    if (img.width === width && img.height === height) return img;
    const out = new PNG({ width, height, fill: true });
    out.data.fill(255);
    PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
    return out;
  };
  const pa = pad(a);
  const pb = pad(b);
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(pa.data, pb.data, diff.data, width, height, { threshold: 0.1 });
  return { ratio: diffPixels / (width * height), diff };
}

function firstTextDiff(a, b) {
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i += 1;
  const from = Math.max(0, i - 40);
  return {
    astro: a.slice(from, i + 80),
    nuxt: b.slice(from, i + 80),
  };
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();
const results = [];

for (const entry of routes) {
  const probeRoute = entry.kind === "not_found" ? "/__parity-not-found__/" : entry.route;
  for (const viewport of viewports) {
    const astro = await capture(page, astroBase, probeRoute, viewport);
    const nuxt = await capture(page, nuxtBase, probeRoute, viewport);
    const textMatch = astro.text === nuxt.text;
    const titleMatch = astro.title === nuxt.title;
    const { ratio, diff } = comparePixels(astro.png, nuxt.png);
    const pass = textMatch && titleMatch && ratio <= pixelThreshold;
    const result = {
      route: entry.route,
      viewport: viewport.name,
      textMatch,
      titleMatch,
      pixelRatio: Number(ratio.toFixed(5)),
      pass,
    };
    if (!textMatch) result.textDiff = firstTextDiff(astro.text, nuxt.text);
    if (!titleMatch) result.titles = { astro: astro.title, nuxt: nuxt.title };
    if (!pass) {
      const slug = `${entry.route.replace(/[^a-z0-9]+/gi, "_")}-${viewport.name}`;
      writeFileSync(join(outDir, `${slug}-astro.png`), astro.png);
      writeFileSync(join(outDir, `${slug}-nuxt.png`), nuxt.png);
      writeFileSync(join(outDir, `${slug}-diff.png`), PNG.sync.write(diff));
      result.diffImage = relative(root, join(outDir, `${slug}-diff.png`));
    }
    results.push(result);
    console.log(
      `${pass ? "PASS" : "FAIL"}  ${entry.route}  [${viewport.name}]  pixel=${(ratio * 100).toFixed(2)}%  text=${textMatch ? "match" : "DIFF"}  title=${titleMatch ? "match" : "DIFF"}`,
    );
  }
}

await browser.close();

const failed = results.filter((r) => !r.pass);
const report = {
  ranAt: new Date().toISOString(),
  astroBase,
  nuxtBase,
  pixelThreshold,
  total: results.length,
  passed: results.length - failed.length,
  results,
};
const reportPath = join(outDir, "parity-report.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n${report.passed}/${report.total} checks passed. Report: ${reportPath}`);
if (failed.length > 0) process.exitCode = 1;
