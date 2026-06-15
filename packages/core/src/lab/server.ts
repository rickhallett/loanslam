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

import {
  cancelHandoff,
  completeStructuredHandoff,
  processTurn,
} from "../engine";
import { standardHandoffFields } from "../policy";

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
  signalExtractor: SignalExtractor | undefined;
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
      ...(signalExtractor ? { signalExtractor } : {}),
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

  const intakeMatch = pathname.match(/^\/sessions\/([^/]+)\/intake$/);

  if (method === "POST" && intakeMatch) {
    const conversationRef = decodeURIComponent(intakeMatch[1] ?? "");
    const session = sessions.get(conversationRef);

    if (!session) {
      writeSessionNotFound(response, conversationRef);
      return;
    }

    const body = await readJsonBody(request, response);

    if (body === undefined) {
      return;
    }

    const validation = validateIntakeBody(body);

    if (!validation.ok) {
      writeJson(response, 400, {
        error: "invalid_intake",
        message: validation.message,
      });
      return;
    }

    const result = completeStructuredHandoff({
      state: session.state,
      fields: validation.fields,
      idFactory,
      now: resolveNow(now),
    });
    session.state = result.state;
    writeJson(response, 200, {
      conversationRef,
      state: result.state,
      finalAction: result.finalAction,
      ui: result.ui,
      customerMessage: result.customerMessage,
      reference: result.reference,
    });
    return;
  }

  const cancelMatch = pathname.match(/^\/sessions\/([^/]+)\/cancel-handoff$/);

  if (method === "POST" && cancelMatch) {
    const conversationRef = decodeURIComponent(cancelMatch[1] ?? "");
    const session = sessions.get(conversationRef);

    if (!session) {
      writeSessionNotFound(response, conversationRef);
      return;
    }

    const body = await readJsonBody(request, response);

    if (body === undefined) {
      return;
    }

    session.state = cancelHandoff(session.state);
    writeJson(response, 200, {
      conversationRef,
      state: session.state,
    });
    return;
  }

  writeJson(response, 404, {
    error: "not_found",
    message: `${method} ${pathname} is not a lab API route.`,
  });
}

function validateIntakeBody(
  body: JsonBody,
):
  | { ok: true; fields: Record<string, string> }
  | { ok: false; message: string } {
  const fields: Record<string, string> = {};
  const raw = body as Record<string, unknown>;

  for (const field of standardHandoffFields) {
    const value = raw[field];

    if (typeof value !== "string" || value.trim() === "") {
      return { ok: false, message: `Missing or empty field: ${field}.` };
    }

    fields[field] = value.trim();
  }

  if (!fields.email?.includes("@")) {
    return { ok: false, message: "A valid email address is required." };
  }

  return { ok: true, fields };
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
