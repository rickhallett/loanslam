import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

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

export class DemoInteractionLog {
  private readonly db: DatabaseSync;

  constructor(readonly databasePath: string) {
    const resolvedPath = resolve(databasePath);
    mkdirSync(dirname(resolvedPath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(resolvedPath);
    chmodSync(resolvedPath, 0o600);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS demo_interaction_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        event_type TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        http_status INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        conversation_ref TEXT,
        turn INTEGER,
        request_ref TEXT,
        trace_id TEXT,
        customer_message TEXT,
        assistant_message TEXT,
        host_context TEXT,
        proposed_action TEXT,
        final_action TEXT,
        action_changed INTEGER,
        serving_mode TEXT,
        safety_flags_json TEXT NOT NULL DEFAULT '[]',
        override_codes_json TEXT NOT NULL DEFAULT '[]',
        retrieval_count INTEGER,
        retrieval_top_score REAL,
        retrieved_item_ids_json TEXT NOT NULL DEFAULT '[]',
        signal_status TEXT,
        signal_primary_intent TEXT,
        signal_recommended_serving_mode TEXT,
        signal_comparison TEXT,
        ui_primitive TEXT,
        terminal_session INTEGER,
        requested_fields_json TEXT NOT NULL DEFAULT '[]',
        collected_fields_json TEXT NOT NULL DEFAULT '[]',
        display_response_json TEXT,
        internal_json TEXT,
        error_code TEXT,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS demo_interaction_events_conversation_idx
        ON demo_interaction_events (conversation_ref, id);
      CREATE INDEX IF NOT EXISTS demo_interaction_events_created_idx
        ON demo_interaction_events (created_at);
      CREATE INDEX IF NOT EXISTS demo_interaction_events_turn_idx
        ON demo_interaction_events (conversation_ref, turn);
    `);
  }

  record(record: DemoInteractionRecord): void {
    this.db
      .prepare(
        `
          INSERT INTO demo_interaction_events (
            created_at, event_type, method, path, http_status, duration_ms,
            conversation_ref, turn, request_ref, trace_id,
            customer_message, assistant_message, host_context,
            proposed_action, final_action, action_changed, serving_mode,
            safety_flags_json, override_codes_json,
            retrieval_count, retrieval_top_score, retrieved_item_ids_json,
            signal_status, signal_primary_intent, signal_recommended_serving_mode,
            signal_comparison, ui_primitive, terminal_session,
            requested_fields_json, collected_fields_json,
            display_response_json, internal_json, error_code, error_message
          ) VALUES (
            $created_at, $event_type, $method, $path, $http_status, $duration_ms,
            $conversation_ref, $turn, $request_ref, $trace_id,
            $customer_message, $assistant_message, $host_context,
            $proposed_action, $final_action, $action_changed, $serving_mode,
            $safety_flags_json, $override_codes_json,
            $retrieval_count, $retrieval_top_score, $retrieved_item_ids_json,
            $signal_status, $signal_primary_intent, $signal_recommended_serving_mode,
            $signal_comparison, $ui_primitive, $terminal_session,
            $requested_fields_json, $collected_fields_json,
            $display_response_json, $internal_json, $error_code, $error_message
          )
        `,
      )
      .run({
        $created_at: record.createdAt,
        $event_type: record.eventType,
        $method: record.method,
        $path: record.path,
        $http_status: record.httpStatus,
        $duration_ms: record.durationMs,
        $conversation_ref: record.conversationRef ?? null,
        $turn: record.turn ?? null,
        $request_ref: record.requestRef ?? null,
        $trace_id: record.traceId ?? null,
        $customer_message: record.customerMessage ?? null,
        $assistant_message: record.assistantMessage ?? null,
        $host_context: record.hostContext ?? null,
        $proposed_action: record.proposedAction ?? null,
        $final_action: record.finalAction ?? null,
        $action_changed: booleanToInteger(record.actionChanged),
        $serving_mode: record.servingMode ?? null,
        $safety_flags_json: JSON.stringify(record.safetyFlags ?? []),
        $override_codes_json: JSON.stringify(record.overrideCodes ?? []),
        $retrieval_count: record.retrievalCount ?? null,
        $retrieval_top_score: record.retrievalTopScore ?? null,
        $retrieved_item_ids_json: JSON.stringify(record.retrievedItemIds ?? []),
        $signal_status: record.signalStatus ?? null,
        $signal_primary_intent: record.signalPrimaryIntent ?? null,
        $signal_recommended_serving_mode:
          record.signalRecommendedServingMode ?? null,
        $signal_comparison: record.signalComparison ?? null,
        $ui_primitive: record.uiPrimitive ?? null,
        $terminal_session: booleanToInteger(record.terminalSession),
        $requested_fields_json: JSON.stringify(record.requestedFields ?? []),
        $collected_fields_json: JSON.stringify(record.collectedFields ?? []),
        $display_response_json:
          record.displayResponseJson === undefined
            ? null
            : JSON.stringify(record.displayResponseJson),
        $internal_json:
          record.internalJson === undefined
            ? null
            : JSON.stringify(record.internalJson),
        $error_code: record.errorCode ?? null,
        $error_message: record.errorMessage ?? null,
      });
  }

  summaries(limit: number): DemoSessionSummary[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            conversation_ref,
            MIN(created_at) AS started_at,
            MAX(created_at) AS last_at,
            COUNT(*) AS event_count,
            SUM(CASE WHEN event_type = 'message' THEN 1 ELSE 0 END) AS message_turns,
            SUM(CASE WHEN event_type = 'intake' THEN 1 ELSE 0 END) AS intake_events,
            SUM(CASE WHEN event_type = 'reset' THEN 1 ELSE 0 END) AS reset_events,
            MAX(turn) AS max_turn,
            MAX(COALESCE(terminal_session, 0)) AS terminal_session,
            GROUP_CONCAT(DISTINCT host_context) AS host_contexts,
            GROUP_CONCAT(DISTINCT final_action) AS final_actions,
            SUM(CASE WHEN action_changed = 1 THEN 1 ELSE 0 END) AS override_count
          FROM demo_interaction_events
          WHERE conversation_ref IS NOT NULL
          GROUP BY conversation_ref
          ORDER BY last_at DESC
          LIMIT $limit
        `,
      )
      .all({ $limit: limit }) as unknown as SummaryRow[];

    return rows.map((row) => ({
      conversationRef: row.conversation_ref,
      startedAt: row.started_at,
      lastAt: row.last_at,
      eventCount: row.event_count,
      messageTurns: row.message_turns,
      intakeEvents: row.intake_events,
      resetEvents: row.reset_events,
      maxTurn: row.max_turn,
      terminalSession: row.terminal_session === 1,
      hostContexts: splitGroup(row.host_contexts),
      finalActions: splitGroup(row.final_actions),
      overrideCount: row.override_count,
    }));
  }

  eventsForSession(conversationRef: string): DemoLoggedEvent[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM demo_interaction_events
          WHERE conversation_ref = $conversation_ref
          ORDER BY id ASC
        `,
      )
      .all({ $conversation_ref: conversationRef }) as unknown as EventRow[];

    return rows.map(eventFromRow);
  }

  turnEvent(
    conversationRef: string,
    turn: number,
  ): DemoLoggedEvent | undefined {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM demo_interaction_events
          WHERE conversation_ref = $conversation_ref
            AND turn = $turn
            AND event_type IN ('message', 'intake')
          ORDER BY id DESC
          LIMIT 1
        `,
      )
      .get({
        $conversation_ref: conversationRef,
        $turn: turn,
      }) as EventRow | undefined;

    return row ? eventFromRow(row) : undefined;
  }

