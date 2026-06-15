import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

// Same transport as packages/demo-widget and packages/lab-ui: the widget is a
// same-origin HTTP client of the engine's lab server, and Vite proxies
// /sessions through to the running engine (npm run core:serve). No CORS handling
// and no core changes are required. Only the port differs from demo-widget so
// the two demos can be developed side by side.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const labApiTarget = env.LAB_API_TARGET || "http://127.0.0.1:8788";

  return {
    plugins: [vue()],
    server: {
      host: "127.0.0.1",
      port: 5175,
      proxy: {
        "/sessions": {
          target: labApiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4175,
      proxy: {
        "/sessions": {
          target: labApiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
