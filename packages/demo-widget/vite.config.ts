import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

// The widget is a same-origin HTTP client of the demo-safe API. Vite proxies
// /demo through to the running engine in demo-only mode, so the browser never
// calls the trusted /sessions lab evidence routes.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const labApiTarget = env.LAB_API_TARGET || "http://127.0.0.1:8788";

  return {
    plugins: [vue()],
    build: {
      sourcemap: false,
    },
    server: {
      host: "127.0.0.1",
      port: 5174,
      proxy: {
        "/demo": {
          target: labApiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4174,
      proxy: {
        "/demo": {
          target: labApiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
