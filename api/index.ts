import type { IncomingMessage, Server, ServerResponse } from "node:http";

import { loadCorpusFromFile } from "../packages/core/src/corpus";
import { createLabServer } from "../packages/core/src/lab/server";
import { openDemoInteractionLog } from "../packages/core/src/lab/demoInteractionLog";
import { loadOpenAiPlannerConfig } from "../packages/core/src/planners/config";
import { OpenAiTurnPlanner } from "../packages/core/src/planners/openaiPlanner";
import { loadOpenAiSignalExtractorConfig } from "../packages/core/src/signals/config";
import { OpenAiSignalExtractor } from "../packages/core/src/signals/openaiSignalExtractor";

let server: Server | undefined;

export default function handler(
  request: IncomingMessage,
  response: ServerResponse,
): void {
  getServer().emit("request", request, response);
}

function getServer(): Server {
  if (server) {
    return server;
  }

  const signalExtractorConfig = loadOpenAiSignalExtractorConfig(process.env);
  const signalExtractor = signalExtractorConfig
    ? new OpenAiSignalExtractor({ config: signalExtractorConfig })
    : undefined;
  const demoAccessToken = process.env.DEMO_ACCESS_TOKEN;

  server = createLabServer({
    corpus: loadCorpusFromFile().items,
    plannerFactory: () =>
      new OpenAiTurnPlanner({
        config: loadOpenAiPlannerConfig(process.env),
      }),
    ...(signalExtractor ? { signalExtractor } : {}),
    enableTrustedLabRoutes: false,
    enableDemoRoutes: true,
    demoStateTokenSecret: requireEnv("DEMO_STATE_TOKEN_SECRET"),
    ...(demoAccessToken ? { demoAccessToken } : {}),
    demoInteractionLog: openDemoInteractionLog(),
    demoStaticAssets: {
      hostRoot: "packages/review-host/dist",
      widgetRoot: "packages/review-widget/dist",
    },
  });

  return server;
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for the Vercel demo API.`);
  }

  return value;
}
