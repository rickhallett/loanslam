import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import type {
  ConversationState,
  CorpusItem,
  DemoSessionResponse,
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
import {
  mapStructuredIntakeToDemoResponse,
  mapTurnResultToDemoResponse,
} from "./demoDisplay";
import type { DemoInteractionLog } from "./demoInteractionLog";
import {
  recordDemoError,
  recordDemoSessionStarted,
  recordDemoStateEvent,
  recordDemoStructuredIntake,
  recordDemoTurn,
} from "./demoInteractionLog";
import { sealDemoStateToken, unsealDemoStateToken } from "./demoStateToken";

type PlannerWithMetadata = TurnPlanner & { metadata?: PlannerMetadata };

export interface CreateLabServerOptions {
  corpus: readonly CorpusItem[];
  plannerFactory: () => PlannerWithMetadata;
  signalExtractor?: SignalExtractor;
  idFactory?: () => string;
  now?: Date | (() => Date);
  enableTrustedLabRoutes?: boolean;
  enableDemoRoutes?: boolean;
  demoStateTokenSecret?: string;
  demoAccessToken?: string;
  demoInteractionLog?: DemoInteractionLog;
  demoStaticAssets?: DemoStaticAssets;
}

export interface DemoStaticAssets {
  hostRoot: string;
  widgetRoot: string;
}

interface LabSession {
  state: ConversationState;
  traces: TurnTrace[];
}

interface JsonBody {
  message?: unknown;
  continuationToken?: unknown;
}

export function createLabServer({
  corpus,
  plannerFactory,
  signalExtractor,
  idFactory = randomUUID,
  now,
  enableTrustedLabRoutes = true,
  enableDemoRoutes = false,
  demoStateTokenSecret,
  demoAccessToken,
  demoInteractionLog,
  demoStaticAssets,
}: CreateLabServerOptions) {
  const sessions = new Map<string, LabSession>();
  const demoSessions = new Map<string, LabSession>();

  const server = createServer(async (request, response) => {
    try {
      await handleRequest({
        request,
        response,
        sessions,
        demoSessions,
        corpus,
        plannerFactory,
        signalExtractor,
        idFactory,
        now,
        enableTrustedLabRoutes,
        enableDemoRoutes,
        demoStateTokenSecret,
        demoAccessToken,
        demoInteractionLog,
        demoStaticAssets,
      });
    } catch (error) {
      const method = request.method ?? "GET";
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

      if (pathname.startsWith("/demo/")) {
        await recordDemoError({
          log: demoInteractionLog,
          createdAt: new Date().toISOString(),
          method,
          path: pathname,
          httpStatus: 500,
          durationMs: 0,
          errorCode: "internal_error",
          errorMessage:
            error instanceof Error ? error.message : "Unexpected server error.",
          internalJson: {
            error: error instanceof Error ? error.stack : String(error),
          },
        });
      }

      writeJson(response, 500, {
        error: "internal_error",
        message:
          error instanceof Error
            ? error.message
            : "Unexpected lab server error.",
      });
    }
  });
  server.on("close", () => {
    void demoInteractionLog?.close();
  });

  return server;
}

async function handleRequest({
  request,
  response,
  sessions,
  demoSessions,
  corpus,
  plannerFactory,
  signalExtractor,
  idFactory,
  now,
  enableTrustedLabRoutes,
  enableDemoRoutes,
  demoStateTokenSecret,
  demoAccessToken,
  demoInteractionLog,
  demoStaticAssets,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  sessions: Map<string, LabSession>;
  demoSessions: Map<string, LabSession>;
  corpus: readonly CorpusItem[];
  plannerFactory: () => PlannerWithMetadata;
  signalExtractor: SignalExtractor | undefined;
  idFactory: () => string;
  now: Date | (() => Date) | undefined;
  enableTrustedLabRoutes: boolean;
  enableDemoRoutes: boolean;
  demoStateTokenSecret: string | undefined;
  demoAccessToken: string | undefined;
  demoInteractionLog: DemoInteractionLog | undefined;
  demoStaticAssets: DemoStaticAssets | undefined;
}): Promise<void> {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

  if (pathname.startsWith("/demo/")) {
    if (!enableDemoRoutes) {
      writeJson(response, 404, {
        error: "not_found",
        message: `${method} ${pathname} is not a demo API route.`,
      });
      return;
    }

    if (!authorizeDemoRequest({ request, response, demoAccessToken })) {
      return;
    }

    await handleDemoRequest({
      request,
      response,
      sessions: demoSessions,
      corpus,
      plannerFactory,
      signalExtractor,
      idFactory,
      now,
      demoStateTokenSecret,
      demoInteractionLog,
      method,
      pathname,
    });
    return;
  }

  if (
    demoStaticAssets &&
    (await serveDemoStaticAsset({
      method,
      pathname,
      response,
      assets: demoStaticAssets,
    }))
  ) {
    return;
  }

  if (!enableTrustedLabRoutes) {
    writeJson(response, 404, {
      error: "not_found",
      message: `${method} ${pathname} is not enabled on the demo API.`,
    });
    return;
  }

  const labRouteContext: LabRouteContext = {
    request,
    response,
    sessions,
    corpus,
    plannerFactory,
    signalExtractor,
    idFactory,
    now,
    conversationRef: "",
  };

  await dispatchRoute({
    routes: labRoutes,
    method,
    pathname,
    context: labRouteContext,
    response,
    notFoundMessage: `${method} ${pathname} is not a lab API route.`,
  });
}

async function handleDemoRequest({
  request,
  response,
  sessions,
  corpus,
  plannerFactory,
  signalExtractor,
  idFactory,
  now,
  demoStateTokenSecret,
  demoInteractionLog,
  method,
  pathname,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  sessions: Map<string, LabSession>;
  corpus: readonly CorpusItem[];
  plannerFactory: () => PlannerWithMetadata;
  signalExtractor: SignalExtractor | undefined;
  idFactory: () => string;
  now: Date | (() => Date) | undefined;
  demoStateTokenSecret: string | undefined;
  demoInteractionLog: DemoInteractionLog | undefined;
  method: string;
  pathname: string;
}): Promise<void> {
  const startedAt = Date.now();
  const createdAt = resolveNow(now).toISOString();

  const demoRouteContext: DemoRouteContext = {
    request,
    response,
    sessions,
    corpus,
    plannerFactory,
    signalExtractor,
    idFactory,
    now,
    demoStateTokenSecret,
    demoInteractionLog,
    method,
    pathname,
    conversationRef: "",
    startedAt,
    createdAt,
  };

  await dispatchRoute({
    routes: demoRoutes,
    method,
    pathname,
    context: demoRouteContext,
    response,
    notFoundMessage: `${method} ${pathname} is not a demo API route.`,
  });
}

// --- Route tables ----------------------------------------------------------
// The lab and demo APIs are declarative tables: each row is (method, path
// matcher, handler). dispatchRoute walks the table in order and dispatches the
// first match. A string matcher is an exact path; a RegExp matcher captures the
// conversationRef in group 1. Intra-table order is safe because the matchers are
// mutually exclusive; the top-level ordering in handleRequest (demo + auth, then
// static assets, then lab) is the part that must not move.

interface BaseRouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  sessions: Map<string, LabSession>;
  corpus: readonly CorpusItem[];
  plannerFactory: () => PlannerWithMetadata;
  signalExtractor: SignalExtractor | undefined;
  idFactory: () => string;
  now: Date | (() => Date) | undefined;
  conversationRef: string;
}

