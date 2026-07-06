import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  compatibilityDate: "2026-07-01",
  devtools: { enabled: false },
  css: [
    "@fontsource-variable/bricolage-grotesque",
    "@fontsource-variable/plus-jakarta-sans",
    fileURLToPath(new URL("./assets/global.css", import.meta.url)),
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
      { dir: fileURLToPath(new URL("./public", import.meta.url)) },
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
      // Still needed for integrated-poc API shims and review-host devtools
      // imports; site content/assets now live inside this package.
      fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
    },
  },
  typescript: { strict: true },
});
