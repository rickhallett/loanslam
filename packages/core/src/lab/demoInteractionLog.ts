import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../generated/prisma/client";
import type { DemoInteractionEvent } from "../generated/prisma/client";

import type {
  ConversationState,
  DemoSessionResponse,
  DemoTurnResponse,
  IntakeField,
  TurnTrace,
  UiPlan,
  ValidatedTurnResult,
} from "@loanslam/contracts";

export type DemoInteractionEventType =
  | "session_started"
  | "message"
  | "intake"
  | "reset"
  | "cancel_handoff"
  | "error";

export interface DemoInteractionRecord {
  createdAt: string;
  eventType: DemoInteractionEventType;
  method: string;
  path: string;
  httpStatus: number;
  durationMs: number;
  conversationRef?: string | null | undefined;
  turn?: number | null;
  requestRef?: string | null;
  traceId?: string | null;
  customerMessage?: string | null;
  assistantMessage?: string | null;
  hostContext?: string | null;
  proposedAction?: string | null;
  finalAction?: string | null;
  actionChanged?: boolean | null;
  servingMode?: string | null;
  safetyFlags?: readonly string[];
  overrideCodes?: readonly string[];
  retrievalCount?: number | null;
  retrievalTopScore?: number | null;
  retrievedItemIds?: readonly string[];
  signalStatus?: string | null;
  signalPrimaryIntent?: string | null;
  signalRecommendedServingMode?: string | null;
  signalComparison?: string | null;
  uiPrimitive?: string | null;
  terminalSession?: boolean | null;
  requestedFields?: readonly string[];
  collectedFields?: readonly string[];
  displayResponseJson?: unknown;
  internalJson?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface DemoSessionSummary {
  conversationRef: string;
  startedAt: string;
  lastAt: string;
  eventCount: number;
  messageTurns: number;
  intakeEvents: number;
  resetEvents: number;
  maxTurn: number | null;
  terminalSession: boolean;
  hostContexts: string[];
  finalActions: string[];
  overrideCount: number;
}

export interface DemoLoggedEvent {
  id: number;
  createdAt: string;
  eventType: DemoInteractionEventType;
  method: string;
  path: string;
  httpStatus: number;
  durationMs: number;
  conversationRef: string | null;
  turn: number | null;
  requestRef: string | null;
  traceId: string | null;
  customerMessage: string | null;
  assistantMessage: string | null;
  hostContext: string | null;
  proposedAction: string | null;
  finalAction: string | null;
  actionChanged: boolean | null;
  servingMode: string | null;
  safetyFlags: string[];
  overrideCodes: string[];
  retrievalCount: number | null;
  retrievalTopScore: number | null;
  retrievedItemIds: string[];
  signalStatus: string | null;
  signalPrimaryIntent: string | null;
  signalRecommendedServingMode: string | null;
  signalComparison: string | null;
  uiPrimitive: string | null;
  terminalSession: boolean | null;
  requestedFields: string[];
  collectedFields: string[];
  displayResponseJson: unknown;
  internalJson: unknown;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface DemoInteractionLog {
  record(record: DemoInteractionRecord): Promise<void>;
  summaries(limit: number): Promise<DemoSessionSummary[]>;
  eventsForSession(conversationRef: string): Promise<DemoLoggedEvent[]>;
  turnEvent(
    conversationRef: string,
    turn: number,
  ): Promise<DemoLoggedEvent | undefined>;
  close(): Promise<void>;
}

export class PrismaDemoInteractionLog implements DemoInteractionLog {
  constructor(private readonly prisma: PrismaClient) {}

