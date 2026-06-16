import { defineConfig } from "vite";

// The host page is a static site that only talks to the widget over
// postMessage; it never calls the engine directly, so it needs no proxy.
// Port differs from demo-host so the two demos can run side by side.
export default defineConfig({
  build: {
    sourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: 5181,
  },
  preview: {
    host: "127.0.0.1",
    port: 4181,
  },
});
