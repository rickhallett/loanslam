import type {
  CorpusItem,
  PlannerMetadata,
  TurnPlan,
  TurnPlanner,
} from "@loanslam/contracts";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { openInMemoryDemoInteractionLog } from "./demoInteractionLog";
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
const tempDirs: string[] = [];

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
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
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

  it("does not mount demo routes by default", async () => {
    const baseUrl = await startTestServer();

    const created = await postJson(`${baseUrl}/demo/sessions`, {});

    expect(created.status).toBe(404);
    expect(created.body).toEqual({
      error: "not_found",
      message: "POST /demo/sessions is not a demo API route.",
    });
  });

  it("serves demo-safe responses without trusted lab routes in demo-only mode", async () => {
    const baseUrl = await startTestServer({
      enableTrustedLabRoutes: false,
      enableDemoRoutes: true,
      demoStateTokenSecret: "test-demo-secret",
    });

    const rawSession = await postJson(`${baseUrl}/sessions`, {});

    expect(rawSession.status).toBe(404);

    const created = await postJson(`${baseUrl}/demo/sessions`, {});

    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      conversationRef: "id-1",
      continuationToken: expect.any(String),
    });
    expect(created.body.continuationToken).not.toContain("id-1");

    const turn = await postJson(`${baseUrl}/demo/sessions/id-1/messages`, {
      message: "Can I apply online?",
      continuationToken: created.body.continuationToken,
    });

    expect(turn.status).toBe(200);
    expect(turn.body).toMatchObject({
      conversationRef: "id-1",
      requestRef: "id-2",
      customerMessage: "You can apply online.",
      ui: {
        primitive: "message",
        message: "You can apply online.",
      },
      terminalSession: false,
      hostContext: "general",
      continuationToken: expect.any(String),
      telemetry: {
        type: "turn-telemetry",
        turn: 1,
        proposedAction: "answer",
        finalAction: "answer",
        servingMode: "answer",
        retrieval: {
          count: 1,
          matches: [
            {
              itemId: "how-do-i-apply",
              servingMode: "answer",
            },
          ],
        },
        source: "turn",
      },
    });
    expect(turn.body).not.toHaveProperty("state");
    expect(turn.body).not.toHaveProperty("trace");
    expect(turn.body).not.toHaveProperty("plan");
    expect(JSON.stringify(turn.body)).not.toContain("retrievedMatches");

    const inspect = await getJson(`${baseUrl}/sessions/id-1`);

    expect(inspect.status).toBe(404);
  });

  it("can require an access token for demo routes", async () => {
    const baseUrl = await startTestServer({
      enableTrustedLabRoutes: false,
      enableDemoRoutes: true,
      demoStateTokenSecret: "test-demo-secret",
      demoAccessToken: "stakeholder-token",
    });

    const rejected = await postJson(`${baseUrl}/demo/sessions`, {});

    expect(rejected.status).toBe(401);
    expect(rejected.body).toEqual({
      error: "demo_access_required",
      message: "A valid demo access token is required.",
    });

    const accepted = await postJson(
      `${baseUrl}/demo/sessions`,
      {},
      { "x-demo-access-token": "stakeholder-token" },
    );

    expect(accepted.status).toBe(201);
    expect(accepted.body).toEqual({
      conversationRef: "id-1",
      continuationToken: expect.any(String),
    });
  });

  it("logs demo endpoint decision receipts for owner queries", async () => {
    const log = openInMemoryDemoInteractionLog();
    const baseUrl = await startTestServer({
      enableTrustedLabRoutes: false,
      enableDemoRoutes: true,
      demoStateTokenSecret: "test-demo-secret",
      demoInteractionLog: log,
    });
    const created = await postJson(`${baseUrl}/demo/sessions`, {});
    const turn = await postJson(`${baseUrl}/demo/sessions/id-1/messages`, {
      message: "Can I apply online?",
      continuationToken: created.body.continuationToken,
    });
    const event = await log.turnEvent("id-1", 1);

    expect(turn.status).toBe(200);
    expect(event).toMatchObject({
      eventType: "message",
      conversationRef: "id-1",
      turn: 1,
      customerMessage: "Can I apply online?",
      assistantMessage: "You can apply online.",
      proposedAction: "answer",
      finalAction: "answer",
      servingMode: "answer",
      retrievalCount: 1,
      retrievedItemIds: ["how-do-i-apply"],
    });
    expect(JSON.stringify(event?.displayResponseJson)).not.toContain(
      created.body.continuationToken,
    );
    expect(JSON.stringify(event?.internalJson)).toContain("retrievedMatches");
  });

  it("serves same-origin stakeholder static assets in demo-only mode", async () => {
    const demoStaticAssets = tempStaticAssets();
    const baseUrl = await startTestServer({
      enableTrustedLabRoutes: false,
      enableDemoRoutes: true,
      demoStaticAssets,
    });

    const host = await fetch(`${baseUrl}/`);
    const contact = await fetch(`${baseUrl}/contact/`);
    const contactNoSlash = await fetch(`${baseUrl}/contact`);
    const astroAsset = await fetch(`${baseUrl}/_astro/contact.css`);
    const widget = await fetch(`${baseUrl}/widget/`);
    const widgetAsset = await fetch(`${baseUrl}/assets/app.js`);
    const reportsIndex = await fetch(`${baseUrl}/reports/`);
    const report = await fetch(`${baseUrl}/reports/hell-week-full.html`);
    const inspect = await getJson(`${baseUrl}/sessions/id-1`);

    expect(host.status).toBe(200);
    expect(host.headers.get("content-type")).toContain("text/html");
    expect(await host.text()).toContain("Review host");
    expect(contact.status).toBe(200);
    expect(await contact.text()).toContain("Contact page");
    expect(contactNoSlash.status).toBe(200);
    expect(await contactNoSlash.text()).toContain("Contact page");
    expect(astroAsset.status).toBe(200);
    expect(await astroAsset.text()).toContain(".contact");
    expect(widget.status).toBe(200);
    expect(await widget.text()).toContain("Widget shell");
    expect(widgetAsset.status).toBe(200);
    expect(widgetAsset.headers.get("cache-control")).toContain("immutable");
    expect(await widgetAsset.text()).toContain("window.widgetLoaded");
    expect(reportsIndex.status).toBe(200);
    expect(await reportsIndex.text()).toContain("Evidence index");
    expect(report.status).toBe(200);
    expect(await report.text()).toContain("Hell Week report");
    expect(inspect.status).toBe(404);
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

async function startTestServer(
  options: Partial<Parameters<typeof createLabServer>[0]> = {},
): Promise<string> {
  const server = createLabServer({
    corpus,
    plannerFactory: plannerFactory(),
    idFactory: sequenceIds(),
    now: () => new Date("2026-06-13T12:00:00.000Z"),
    ...options,
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

function tempStaticAssets(): { hostRoot: string; widgetRoot: string } {
  const dir = mkdtempSync(join(tmpdir(), "loanslam-demo-static-"));
  tempDirs.push(dir);
  const hostRoot = join(dir, "host");
  const widgetRoot = join(dir, "widget");
  mkdirSync(join(widgetRoot, "assets"), { recursive: true });
  mkdirSync(hostRoot, { recursive: true });
  mkdirSync(join(hostRoot, "contact"), { recursive: true });
  mkdirSync(join(hostRoot, "_astro"), { recursive: true });
  writeFileSync(join(hostRoot, "index.html"), "<h1>Review host</h1>");
  writeFileSync(join(hostRoot, "contact", "index.html"), "<h1>Contact page</h1>");
  writeFileSync(join(hostRoot, "_astro", "contact.css"), ".contact {}");
  writeFileSync(join(hostRoot, "styles.css"), "body { color: black; }");
  writeFileSync(join(hostRoot, "loader.js"), "window.hostLoaded = true;");
  writeFileSync(join(hostRoot, "devtools.js"), "window.devtoolsLoaded = true;");
  mkdirSync(join(hostRoot, "reports"), { recursive: true });
  writeFileSync(join(hostRoot, "reports", "index.html"), "Evidence index");
  writeFileSync(
    join(hostRoot, "reports", "hell-week-full.html"),
    "Hell Week report",
  );
  writeFileSync(join(widgetRoot, "index.html"), "<h1>Widget shell</h1>");
  writeFileSync(
    join(widgetRoot, "assets", "app.js"),
    "window.widgetLoaded = true;",
  );

  return { hostRoot, widgetRoot };
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
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