  async record(record: DemoInteractionRecord): Promise<void> {
    await this.prisma.demoInteractionEvent.create({
      data: {
        createdAt: new Date(record.createdAt),
        eventType: record.eventType,
        method: record.method,
        path: record.path,
        httpStatus: record.httpStatus,
        durationMs: record.durationMs,
        conversationRef: record.conversationRef ?? null,
        turn: record.turn ?? null,
        requestRef: record.requestRef ?? null,
        traceId: record.traceId ?? null,
        customerMessage: record.customerMessage ?? null,
        assistantMessage: record.assistantMessage ?? null,
        hostContext: record.hostContext ?? null,
        proposedAction: record.proposedAction ?? null,
        finalAction: record.finalAction ?? null,
        actionChanged: record.actionChanged ?? null,
        servingMode: record.servingMode ?? null,
        safetyFlags: jsonStringArray(record.safetyFlags),
        overrideCodes: jsonStringArray(record.overrideCodes),
        retrievalCount: record.retrievalCount ?? null,
        retrievalTopScore: record.retrievalTopScore ?? null,
        retrievedItemIds: jsonStringArray(record.retrievedItemIds),
        signalStatus: record.signalStatus ?? null,
        signalPrimaryIntent: record.signalPrimaryIntent ?? null,
        signalRecommendedServingMode:
          record.signalRecommendedServingMode ?? null,
        signalComparison: record.signalComparison ?? null,
        uiPrimitive: record.uiPrimitive ?? null,
        terminalSession: record.terminalSession ?? null,
        requestedFields: jsonStringArray(record.requestedFields),
        collectedFields: jsonStringArray(record.collectedFields),
        displayResponseJson: optionalJson(record.displayResponseJson),
        internalJson: optionalJson(record.internalJson),
        errorCode: record.errorCode ?? null,
        errorMessage: record.errorMessage ?? null,
      },
    });
  }

  async summaries(limit: number): Promise<DemoSessionSummary[]> {
    const rows = await this.prisma.$queryRaw<SummaryRow[]>`
      SELECT
        conversation_ref,
        MIN(created_at) AS started_at,
        MAX(created_at) AS last_at,
        COUNT(*)::int AS event_count,
        SUM(CASE WHEN event_type = 'message' THEN 1 ELSE 0 END)::int AS message_turns,
        SUM(CASE WHEN event_type = 'intake' THEN 1 ELSE 0 END)::int AS intake_events,
        SUM(CASE WHEN event_type = 'reset' THEN 1 ELSE 0 END)::int AS reset_events,
        MAX(turn) AS max_turn,
        BOOL_OR(COALESCE(terminal_session, false)) AS terminal_session,
        STRING_AGG(DISTINCT host_context, ',') FILTER (WHERE host_context IS NOT NULL) AS host_contexts,
        STRING_AGG(DISTINCT final_action, ',') FILTER (WHERE final_action IS NOT NULL) AS final_actions,
        SUM(CASE WHEN action_changed = true THEN 1 ELSE 0 END)::int AS override_count
      FROM demo_interaction_events
      WHERE conversation_ref IS NOT NULL
      GROUP BY conversation_ref
      ORDER BY last_at DESC
      LIMIT ${Math.max(1, limit)}
    `;

    return rows.map(summaryFromRow);
  }

  async eventsForSession(conversationRef: string): Promise<DemoLoggedEvent[]> {
    const rows = await this.prisma.demoInteractionEvent.findMany({
      where: { conversationRef },
      orderBy: { id: "asc" },
    });

    return rows.map(eventFromModel);
  }