type LabRouteContext = BaseRouteContext;

interface DemoRouteContext extends BaseRouteContext {
  demoStateTokenSecret: string | undefined;
  demoInteractionLog: DemoInteractionLog | undefined;
  method: string;
  pathname: string;
  startedAt: number;
  createdAt: string;
}

interface Route<Context> {
  method: string;
  match: string | RegExp;
  handle: (context: Context) => Promise<void>;
}

async function dispatchRoute<Context extends BaseRouteContext>({
  routes,
  method,
  pathname,
  context,
  response,
  notFoundMessage,
}: {
  routes: readonly Route<Context>[];
  method: string;
  pathname: string;
  context: Context;
  response: ServerResponse;
  notFoundMessage: string;
}): Promise<void> {
  for (const route of routes) {
    if (method !== route.method) {
      continue;
    }

    if (typeof route.match === "string") {
      if (pathname !== route.match) {
        continue;
      }

      await route.handle(context);
      return;
    }

    const matched = pathname.match(route.match);
    if (!matched) {
      continue;
    }

    await route.handle({
      ...context,
      conversationRef: decodeURIComponent(matched[1] ?? ""),
    });
    return;
  }

  writeJson(response, 404, {
    error: "not_found",
    message: notFoundMessage,
  });
}

const labRoutes: readonly Route<LabRouteContext>[] = [
  { method: "POST", match: "/sessions", handle: handleLabCreateSession },
  {
    method: "POST",
    match: /^\/sessions\/([^/]+)\/messages$/,
    handle: handleLabMessage,
  },
  { method: "GET", match: /^\/sessions\/([^/]+)$/, handle: handleLabInspect },
  {
    method: "POST",
    match: /^\/sessions\/([^/]+)\/reset$/,
    handle: handleLabReset,
  },
  {
    method: "POST",
    match: /^\/sessions\/([^/]+)\/intake$/,
    handle: handleLabIntake,
  },
  {
    method: "POST",
    match: /^\/sessions\/([^/]+)\/cancel-handoff$/,
    handle: handleLabCancel,
  },
];