  close(): void {
    this.db.close();
  }
}

export function openDemoInteractionLog(
  databasePath: string,
): DemoInteractionLog {
  return new DemoInteractionLog(databasePath);
}

export function recordDemoSessionStarted({
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
}): void {
  log?.record({
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

export function recordDemoTurn({
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
}): void {
  const telemetry = response.telemetry;

  log?.record({
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

export function recordDemoStructuredIntake({
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
}): void {
  const telemetry = response.telemetry;

  log?.record({
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

export function recordDemoStateEvent({
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
}): void {
  log?.record({
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

export function recordDemoError({
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
}): void {
  log?.record({
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

function eventFromRow(row: EventRow): DemoLoggedEvent {
  return {
    id: row.id,
    createdAt: row.created_at,
    eventType: row.event_type,
    method: row.method,
    path: row.path,
    httpStatus: row.http_status,
    durationMs: row.duration_ms,
    conversationRef: row.conversation_ref,
    turn: row.turn,
    requestRef: row.request_ref,
    traceId: row.trace_id,
    customerMessage: row.customer_message,
    assistantMessage: row.assistant_message,
    hostContext: row.host_context,
    proposedAction: row.proposed_action,
    finalAction: row.final_action,
    actionChanged: integerToBoolean(row.action_changed),
    servingMode: row.serving_mode,
    safetyFlags: parseJsonArray(row.safety_flags_json),
    overrideCodes: parseJsonArray(row.override_codes_json),
    retrievalCount: row.retrieval_count,
    retrievalTopScore: row.retrieval_top_score,
    retrievedItemIds: parseJsonArray(row.retrieved_item_ids_json),
    signalStatus: row.signal_status,
    signalPrimaryIntent: row.signal_primary_intent,
    signalRecommendedServingMode: row.signal_recommended_serving_mode,
    signalComparison: row.signal_comparison,
    uiPrimitive: row.ui_primitive,
    terminalSession: integerToBoolean(row.terminal_session),
    requestedFields: parseJsonArray(row.requested_fields_json),
    collectedFields: parseJsonArray(row.collected_fields_json),
    displayResponseJson: parseJsonValue(row.display_response_json),
    internalJson: parseJsonValue(row.internal_json),
    errorCode: row.error_code,
    errorMessage: row.error_message,
  };
}

function booleanToInteger(value: boolean | null | undefined): number | null {
  return typeof value === "boolean" ? (value ? 1 : 0) : null;
}

function integerToBoolean(value: number | null): boolean | null {
  return typeof value === "number" ? value === 1 : null;
}

function parseJsonArray(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function parseJsonValue(value: string | null): unknown {
  return value === null ? null : JSON.parse(value);
}

function splitGroup(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

interface SummaryRow {
  conversation_ref: string;
  started_at: string;
  last_at: string;
  event_count: number;
  message_turns: number;
  intake_events: number;
  reset_events: number;
  max_turn: number | null;
  terminal_session: number;
  host_contexts: string | null;
  final_actions: string | null;
  override_count: number;
}

interface EventRow {
  id: number;
  created_at: string;
  event_type: DemoInteractionEventType;
  method: string;
  path: string;
  http_status: number;
  duration_ms: number;
  conversation_ref: string | null;
  turn: number | null;
  request_ref: string | null;
  trace_id: string | null;
  customer_message: string | null;
  assistant_message: string | null;
  host_context: string | null;
  proposed_action: string | null;
  final_action: string | null;
  action_changed: number | null;
  serving_mode: string | null;
  safety_flags_json: string;
  override_codes_json: string;
  retrieval_count: number | null;
  retrieval_top_score: number | null;
  retrieved_item_ids_json: string;
  signal_status: string | null;
  signal_primary_intent: string | null;
  signal_recommended_serving_mode: string | null;
  signal_comparison: string | null;
  ui_primitive: string | null;
  terminal_session: number | null;
  requested_fields_json: string;
  collected_fields_json: string;
  display_response_json: string | null;
  internal_json: string | null;
  error_code: string | null;
  error_message: string | null;
}
