import type {
  CorpusItem,
  PlannerMetadata,
  TurnPlan,
  TurnPlanner,
} from "@loanslam/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { createLabServer } from "./server";

const corpus: CorpusItem[] = [
  {
    id: "how-do-i-apply",
    question: "How do I apply?",
    question_variants: ["Can I apply online?"],
    serving_mode: "answer",
    answer_text: "You can apply online.",
    links: [],
    tags: ["apply"],
  },
];

const metadata: PlannerMetadata = {
  provider: "inline",
  model: "lab-test",
  promptVersion: "lab-test",
};

const answerPlan: TurnPlan = {
  action: "answer",
  customerMessage: "You can apply online.",
  ui: {
    primitive: "message",
    message: "You can apply online.",
    links: [],
  },
  reasonCode: "grounded_answer",
  collectedFacts: {},
  requestedFields: [],
  grounding: {
    citedItemIds: ["how-do-i-apply"],
    servingMode: "answer",
    confidence: "supported",
  },
  safetyFlags: [],
  traceSummary: "Answered from corpus.",
};

const openServers: Array<{ close(callback?: (error?: Error) => void): void }> =
  [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error?: Error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
});

describe("lab server", () => {
  it("creates sessions, processes messages, exposes traces, and resets state", async () => {
    const baseUrl = await startTestServer();

    const created = await postJson(`${baseUrl}/sessions`, {});

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      conversationRef: "id-1",
      state: {
        conversationRef: "id-1",
        history: [],
      },
    });

    const turn = await postJson(`${baseUrl}/sessions/id-1/messages`, {
      message: "Can I apply online?",
    });

    expect(turn.status).toBe(200);
    expect(turn.body).toMatchObject({
      finalAction: "answer",
      customerMessage: "You can apply online.",
      trace: {
        retrievedMatches: [
          expect.objectContaining({
            itemId: "how-do-i-apply",
          }),
        ],
      },
    });

    const inspected = await getJson(`${baseUrl}/sessions/id-1`);

    expect(inspected.status).toBe(200);
    expect(inspected.body.state.history).toHaveLength(2);
    expect(inspected.body.traces).toHaveLength(1);

    const reset = await postJson(`${baseUrl}/sessions/id-1/reset`, {});

    expect(reset.status).toBe(200);
    expect(reset.body).toMatchObject({
      state: {
        conversationRef: "id-1",
        history: [],
      },
      traces: [],
    });
  });

  it("returns safe JSON errors for unknown sessions and malformed JSON", async () => {
    const baseUrl = await startTestServer();

    const missing = await postJson(`${baseUrl}/sessions/missing/messages`, {
      message: "Hello",
    });

    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      error: "session_not_found",
      message: "Session missing was not found.",
    });

    const malformed = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({
      error: "invalid_json",
      message: "Request body must be valid JSON.",
    });
  });
});

async function startTestServer(): Promise<string> {
  const server = createLabServer({
    corpus,
    plannerFactory: plannerFactory(),
    idFactory: sequenceIds(),
    now: () => new Date("2026-06-13T12:00:00.000Z"),
  });

  openServers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected server to listen on a TCP address.");
  }

  return `http://127.0.0.1:${address.port}`;
}

function plannerFactory(): () => TurnPlanner & { metadata: PlannerMetadata } {
  return () => ({
    metadata,
    async planTurn() {
      return answerPlan;
    },
  });
}

function sequenceIds(): () => string {
  let next = 0;

  return () => `id-${++next}`;
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function getJson(url: string) {
  const response = await fetch(url);

  return {
    status: response.status,
    body: await response.json(),
  };
}