const demoRoutes: readonly Route<DemoRouteContext>[] = [
  { method: "POST", match: "/demo/sessions", handle: handleDemoCreateSession },
  {
    method: "POST",
    match: /^\/demo\/sessions\/([^/]+)\/messages$/,
    handle: handleDemoMessage,
  },
  {
    method: "POST",
    match: /^\/demo\/sessions\/([^/]+)\/reset$/,
    handle: handleDemoReset,
  },
  {
    method: "POST",
    match: /^\/demo\/sessions\/([^/]+)\/intake$/,
    handle: handleDemoIntake,
  },
  {
    method: "POST",
    match: /^\/demo\/sessions\/([^/]+)\/cancel-handoff$/,
    handle: handleDemoCancel,
  },
];

async function handleLabCreateSession(ctx: LabRouteContext): Promise<void> {
  const { request, response, sessions, idFactory } = ctx;
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
}

async function handleLabMessage(ctx: LabRouteContext): Promise<void> {
  const {
    request,
    response,
    sessions,
    conversationRef,
    corpus,
    plannerFactory,
    signalExtractor,
    idFactory,
    now,
  } = ctx;
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
}

async function handleLabInspect(ctx: LabRouteContext): Promise<void> {
  const { response, sessions, conversationRef } = ctx;
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
}

async function handleLabReset(ctx: LabRouteContext): Promise<void> {
  const { request, response, sessions, conversationRef } = ctx;
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
}

async function handleLabIntake(ctx: LabRouteContext): Promise<void> {
  const { request, response, sessions, conversationRef, idFactory, now } = ctx;
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
}

async function handleLabCancel(ctx: LabRouteContext): Promise<void> {
  const { request, response, sessions, conversationRef } = ctx;
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
}

async function handleDemoCreateSession(ctx: DemoRouteContext): Promise<void> {
  const {
    request,
    response,
    sessions,
    idFactory,
    demoStateTokenSecret,
    demoInteractionLog,
    method,
    pathname,
    createdAt,
    startedAt,
  } = ctx;
  const body = await readJsonBody(request, response);

  if (body === undefined) {
    return;
  }

  const conversationRef = idFactory();
  const state = emptyConversationState(conversationRef);
  const responsePayload = persistDemoState({
    sessions,
    conversationRef,
    state,
    traces: [],
    demoStateTokenSecret,
  });
  await recordDemoSessionStarted({
    log: demoInteractionLog,
    createdAt,
    method,
    path: pathname,
    durationMs: Date.now() - startedAt,
    response: responsePayload,
  });
  writeJson(response, 201, responsePayload);
}

