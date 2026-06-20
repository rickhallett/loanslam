import { defineConfig } from "vite";

// The host page is a static site that only talks to the widget over
// postMessage; it never calls the engine directly, so it needs no proxy.
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5180,
  },
  preview: {
    host: "127.0.0.1",
    port: 4180,
  },
});
