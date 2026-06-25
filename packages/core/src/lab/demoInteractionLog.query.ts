import type { DemoLoggedEvent, DemoSessionSummary } from "./demoInteractionLog";

// Owner-facing diagnostic formatters for the demo interaction log. These run
// only from the CLI demo-log audit path, never on the serving turn, so they
// live apart from the write path in demoInteractionLog.ts.

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

// One row rule per output line, in print order. `include` decides whether the
// line appears for a given event; `render` produces it. Reading the table top
// to bottom is reading the event's printed shape — no control flow to trace.
type EventLineRule = {
  include: (event: DemoLoggedEvent) => boolean;
  render: (event: DemoLoggedEvent) => string;
};

const eventLineRules: readonly EventLineRule[] = [
  {
    include: () => true,
    render: (event) =>
      `#${event.id} ${event.createdAt} ${event.eventType} ${event.httpStatus} ${event.durationMs}ms`,
  },
  {
    include: () => true,
    render: (event) =>
      `conversation: ${event.conversationRef ?? "-"} turn: ${event.turn ?? "-"}`,
  },
  {
    include: (event) => Boolean(event.customerMessage),
    render: (event) => `customer: ${event.customerMessage}`,
  },
  {
    include: (event) => Boolean(event.assistantMessage),
    render: (event) => `assistant: ${event.assistantMessage}`,
  },
  {
    include: (event) =>
      Boolean(event.finalAction || event.hostContext || event.uiPrimitive),
    render: (event) =>
      `decision: proposed=${event.proposedAction ?? "-"} final=${event.finalAction ?? "-"} changed=${event.actionChanged ?? "-"} context=${event.hostContext ?? "-"} ui=${event.uiPrimitive ?? "-"}`,
  },
  {
    include: (event) =>
      Boolean(event.servingMode) ||
      event.safetyFlags.length > 0 ||
      event.overrideCodes.length > 0,
    render: (event) =>
      `why: serving=${event.servingMode ?? "-"} flags=${event.safetyFlags.join(",") || "-"} overrides=${event.overrideCodes.join(",") || "-"}`,
  },
  {
    include: (event) => event.retrievalCount !== null || Boolean(event.signalStatus),
    render: (event) =>
      `evidence: retrieval=${event.retrievalCount ?? 0} top=${event.retrievalTopScore ?? 0} ids=${event.retrievedItemIds.join(",") || "-"} signal=${event.signalPrimaryIntent ?? "-"} -> ${event.signalRecommendedServingMode ?? "-"} (${event.signalComparison ?? event.signalStatus ?? "-"})`,
  },
  {
    include: (event) =>
      event.requestedFields.length > 0 ||
      event.collectedFields.length > 0 ||
      event.terminalSession !== null,
    render: (event) =>
      `state: requested=${event.requestedFields.join(",") || "-"} collected=${event.collectedFields.join(",") || "-"} terminal=${event.terminalSession ?? "-"}`,
  },
  {
    include: (event) => Boolean(event.errorCode || event.errorMessage),
    render: (event) => `error: ${event.errorCode ?? "-"} ${event.errorMessage ?? ""}`,
  },
];

export function formatDemoLoggedEvent({
  event,
  includeFullInternal,
}: {
  event: DemoLoggedEvent;
  includeFullInternal: boolean;
}): string {
  const lines = eventLineRules
    .filter((rule) => rule.include(event))
    .map((rule) => rule.render(event));

  if (includeFullInternal && event.internalJson !== null) {
    lines.push("full internal:");
    lines.push(JSON.stringify(event.internalJson, null, 2));
  }

  return lines.join("\n");
}