async function handleDemoMessage(ctx: DemoRouteContext): Promise<void> {
  const {
    request,
    response,
    sessions,
    conversationRef,
    corpus,
    plannerFactory,
    signalExtractor,
    idFactory,
    now,
    demoStateTokenSecret,
    demoInteractionLog,
    method,
    pathname,
    createdAt,
    startedAt,
  } = ctx;
  const body = await readJsonBody(request, response);

  if (body === undefined) {
    return;
  }

  if (typeof body.message !== "string" || body.message.trim() === "") {
    await recordDemoError({
      log: demoInteractionLog,
      createdAt,
      method,
      path: pathname,
      httpStatus: 400,
      durationMs: Date.now() - startedAt,
      conversationRef,
      errorCode: "invalid_message",
      errorMessage: "Request body must include a non-empty message string.",
    });
    writeJson(response, 400, {
      error: "invalid_message",
      message: "Request body must include a non-empty message string.",
    });
    return;
  }

  const session = loadDemoState({
    body,
    response,
    sessions,
    conversationRef,
    demoStateTokenSecret,
  });

  if (!session) {
    return;
  }

  const turn = nextDisplayTurn(session.state);
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
  const persisted = persistDemoState({
    sessions,
    conversationRef,
    state: result.state,
    traces: session.traces,
    demoStateTokenSecret,
  });
  const responsePayload = mapTurnResultToDemoResponse({
    result,
    turn,
    continuationToken: persisted.continuationToken,
  });
  await recordDemoTurn({
    log: demoInteractionLog,
    createdAt,
    method,
    path: pathname,
    durationMs: Date.now() - startedAt,
    turn,
    userMessage: body.message,
    result,
    response: responsePayload,
  });
  writeJson(response, 200, responsePayload);
}

async function handleDemoReset(ctx: DemoRouteContext): Promise<void> {
  const {
    request,
    response,
    sessions,
    conversationRef,
    demoStateTokenSecret,
    demoInteractionLog,
    method,
    pathname,
    createdAt,
    startedAt,
  } = ctx;
  const body = await readJsonBody(request, response);

  if (body === undefined) {
    return;
  }

  const session = loadDemoState({
    body,
    response,
    sessions,
    conversationRef,
    demoStateTokenSecret,
  });

  if (!session) {
    return;
  }

  const state = emptyConversationState(conversationRef);
  const responsePayload = persistDemoState({
    sessions,
    conversationRef,
    state,
    traces: [],
    demoStateTokenSecret,
  });
  await recordDemoStateEvent({
    log: demoInteractionLog,
    createdAt,
    eventType: "reset",
    method,
    path: pathname,
    durationMs: Date.now() - startedAt,
    conversationRef,
    state,
    response: responsePayload,
  });
  writeJson(response, 200, responsePayload);
}

async function handleDemoIntake(ctx: DemoRouteContext): Promise<void> {
  const {
    request,
    response,
    sessions,
    conversationRef,
    idFactory,
    now,
    demoStateTokenSecret,
    demoInteractionLog,
    method,
    pathname,
    createdAt,
    startedAt,
  } = ctx;
  const body = await readJsonBody(request, response);

  if (body === undefined) {
    return;
  }

  const session = loadDemoState({
    body,
    response,
    sessions,
    conversationRef,
    demoStateTokenSecret,
  });

  if (!session) {
    return;
  }

  const validation = validateIntakeBody(body);

  if (!validation.ok) {
    await recordDemoError({
      log: demoInteractionLog,
      createdAt,
      method,
      path: pathname,
      httpStatus: 400,
      durationMs: Date.now() - startedAt,
      conversationRef,
      errorCode: "invalid_intake",
      errorMessage: validation.message,
    });
    writeJson(response, 400, {
      error: "invalid_intake",
      message: validation.message,
    });
    return;
  }

  const turn = nextDisplayTurn(session.state);
  const result = completeStructuredHandoff({
    state: session.state,
    fields: validation.fields,
    idFactory,
    now: resolveNow(now),
  });
  session.state = result.state;
  const persisted = persistDemoState({
    sessions,
    conversationRef,
    state: result.state,
    traces: session.traces,
    demoStateTokenSecret,
  });
  const responsePayload = mapStructuredIntakeToDemoResponse({
    conversationRef,
    state: result.state,
    finalAction: result.finalAction,
    ui: result.ui,
    customerMessage: result.customerMessage,
    reference: result.reference,
    turn,
    continuationToken: persisted.continuationToken,
  });
  await recordDemoStructuredIntake({
    log: demoInteractionLog,
    createdAt,
    method,
    path: pathname,
    durationMs: Date.now() - startedAt,
    conversationRef,
    turn,
    submittedFields: validation.fields,
    result,
    response: responsePayload,
  });
  writeJson(response, 200, responsePayload);
}

