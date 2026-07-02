import { fileURLToPath } from "node:url";

// The Astro site under site/ stays the single source of truth for content
// JSON, global CSS, and public assets until cutover (D041); this app imports
// them in place so content parity holds by construction.
const siteDir = fileURLToPath(new URL("../../site", import.meta.url));

export default defineNuxtConfig({
  compatibilityDate: "2026-07-01",
  devtools: { enabled: false },
  css: [
    "@fontsource-variable/bricolage-grotesque",
    "@fontsource-variable/plus-jakarta-sans",
    `${siteDir}/src/styles/global.css`,
  ],
  app: {
    head: {
      htmlAttrs: { lang: "en-GB" },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        // Prototype: keep out of search indexes until launch (matches Astro).
        { name: "robots", content: "noindex, nofollow" },
      ],
      link: [{ rel: "icon", type: "image/png", href: "/favicon.png" }],
    },
  },
  nitro: {
    publicAssets: [
      { dir: `${siteDir}/public` },
      // The Hell Week report dashboards the old site service exposed (D044);
      // consumed in place from review-host like the other shared sources.
      {
        dir: fileURLToPath(
          new URL("../review-host/public/reports", import.meta.url),
        ),
        baseURL: "/reports",
      },
    ],
  },
  vite: {
    // Content JSON keys like "process" must not become top-level named
    // exports in SSR chunks (they collide with the Node process global).
    json: { namedExports: false },
    server: {
      fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
    },
  },
  typescript: { strict: true },
});
