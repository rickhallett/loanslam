import { createServer, type IncomingMessage, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertAllowedBaseUrl,
  dumpSession,
  sendSessionMessage,
  startSession,
} from "./labApiClient";

const servers: Server[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true })),
  );
});

describe("Lab API client", () => {
  it("allows only configured local base URLs", () => {
    expect(assertAllowedBaseUrl()).toBe("http://127.0.0.1:8787");
    expect(() =>
      assertAllowedBaseUrl({ baseUrl: "https://example.com" }),
    ).toThrow("http");
    expect(() =>
      assertAllowedBaseUrl({ baseUrl: "http://127.0.0.1:9999" }),
    ).toThrow("not allowed");
  });

  it("starts a session", async () => {
    const { baseUrl } = await startTestServer();

    await expect(
      startSession({ baseUrl, allowedBaseUrls: [baseUrl] }),
    ).resolves.toMatchObject({
      baseUrl,
      conversationRef: "test-session",
      summary: {
        conversationRef: "test-session",
        messageCount: 0,
        traceCount: 0,
      },
    });
  });

  it("sends one message and fetches the full session after the POST", async () => {
    const requests: string[] = [];
    const { baseUrl } = await startTestServer({ requests });

    const result = await sendSessionMessage({
      baseUrl,
      allowedBaseUrls: [baseUrl],
      conversationRef: "test-session",
      message: "How do I apply?",
    });

    expect(requests).toEqual([
      "POST /sessions/test-session/messages",
      "GET /sessions/test-session",
    ]);
    expect(result.summary).toMatchObject({
      conversationRef: "test-session",
      messageCount: 2,
      traceCount: 1,
      lastAction: "answer",
      selectedServingMode: "answer",
      finalCustomerMessage: "You can apply online.",
    });
  });

  it("writes a validated dump under artifacts/phase0", async () => {
    const { baseUrl } = await startTestServer();
    const repoRoot = await mkdtemp(join(tmpdir(), "loanslam-mcp-test-"));
    tempDirs.push(repoRoot);

    const result = await dumpSession({
      baseUrl,
      allowedBaseUrls: [baseUrl],
      conversationRef: "test-session",
      repoRoot,
      outDir: "artifacts/phase0/mcp-test",
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    });

    expect(result.artifactPath).toContain("artifacts/phase0/mcp-test");
    await expect(readFile(result.artifactPath, "utf8")).resolves.toContain(
      '"conversationRef": "test-session"',
    );
  });

  it("rejects dump paths outside artifacts/phase0", async () => {
    const { baseUrl } = await startTestServer();
    const repoRoot = await mkdtemp(join(tmpdir(), "loanslam-mcp-test-"));
    tempDirs.push(repoRoot);

    await expect(
      dumpSession({
        baseUrl,
        allowedBaseUrls: [baseUrl],
        conversationRef: "test-session",
        repoRoot,
        outDir: "tmp",
      }),
    ).rejects.toThrow("artifacts/phase0");
  });
});

async function startTestServer({
  requests,
}: {
  requests?: string[];
} = {}): Promise<{ baseUrl: string }> {
  const server = createServer(async (request, response) => {
    requests?.push(`${request.method} ${request.url}`);

    if (request.method === "POST" && request.url === "/sessions") {
      writeJson(response, 201, {
        conversationRef: "test-session",
        state: emptyState(),
      });
      return;
    }

    if (
      request.method === "POST" &&
      request.url === "/sessions/test-session/messages"
    ) {
      await readBody(request);
      writeJson(response, 200, {
        conversationRef: "test-session",
        finalAction: "answer",
        customerMessage: "You can apply online.",
        validatorOverrides: [],
        state: populatedState(),
        trace: trace(),
      });
      return;
    }

    if (request.method === "GET" && request.url === "/sessions/test-session") {
      writeJson(response, 200, {
        conversationRef: "test-session",
        state: populatedState(),
        traces: [trace()],
      });
      return;
    }

    response.writeHead(404);
    response.end();
  });

  servers.push(server);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP test server address.");
  }

  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

function emptyState() {
  return {
    conversationRef: "test-session",
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
  };
}

function populatedState() {
  return {
    ...emptyState(),
    history: [
      {
        id: "inbound",
        role: "customer",
        content: "How do I apply?",
        createdAt: "2026-06-15T12:00:00.000Z",
      },
      {
        id: "outbound",
        role: "assistant",
        content: "You can apply online.",
        createdAt: "2026-06-15T12:00:01.000Z",
      },
    ],
    lastAction: "answer",
  };
}

function trace() {
  return {
    finalAction: "answer",
    selectedServingMode: "answer",
    effectiveServingMode: "answer",
    safetyFlags: [],
    validatorOverrides: [],
    customerMessage: "You can apply online.",
  };
}

function writeJson(
  response: Parameters<Parameters<typeof createServer>[0]>[1],
  status: number,
  body: unknown,
) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<void> {
  for await (const _chunk of request) {
    // Consume the request body so the test server mirrors the lab API shape.
  }
}