  async turnEvent(
    conversationRef: string,
    turn: number,
  ): Promise<DemoLoggedEvent | undefined> {
    const row = await this.prisma.demoInteractionEvent.findFirst({
      where: {
        conversationRef,
        turn,
        eventType: {
          in: ["message", "intake"],
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    return row ? eventFromModel(row) : undefined;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export class InMemoryDemoInteractionLog implements DemoInteractionLog {
  private readonly events: DemoLoggedEvent[] = [];
  private nextId = 1;

  async record(record: DemoInteractionRecord): Promise<void> {
    this.events.push(loggedEventFromRecord(this.nextId++, record));
  }

  async summaries(limit: number): Promise<DemoSessionSummary[]> {
    const grouped = new Map<string, DemoLoggedEvent[]>();

    for (const event of this.events) {
      if (!event.conversationRef) {
        continue;
      }

      grouped.set(event.conversationRef, [
        ...(grouped.get(event.conversationRef) ?? []),
        event,
      ]);
    }

    return [...grouped.entries()]
      .map(([conversationRef, events]) =>
        summaryFromEvents(conversationRef, events),
      )
      .sort((left, right) => right.lastAt.localeCompare(left.lastAt))
      .slice(0, limit);
  }

  async eventsForSession(conversationRef: string): Promise<DemoLoggedEvent[]> {
    return this.events.filter(
      (event) => event.conversationRef === conversationRef,
    );
  }

  async turnEvent(
    conversationRef: string,
    turn: number,
  ): Promise<DemoLoggedEvent | undefined> {
    return [...this.events]
      .reverse()
      .find(
        (event) =>
          event.conversationRef === conversationRef &&
          event.turn === turn &&
          (event.eventType === "message" || event.eventType === "intake"),
      );
  }

  async close(): Promise<void> {}
}

export function openDemoInteractionLog(
  databaseUrl = demoInteractionDatabaseUrlFromEnv(process.env),
): DemoInteractionLog {
  if (!databaseUrl) {
    throw new Error(
      "Demo interaction logging requires DEMO_INTERACTION_DATABASE_URL or DATABASE_URL.",
    );
  }

  const adapter = demoInteractionPrismaAdapter(databaseUrl);

  return new PrismaDemoInteractionLog(new PrismaClient({ adapter }));
}

function demoInteractionPrismaAdapter(
  databaseUrl: string,
): PrismaNeon | PrismaPg {
  return isNeonDatabaseUrl(databaseUrl)
    ? new PrismaNeon({ connectionString: databaseUrl })
    : new PrismaPg({ connectionString: databaseUrl });
}

function isNeonDatabaseUrl(databaseUrl: string): boolean {
  try {
    return new URL(databaseUrl).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

export function openInMemoryDemoInteractionLog(): DemoInteractionLog {
  return new InMemoryDemoInteractionLog();
}

export function demoInteractionDatabaseUrlFromEnv(
  env: Record<string, string | undefined>,
): string | undefined {
  return (
    env.DEMO_INTERACTION_DATABASE_URL ??
    env.DATABASE_URL ??
    env.POSTGRES_PRISMA_URL ??
    env.POSTGRES_URL
  );
}

export async function recordDemoSessionStarted({
  log,
  createdAt,
  method,
  path,
  durationMs,
  response,
}: {
  log: DemoInteractionLog | undefined;
  createdAt: string;
  method: string;
  path: string;
  durationMs: number;
  response: DemoSessionResponse;
}): Promise<void> {
  await log?.record({
    createdAt,
    eventType: "session_started",
    method,
    path,
    httpStatus: 201,
    durationMs,
    conversationRef: response.conversationRef,
    displayResponseJson: stripContinuationToken(response),
  });
}

export async function recordDemoTurn({
  log,
  createdAt,
  method,
  path,
  durationMs,
  turn,
  userMessage,
  result,
  response,
}: {
  log: DemoInteractionLog | undefined;
  createdAt: string;
  method: string;
  path: string;
  durationMs: number;
  turn: number;
  userMessage: string;
  result: ValidatedTurnResult;
  response: DemoTurnResponse;
}): Promise<void> {
  const telemetry = response.telemetry;

  await log?.record({
    createdAt,
    eventType: "message",
    method,
    path,
    httpStatus: 200,
    durationMs,
    conversationRef: result.conversationRef,
    turn,
    requestRef: result.requestRef,
    traceId: result.trace.traceId,
    customerMessage: userMessage,
    assistantMessage: response.customerMessage,
    hostContext: response.hostContext,
    proposedAction: telemetry.proposedAction,
    finalAction: telemetry.finalAction,
    actionChanged: telemetry.actionChanged,
    servingMode: telemetry.servingMode,
    safetyFlags: telemetry.safetyFlags,
    overrideCodes: telemetry.overrides.map((override) => override.code),
    retrievalCount: telemetry.retrieval.count,
    retrievalTopScore: telemetry.retrieval.topScore,
    retrievedItemIds: telemetry.retrieval.matches.map((match) => match.itemId),
    signalStatus: telemetry.signal.status,
    signalPrimaryIntent: telemetry.signal.primaryIntent,
    signalRecommendedServingMode: telemetry.signal.recommendedServingMode,
    signalComparison: telemetry.signal.comparison,
    uiPrimitive: telemetry.uiPrimitive,
    terminalSession: response.terminalSession,
    requestedFields: telemetry.intake.requested,
    collectedFields: telemetry.intake.collected,
    displayResponseJson: stripContinuationToken(response),
    internalJson: { result },
  });
}

export async function recordDemoStructuredIntake({
  log,
  createdAt,
  method,
  path,
  durationMs,
  conversationRef,
  turn,
  submittedFields,
  result,
  response,
}: {
  log: DemoInteractionLog | undefined;
  createdAt: string;
  method: string;
  path: string;
  durationMs: number;
  conversationRef: string;
  turn: number;
  submittedFields: Record<string, string>;
  result: {
    state: ConversationState;
    finalAction: "create_ticket";
    ui: UiPlan;
    customerMessage: string;
    reference: string;
  };
  response: DemoTurnResponse;
}): Promise<void> {
  const telemetry = response.telemetry;

  await log?.record({
    createdAt,
    eventType: "intake",
    method,
    path,
    httpStatus: 200,
    durationMs,
    conversationRef,
    turn,
    customerMessage: "Submitted structured intake.",
    assistantMessage: response.customerMessage,
    hostContext: response.hostContext,
    proposedAction: telemetry.proposedAction,
    finalAction: telemetry.finalAction,
    actionChanged: telemetry.actionChanged,
    servingMode: telemetry.servingMode,
    safetyFlags: telemetry.safetyFlags,
    overrideCodes: telemetry.overrides.map((override) => override.code),
    retrievalCount: telemetry.retrieval.count,
    retrievalTopScore: telemetry.retrieval.topScore,
    retrievedItemIds: telemetry.retrieval.matches.map((match) => match.itemId),
    signalStatus: telemetry.signal.status,
    signalPrimaryIntent: telemetry.signal.primaryIntent,
    signalRecommendedServingMode: telemetry.signal.recommendedServingMode,
    signalComparison: telemetry.signal.comparison,
    uiPrimitive: telemetry.uiPrimitive,
    terminalSession: response.terminalSession,
    requestedFields: telemetry.intake.requested,
    collectedFields: telemetry.intake.collected,
    displayResponseJson: stripContinuationToken(response),
    internalJson: { submittedFields, result },
  });
}

export async function recordDemoStateEvent({
  log,
  createdAt,
  eventType,
  method,
  path,
  durationMs,
  conversationRef,
  state,
  response,
}: {
  log: DemoInteractionLog | undefined;
  createdAt: string;
  eventType: "reset" | "cancel_handoff";
  method: string;
  path: string;
  durationMs: number;
  conversationRef: string;
  state: ConversationState;
  response: DemoSessionResponse;
}): Promise<void> {
  await log?.record({
    createdAt,
    eventType,
    method,
    path,
    httpStatus: 200,
    durationMs,
    conversationRef,
    displayResponseJson: stripContinuationToken(response),
    internalJson: { state },
  });
}

export async function recordDemoError({
  log,
  createdAt,
  method,
  path,
  httpStatus,
  durationMs,
  conversationRef,
  errorCode,
  errorMessage,
  internalJson,
}: {
  log: DemoInteractionLog | undefined;
  createdAt: string;
  method: string;
  path: string;
  httpStatus: number;
  durationMs: number;
  conversationRef?: string | null;
  errorCode: string;
  errorMessage: string;
  internalJson?: unknown;
}): Promise<void> {
  await log?.record({
    createdAt,
    eventType: "error",
    method,
    path,
    httpStatus,
    durationMs,
    conversationRef,
    errorCode,
    errorMessage,
    internalJson,
  });
}

export function formatDemoLogSummary(
  summaries: readonly DemoSessionSummary[],
): string {
  if (summaries.length === 0) {
    return "No demo interactions logged.";
  }

  return summaries
    .map((summary) =>
      [
        `${summary.conversationRef}`,
        `  started: ${summary.startedAt}`,
        `  last: ${summary.lastAt}`,
        `  events: ${summary.eventCount}, turns: ${summary.messageTurns}, intake: ${summary.intakeEvents}, resets: ${summary.resetEvents}`,
        `  max turn: ${summary.maxTurn ?? "-"}`,
        `  contexts: ${summary.hostContexts.join(", ") || "-"}`,
        `  final actions: ${summary.finalActions.join(", ") || "-"}`,
        `  overrides: ${summary.overrideCount}, terminal: ${summary.terminalSession ? "yes" : "no"}`,
      ].join("\n"),
    )
    .join("\n\n");
}

export function formatDemoLogSession({
  events,
  includeFullInternal,
}: {
  events: readonly DemoLoggedEvent[];
  includeFullInternal: boolean;
}): string {
  if (events.length === 0) {
    return "No events found for that conversation.";
  }

  return events
    .map((event) => formatDemoLoggedEvent({ event, includeFullInternal }))
    .join("\n\n");
}

export function formatDemoLoggedEvent({
  event,
  includeFullInternal,
}: {
  event: DemoLoggedEvent;
  includeFullInternal: boolean;
}): string {
  const lines = [
    `#${event.id} ${event.createdAt} ${event.eventType} ${event.httpStatus} ${event.durationMs}ms`,
    `conversation: ${event.conversationRef ?? "-"} turn: ${event.turn ?? "-"}`,
  ];

  if (event.customerMessage) {
    lines.push(`customer: ${event.customerMessage}`);
  }

  if (event.assistantMessage) {
    lines.push(`assistant: ${event.assistantMessage}`);
  }

  if (event.finalAction || event.hostContext || event.uiPrimitive) {
    lines.push(
      `decision: proposed=${event.proposedAction ?? "-"} final=${event.finalAction ?? "-"} changed=${event.actionChanged ?? "-"} context=${event.hostContext ?? "-"} ui=${event.uiPrimitive ?? "-"}`,
    );
  }

  if (
    event.servingMode ||
    event.safetyFlags.length > 0 ||
    event.overrideCodes.length > 0
  ) {
    lines.push(
      `why: serving=${event.servingMode ?? "-"} flags=${event.safetyFlags.join(",") || "-"} overrides=${event.overrideCodes.join(",") || "-"}`,
    );
  }

  if (event.retrievalCount !== null || event.signalStatus) {
    lines.push(
      `evidence: retrieval=${event.retrievalCount ?? 0} top=${event.retrievalTopScore ?? 0} ids=${event.retrievedItemIds.join(",") || "-"} signal=${event.signalPrimaryIntent ?? "-"} -> ${event.signalRecommendedServingMode ?? "-"} (${event.signalComparison ?? event.signalStatus ?? "-"})`,
    );
  }

  if (
    event.requestedFields.length > 0 ||
    event.collectedFields.length > 0 ||
    event.terminalSession !== null
  ) {
    lines.push(
      `state: requested=${event.requestedFields.join(",") || "-"} collected=${event.collectedFields.join(",") || "-"} terminal=${event.terminalSession ?? "-"}`,
    );
  }

  if (event.errorCode || event.errorMessage) {
    lines.push(`error: ${event.errorCode ?? "-"} ${event.errorMessage ?? ""}`);
  }

  if (includeFullInternal && event.internalJson !== null) {
    lines.push("full internal:");
    lines.push(JSON.stringify(event.internalJson, null, 2));
  }

  return lines.join("\n");
}

function stripContinuationToken<
  Response extends DemoSessionResponse | DemoTurnResponse,
>(response: Response): Omit<Response, "continuationToken"> {
  const { continuationToken: _continuationToken, ...safeResponse } = response;
  return safeResponse;
}

function summaryFromRow(row: SummaryRow): DemoSessionSummary {
  return {
    conversationRef: row.conversation_ref,
    startedAt: toIsoString(row.started_at),
    lastAt: toIsoString(row.last_at),
    eventCount: toNumber(row.event_count),
    messageTurns: toNumber(row.message_turns),
    intakeEvents: toNumber(row.intake_events),
    resetEvents: toNumber(row.reset_events),
    maxTurn: row.max_turn,
    terminalSession: row.terminal_session === true,
    hostContexts: splitGroup(row.host_contexts),
    finalActions: splitGroup(row.final_actions),
    overrideCount: toNumber(row.override_count),
  };
}

function summaryFromEvents(
  conversationRef: string,
  events: readonly DemoLoggedEvent[],
): DemoSessionSummary {
  const sorted = [...events].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const hostContexts = distinctStrings(
    events.map((event) => event.hostContext).filter(isString),
  );
  const finalActions = distinctStrings(
    events.map((event) => event.finalAction).filter(isString),
  );

  return {
    conversationRef,
    startedAt: sorted[0]?.createdAt ?? "",
    lastAt: sorted[sorted.length - 1]?.createdAt ?? "",
    eventCount: events.length,
    messageTurns: events.filter((event) => event.eventType === "message")
      .length,
    intakeEvents: events.filter((event) => event.eventType === "intake").length,
    resetEvents: events.filter((event) => event.eventType === "reset").length,
    maxTurn:
      events.reduce<number | null>(
        (max, event) =>
          event.turn === null ? max : Math.max(max ?? event.turn, event.turn),
        null,
      ) ?? null,
    terminalSession: events.some((event) => event.terminalSession === true),
    hostContexts,
    finalActions,
    overrideCount: events.filter((event) => event.actionChanged === true)
      .length,
  };
}

function eventFromModel(row: DemoInteractionEvent): DemoLoggedEvent {
  return {
    id: toNumber(row.id),
    createdAt: row.createdAt.toISOString(),
    eventType: row.eventType as DemoInteractionEventType,
    method: row.method,
    path: row.path,
    httpStatus: row.httpStatus,
    durationMs: row.durationMs,
    conversationRef: row.conversationRef,
    turn: row.turn,
    requestRef: row.requestRef,
    traceId: row.traceId,
    customerMessage: row.customerMessage,
    assistantMessage: row.assistantMessage,
    hostContext: row.hostContext,
    proposedAction: row.proposedAction,
    finalAction: row.finalAction,
    actionChanged: row.actionChanged,
    servingMode: row.servingMode,
    safetyFlags: parseJsonArray(row.safetyFlags),
    overrideCodes: parseJsonArray(row.overrideCodes),
    retrievalCount: row.retrievalCount,
    retrievalTopScore: row.retrievalTopScore,
    retrievedItemIds: parseJsonArray(row.retrievedItemIds),
    signalStatus: row.signalStatus,
    signalPrimaryIntent: row.signalPrimaryIntent,
    signalRecommendedServingMode: row.signalRecommendedServingMode,
    signalComparison: row.signalComparison,
    uiPrimitive: row.uiPrimitive,
    terminalSession: row.terminalSession,
    requestedFields: parseJsonArray(row.requestedFields),
    collectedFields: parseJsonArray(row.collectedFields),
    displayResponseJson: row.displayResponseJson,
    internalJson: row.internalJson,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
  };
}

function loggedEventFromRecord(
  id: number,
  record: DemoInteractionRecord,
): DemoLoggedEvent {
  return {
    id,
    createdAt: record.createdAt,
    eventType: record.eventType,
    method: record.method,
    path: record.path,
    httpStatus: record.httpStatus,
    durationMs: record.durationMs,
    conversationRef: record.conversationRef ?? null,
    turn: record.turn ?? null,
    requestRef: record.requestRef ?? null,
    traceId: record.traceId ?? null,
    customerMessage: record.customerMessage ?? null,
    assistantMessage: record.assistantMessage ?? null,
    hostContext: record.hostContext ?? null,
    proposedAction: record.proposedAction ?? null,
    finalAction: record.finalAction ?? null,
    actionChanged: record.actionChanged ?? null,
    servingMode: record.servingMode ?? null,
    safetyFlags: [...(record.safetyFlags ?? [])],
    overrideCodes: [...(record.overrideCodes ?? [])],
    retrievalCount: record.retrievalCount ?? null,
    retrievalTopScore: record.retrievalTopScore ?? null,
    retrievedItemIds: [...(record.retrievedItemIds ?? [])],
    signalStatus: record.signalStatus ?? null,
    signalPrimaryIntent: record.signalPrimaryIntent ?? null,
    signalRecommendedServingMode: record.signalRecommendedServingMode ?? null,
    signalComparison: record.signalComparison ?? null,
    uiPrimitive: record.uiPrimitive ?? null,
    terminalSession: record.terminalSession ?? null,
    requestedFields: [...(record.requestedFields ?? [])],
    collectedFields: [...(record.collectedFields ?? [])],
    displayResponseJson: cloneJson(record.displayResponseJson),
    internalJson: cloneJson(record.internalJson),
    errorCode: record.errorCode ?? null,
    errorMessage: record.errorMessage ?? null,
  };
}

function jsonStringArray(
  value: readonly string[] | undefined,
): Prisma.InputJsonValue {
  return [...(value ?? [])];
}

function optionalJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull | typeof Prisma.JsonNull {
  if (value === undefined) {
    return Prisma.DbNull;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return cloneJson(value) as Prisma.InputJsonValue;
}

function cloneJson(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}

function parseJsonArray(value: unknown): string[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;

  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function splitGroup(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

function distinctStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

interface SummaryRow {
  conversation_ref: string;
  started_at: Date | string;
  last_at: Date | string;
  event_count: number | bigint;
  message_turns: number | bigint;
  intake_events: number | bigint;
  reset_events: number | bigint;
  max_turn: number | null;
  terminal_session: boolean | null;
  host_contexts: string | null;
  final_actions: string | null;
  override_count: number | bigint;
}