async function handleDemoCancel(ctx: DemoRouteContext): Promise<void> {
  const {
    request,
    response,
    sessions,
    conversationRef,
    demoStateTokenSecret,
    demoInteractionLog,
    method,
    pathname,
    createdAt,
    startedAt,
  } = ctx;
  const body = await readJsonBody(request, response);

  if (body === undefined) {
    return;
  }

  const session = loadDemoState({
    body,
    response,
    sessions,
    conversationRef,
    demoStateTokenSecret,
  });

  if (!session) {
    return;
  }

  session.state = cancelHandoff(session.state);
  const responsePayload = persistDemoState({
    sessions,
    conversationRef,
    state: session.state,
    traces: session.traces,
    demoStateTokenSecret,
  });
  await recordDemoStateEvent({
    log: demoInteractionLog,
    createdAt,
    eventType: "cancel_handoff",
    method,
    path: pathname,
    durationMs: Date.now() - startedAt,
    conversationRef,
    state: session.state,
    response: responsePayload,
  });
  writeJson(response, 200, responsePayload);
}

async function serveDemoStaticAsset({
  method,
  pathname,
  response,
  assets,
}: {
  method: string;
  pathname: string;
  response: ServerResponse;
  assets: DemoStaticAssets;
}): Promise<boolean> {
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }

  const route = resolveDemoStaticRoute(pathname, assets);

  if (!route) {
    return false;
  }

  try {
    const fileStat = await stat(route.filePath);

    if (!fileStat.isFile()) {
      return false;
    }

    response.writeHead(200, {
      "content-type": contentTypeForPath(route.filePath),
      "cache-control": route.cacheControl,
    });

    if (method === "HEAD") {
      response.end();
      return true;
    }

    response.end(await readFile(route.filePath));
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}

function resolveDemoStaticRoute(
  pathname: string,
  assets: DemoStaticAssets,
): { filePath: string; cacheControl: string } | null {
  if (pathname === "/" || pathname === "/index.html") {
    return {
      filePath: safeStaticPath(assets.hostRoot, "index.html"),
      cacheControl: "no-store",
    };
  }

  if (pathname === "/widget" || pathname === "/widget/") {
    return {
      filePath: safeStaticPath(assets.widgetRoot, "index.html"),
      cacheControl: "no-store",
    };
  }

  if (pathname.startsWith("/widget/")) {
    return {
      filePath: safeStaticPath(assets.widgetRoot, pathname.slice(8)),
      cacheControl: cacheControlForStaticPath(pathname),
    };
  }

  if (pathname.startsWith("/assets/")) {
    return {
      filePath: safeStaticPath(assets.widgetRoot, pathname.slice(1)),
      cacheControl: cacheControlForStaticPath(pathname),
    };
  }

  if (pathname === "/reports" || pathname === "/reports/") {
    return {
      filePath: safeStaticPath(assets.hostRoot, "reports/index.html"),
      cacheControl: "no-store",
    };
  }

  if (pathname.startsWith("/reports/")) {
    return {
      filePath: safeStaticPath(assets.hostRoot, pathname.slice(1)),
      cacheControl: cacheControlForStaticPath(pathname),
    };
  }

  if (["/styles.css", "/loader.js", "/devtools.js"].includes(pathname)) {
    return {
      filePath: safeStaticPath(assets.hostRoot, pathname.slice(1)),
      cacheControl: cacheControlForStaticPath(pathname),
    };
  }

  return resolveHostStaticRoute(pathname, assets);
}

