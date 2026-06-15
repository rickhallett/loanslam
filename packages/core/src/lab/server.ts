import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";

import type {
  ConversationState,
  CorpusItem,
  PlannerMetadata,
  SignalExtractor,
  TurnPlanner,
  TurnTrace,
} from "@loanslam/contracts";

import { processTurn } from "../engine";

type PlannerWithMetadata = TurnPlanner & { metadata?: PlannerMetadata };

export interface CreateLabServerOptions {
  corpus: readonly CorpusItem[];
  plannerFactory: () => PlannerWithMetadata;
  signalExtractor?: SignalExtractor;
  idFactory?: () => string;
  now?: Date | (() => Date);
}

interface LabSession {
  state: ConversationState;
  traces: TurnTrace[];
}

interface JsonBody {
  message?: unknown;
}

export function createLabServer({
  corpus,
  plannerFactory,
  signalExtractor,
  idFactory = randomUUID,
  now,
}: CreateLabServerOptions) {
  const sessions = new Map<string, LabSession>();

  return createServer(async (request, response) => {
    try {
      await handleRequest({
        request,
        response,
        sessions,
        corpus,
        plannerFactory,
        signalExtractor,
        idFactory,
        now,
      });
    } catch (error) {
      writeJson(response, 500, {
        error: "internal_error",
        message:
          error instanceof Error
            ? error.message
            : "Unexpected lab server error.",
      });
    }
  });
}

async function handleRequest({
  request,
  response,
  sessions,
  corpus,
  plannerFactory,
  signalExtractor,
  idFactory,
  now,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  sessions: Map<string, LabSession>;
  corpus: readonly CorpusItem[];
  plannerFactory: () => PlannerWithMetadata;
  signalExtractor?: SignalExtractor;
  idFactory: () => string;
  now: Date | (() => Date) | undefined;
}): Promise<void> {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

  if (method === "POST" && pathname === "/sessions") {
    const body = await readJsonBody(request, response);

    if (body === undefined) {
      return;
    }

    const conversationRef = idFactory();
    const state = emptyConversationState(conversationRef);
    const session = { state, traces: [] };
    sessions.set(conversationRef, session);
    writeJson(response, 201, {
      conversationRef,
      state,
    });
    return;
  }

  const messageMatch = pathname.match(/^\/sessions\/([^/]+)\/messages$/);

  if (method === "POST" && messageMatch) {
    const conversationRef = decodeURIComponent(messageMatch[1] ?? "");
    const session = sessions.get(conversationRef);

    if (!session) {
      writeSessionNotFound(response, conversationRef);
      return;
    }

    const body = await readJsonBody(request, response);

    if (body === undefined) {
      return;
    }

    if (typeof body.message !== "string" || body.message.trim() === "") {
      writeJson(response, 400, {
        error: "invalid_message",
        message: "Request body must include a non-empty message string.",
      });
      return;
    }

    const result = await processTurn({
      state: session.state,
      userMessage: body.message,
      planner: plannerFactory(),
      signalExtractor,
      corpus,
      idFactory,
      now: resolveNow(now),
    });
    session.state = result.state;
    session.traces.push(result.trace);
    writeJson(response, 200, result);
    return;
  }

  const inspectMatch = pathname.match(/^\/sessions\/([^/]+)$/);

  if (method === "GET" && inspectMatch) {
    const conversationRef = decodeURIComponent(inspectMatch[1] ?? "");
    const session = sessions.get(conversationRef);

    if (!session) {
      writeSessionNotFound(response, conversationRef);
      return;
    }

    writeJson(response, 200, {
      conversationRef,
      state: session.state,
      traces: session.traces,
    });
    return;
  }

  const resetMatch = pathname.match(/^\/sessions\/([^/]+)\/reset$/);

  if (method === "POST" && resetMatch) {
    const conversationRef = decodeURIComponent(resetMatch[1] ?? "");
    const session = sessions.get(conversationRef);

    if (!session) {
      writeSessionNotFound(response, conversationRef);
      return;
    }

    const body = await readJsonBody(request, response);

    if (body === undefined) {
      return;
    }

    session.state = emptyConversationState(conversationRef);
    session.traces = [];
    writeJson(response, 200, {
      conversationRef,
      state: session.state,
      traces: session.traces,
    });
    return;
  }

  writeJson(response, 404, {
    error: "not_found",
    message: `${method} ${pathname} is not a lab API route.`,
  });
}

async function readJsonBody(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<JsonBody | undefined> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();

  if (!rawBody) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody) as unknown;

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      writeJson(response, 400, {
        error: "invalid_json",
        message: "Request body must be a JSON object.",
      });
      return undefined;
    }

    return parsed;
  } catch {
    writeJson(response, 400, {
      error: "invalid_json",
      message: "Request body must be valid JSON.",
    });
    return undefined;
  }
}

function emptyConversationState(conversationRef: string): ConversationState {
  return {
    conversationRef,
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
  };
}

function resolveNow(now: Date | (() => Date) | undefined): Date {
  if (now instanceof Date) {
    return now;
  }

  return now ? now() : new Date();
}

function writeSessionNotFound(
  response: ServerResponse,
  conversationRef: string,
): void {
  writeJson(response, 404, {
    error: "session_not_found",
    message: `Session ${conversationRef} was not found.`,
  });
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body)}\n`);
}
