#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

import {
  dumpSession,
  fetchSession,
  resetSession,
  sendSessionMessage,
  startSession,
} from "./labApiClient";
import { planScenario } from "./scenarioPlan";

const baseUrlInput = z
  .string()
  .url()
  .optional()
  .describe(
    "Optional local lab API base URL. Defaults to http://127.0.0.1:8787.",
  );
const conversationRefInput = z
  .string()
  .trim()
  .min(1)
  .describe("Lab API conversationRef returned by lab_session_start.");

export function createLoanSlamLabApiMcpServer(): McpServer {
  const server = new McpServer({
    name: "loanslam-lab-api",
    version: "0.1.0",
  });

  server.registerTool(
    "lab_session_start",
    {
      title: "Start Lab Session",
      description: "Create a new in-memory LoanSlam Phase 0 lab API session.",
      inputSchema: {
        baseUrl: baseUrlInput,
      },
    },
    async ({ baseUrl }) => jsonToolResult(await startSession(options(baseUrl))),
  );

  server.registerTool(
    "lab_session_send",
    {
      title: "Send Lab Session Message",
      description:
        "Send exactly one customer message, then fetch the full session evidence.",
      inputSchema: {
        baseUrl: baseUrlInput,
        conversationRef: conversationRefInput,
        message: z
          .string()
          .trim()
          .min(1)
          .describe("Exactly one customer message to send."),
      },
    },
    async ({ baseUrl, conversationRef, message }) =>
      jsonToolResult(
        await sendSessionMessage({
          ...options(baseUrl),
          conversationRef,
          message,
        }),
      ),
  );

  server.registerTool(
    "lab_session_dump",
    {
      title: "Dump Lab Session",
      description:
        "Fetch and save the full lab API evidence artifact under artifacts/phase0.",
      inputSchema: {
        baseUrl: baseUrlInput,
        conversationRef: conversationRefInput,
        outDir: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe("Output directory under artifacts/phase0."),
        force: z
          .boolean()
          .optional()
          .describe(
            "Overwrite an existing artifact path if one somehow collides.",
          ),
      },
    },
    async ({ baseUrl, conversationRef, outDir, force }) =>
      jsonToolResult(
        await dumpSession({
          ...options(baseUrl),
          conversationRef,
          ...(outDir ? { outDir } : {}),
          ...(force === undefined ? {} : { force }),
        }),
      ),
  );

  server.registerTool(
    "lab_session_reset",
    {
      title: "Reset Lab Session",
      description: "Reset one in-memory lab API session.",
      inputSchema: {
        baseUrl: baseUrlInput,
        conversationRef: conversationRefInput,
      },
    },
    async ({ baseUrl, conversationRef }) =>
      jsonToolResult(
        await resetSession({
          ...options(baseUrl),
          conversationRef,
        }),
      ),
  );

  server.registerTool(
    "lab_session_summarize",
    {
      title: "Summarize Lab Session",
      description:
        "Fetch the full lab API session and return compact route/safety evidence.",
      inputSchema: {
        baseUrl: baseUrlInput,
        conversationRef: conversationRefInput,
      },
    },
    async ({ baseUrl, conversationRef }) =>
      jsonToolResult(
        await fetchSession({
          ...options(baseUrl),
          conversationRef,
        }),
      ),
  );

  server.registerTool(
    "lab_scenario_plan",
    {
      title: "Plan Lab Scenario",
      description:
        "Convert a brief into a first message, terminal condition, and constraints without sending turns.",
      inputSchema: {
        brief: z
          .string()
          .trim()
          .min(1)
          .describe("Customer scenario brief and terminal condition."),
      },
    },
    async ({ brief }) => jsonToolResult(planScenario(brief)),
  );

  return server;
}

export async function main(): Promise<void> {
  const server = createLoanSlamLabApiMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LoanSlam Lab API MCP server running on stdio");
}

function options(baseUrl: string | undefined): { baseUrl?: string } {
  return baseUrl ? { baseUrl } : {};
}

function jsonToolResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