function resolveHostStaticRoute(
  pathname: string,
  assets: DemoStaticAssets,
): { filePath: string; cacheControl: string } | null {
  const relativePath = pathname.replace(/^\/+/, "");

  if (!relativePath) {
    return null;
  }

  if (pathname.endsWith("/")) {
    return {
      filePath: safeStaticPath(assets.hostRoot, `${relativePath}index.html`),
      cacheControl: "no-store",
    };
  }

  if (relativePath.includes(".")) {
    return {
      filePath: safeStaticPath(assets.hostRoot, relativePath),
      cacheControl: cacheControlForStaticPath(pathname),
    };
  }

  return {
    filePath: safeStaticPath(assets.hostRoot, `${relativePath}/index.html`),
    cacheControl: "no-store",
  };
}

function safeStaticPath(root: string, relativePath: string): string {
  const resolvedRoot = resolve(root);
  const resolvedFile = resolve(resolvedRoot, relativePath);

  if (
    resolvedFile !== resolvedRoot &&
    !resolvedFile.startsWith(`${resolvedRoot}${sep}`)
  ) {
    throw new Error("Static asset path escaped the configured root.");
  }

  return resolvedFile;
}

function cacheControlForStaticPath(pathname: string): string {
  return pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-store";
}

function contentTypeForPath(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function authorizeDemoRequest({
  request,
  response,
  demoAccessToken,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  demoAccessToken: string | undefined;
}): boolean {
  if (!demoAccessToken) {
    return true;
  }

  const authorization = request.headers.authorization;
  const bearer =
    typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
  const header = request.headers["x-demo-access-token"];
  const accessHeader = Array.isArray(header) ? header[0] : header;

  if (bearer === demoAccessToken || accessHeader === demoAccessToken) {
    return true;
  }

  writeJson(response, 401, {
    error: "demo_access_required",
    message: "A valid demo access token is required.",
  });
  return false;
}

function loadDemoState({
  body,
  response,
  sessions,
  conversationRef,
  demoStateTokenSecret,
}: {
  body: JsonBody;
  response: ServerResponse;
  sessions: Map<string, LabSession>;
  conversationRef: string;
  demoStateTokenSecret: string | undefined;
}): LabSession | null {
  if (demoStateTokenSecret) {
    if (
      typeof body.continuationToken !== "string" ||
      body.continuationToken.trim() === ""
    ) {
      writeJson(response, 400, {
        error: "missing_continuation_token",
        message: "Request body must include a continuation token.",
      });
      return null;
    }

    const state = unsealDemoStateToken({
      token: body.continuationToken,
      secret: demoStateTokenSecret,
    });

    if (!state || state.conversationRef !== conversationRef) {
      writeJson(response, 400, {
        error: "invalid_continuation_token",
        message: "The demo continuation token is invalid for this session.",
      });
      return null;
    }

    return { state, traces: [] };
  }

  const session = sessions.get(conversationRef);

  if (!session) {
    writeSessionNotFound(response, conversationRef);
    return null;
  }

  return session;
}

function persistDemoState({
  sessions,
  conversationRef,
  state,
  traces,
  demoStateTokenSecret,
}: {
  sessions: Map<string, LabSession>;
  conversationRef: string;
  state: ConversationState;
  traces: TurnTrace[];
  demoStateTokenSecret: string | undefined;
}): DemoSessionResponse {
  if (demoStateTokenSecret) {
    return {
      conversationRef,
      continuationToken: sealDemoStateToken({
        state,
        secret: demoStateTokenSecret,
      }),
    };
  }

  sessions.set(conversationRef, { state, traces });
  return { conversationRef };
}

function nextDisplayTurn(state: ConversationState): number {
  return Math.floor(state.history.length / 2) + 1;
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
