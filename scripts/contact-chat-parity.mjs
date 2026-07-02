// Compare the Astro contact page (live iframe widget) against the Nuxt
// contact page (native panel): closed state pixels, open-state chrome pixels,
// and structural assertions on panel geometry/colors.
import { chromium } from "playwright-core";
import { homedir } from "node:os";
import { writeFileSync, mkdirSync } from "node:fs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const executablePath = `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const [astroBase, nuxtBase, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const settle = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`;
const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

function ratio(aBuf, bBuf, name) {
  const a = PNG.sync.read(aBuf);
  const b = PNG.sync.read(bBuf);
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pad = (img) => {
    const out = new PNG({ width, height });
    out.data.fill(255);
    PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
    return out;
  };
  const diff = new PNG({ width, height });
  const n = pixelmatch(pad(a).data, pad(b).data, diff.data, width, height, { threshold: 0.1 });
  writeFileSync(`${outDir}/${name}-diff.png`, PNG.sync.write(diff));
  return n / (width * height);
}

const browser = await chromium.launch({ executablePath, headless: true });

async function load(base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/contact/?widget=local`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: settle });
  await page.evaluate(() => document.fonts.ready);
  // Wait for the panel (iframe or native) to be present and open.
  await page.waitForSelector("#mal-panel", { state: "visible", timeout: 20000 });
  await page.waitForTimeout(800);
  return page;
}

const astro = await load(astroBase);
const nuxt = await load(nuxtBase);

// Structural assertions on the open panel chrome.
const box = (p) => p.evaluate(() => {
  const el = document.getElementById("mal-panel");
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return { w: r.width, h: r.height, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom, radius: s.borderRadius, z: s.zIndex };
});
const [ab, nb] = [await box(astro), await box(nuxt)];
check("panel-geometry", JSON.stringify(ab) === JSON.stringify(nb), `${JSON.stringify(ab)} vs ${JSON.stringify(nb)}`);

const launcher = (p) => p.evaluate(() => {
  const el = document.getElementById("mal-launcher");
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return { w: r.width, h: r.height, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom, bg: s.backgroundColor };
});
const [al, nl] = [await launcher(astro), await launcher(nuxt)];
check("launcher-chrome", JSON.stringify(al) === JSON.stringify(nl), `${JSON.stringify(al)} vs ${JSON.stringify(nl)}`);

// Open-state pixels (panel content: iframe widget vs native port).
const openA = await astro.screenshot();
const openN = await nuxt.screenshot();
writeFileSync(`${outDir}/open-astro.png`, openA);
writeFileSync(`${outDir}/open-nuxt.png`, openN);
const openRatio = ratio(openA, openN, "open");
check("open-state-pixels", openRatio <= 0.02, `${(openRatio * 100).toFixed(2)}% (escalation threshold 2%)`);

// Closed state: click the launcher to close on both.
for (const p of [astro, nuxt]) {
  await p.locator("#mal-launcher").click();
  await p.waitForTimeout(400);
}
const closedA = await astro.screenshot();
const closedN = await nuxt.screenshot();
writeFileSync(`${outDir}/closed-astro.png`, closedA);
writeFileSync(`${outDir}/closed-nuxt.png`, closedN);
const closedRatio = ratio(closedA, closedN, "closed");
check("closed-state-pixels", closedRatio <= 0.005, `${(closedRatio * 100).toFixed(2)}%`);

await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed. Artifacts: ${outDir}`);
if (results.some((r) => !r)) process.exitCode = 1;
