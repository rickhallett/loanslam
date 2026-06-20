import type { Server } from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadCorpusFromFile } from "../corpus";
import { loadOpenAiPlannerConfig } from "../planners/config";
import { OpenAiTurnPlanner } from "../planners/openaiPlanner";
import { loadOpenAiSignalExtractorConfig } from "../signals/config";
import { OpenAiSignalExtractor } from "../signals/openaiSignalExtractor";
import { createLabServer } from "./server";

const runLiveTests = process.env.RUN_LIVE_LLM_TESTS === "1";
const describeLive = runLiveTests ? describe : describe.skip;

let server: Server | undefined;
let baseUrl: string | undefined;

describeLive(
  "live lab endpoint with OpenAI planner and signal extractor",
  () => {
    beforeAll(async () => {
      const signalConfig = loadOpenAiSignalExtractorConfig(process.env);

      if (!signalConfig) {
        throw new Error(
          "Live endpoint tests require OPENAI_SIGNAL_EXTRACTOR_ENABLED=1 or OPENAI_SIGNAL_EXTRACTOR_API_KEY.",
        );
      }

      const labServer = createLabServer({
        corpus: loadCorpusFromFile().items,
        plannerFactory: () =>
          new OpenAiTurnPlanner({
            config: loadOpenAiPlannerConfig(process.env),
          }),
        signalExtractor: new OpenAiSignalExtractor({ config: signalConfig }),
        enableTrustedLabRoutes: true,
        enableDemoRoutes: false,
      });

      server = labServer;

      await new Promise<void>((resolve) => {
        labServer.listen(0, "127.0.0.1", resolve);
      });

      const address = labServer.address();

      if (!address || typeof address === "string") {
        throw new Error("Expected live lab server to listen on a TCP address.");
      }

      baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
      if (!server) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    });

    it("routes the Hell Week switch-answer-to-account case through the real HTTP and LLM path", async () => {
      const conversationRef = await startSession();

      await sendMessage(conversationRef, "How do I apply online?");
      const result = await sendMessage(
        conversationRef,
        "Actually what is my balance?",
      );

      expectLiveHandoff(result);
    }, 30_000);

    it("routes the Hell Week cred-sort-code case through the real HTTP and LLM path", async () => {
      const conversationRef = await startSession();
      const result = await sendMessage(
        conversationRef,
        "My sort code is 12-34-56 and account number is 12345678.",
      );

      expectLiveHandoff(result);
      expect(readRecord(result).trace).toMatchObject({
        safetyFlags: expect.arrayContaining([
          "account_specific_request",
          "forbidden_credentials",
          "sensitive_overshare",
        ]),
      });
    }, 30_000);
  },
);

async function startSession(): Promise<string> {
  const body = await requestJson("/sessions", {
    method: "POST",
    body: "{}",
  });

  return String(readRecord(body).conversationRef);
}

async function sendMessage(conversationRef: string, message: string) {
  return requestJson(
    `/sessions/${encodeURIComponent(conversationRef)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
  );
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  if (!baseUrl) {
    throw new Error("Live lab endpoint was not started.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed: ${response.status}`,
    );
  }

  return body;
}

function expectLiveHandoff(result: unknown): void {
  const record = readRecord(result);
  const trace = readRecord(record.trace);

  expect(record.finalAction).toBe("request_handoff_intake");
  expect(readRecord(record.ui).primitive).toBe("intake_form");
  expect(trace.selectedServingMode).toBe("handoff_account_specific");
  expect(trace.effectiveServingMode).toBe("handoff_account_specific");
  expect(trace.shadowSignalStatus).toBe("fulfilled");
  expect(readRecord(trace.shadowSignalBundle).recommendedServingMode).toBe(
    "handoff_account_specific",
  );
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected JSON object.");
  }

  return value as Record<string, unknown>;
}
