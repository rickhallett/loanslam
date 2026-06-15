import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

// The widget is a same-origin HTTP client of the engine's lab server. Vite
// proxies /sessions through to the running engine (npm run core:serve), exactly
// as packages/lab-ui does, so no CORS handling or core changes are required.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const labApiTarget = env.LAB_API_TARGET || "http://127.0.0.1:8788";

  return {
    plugins: [vue()],
    server: {
      host: "127.0.0.1",
      port: 5174,
      proxy: {
        "/sessions": {
          target: labApiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4174,
      proxy: {
        "/sessions": {
          target: labApiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
