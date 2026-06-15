export interface LabConversationMessage {
  id?: string;
  role?: string;
  content?: string;
  createdAt?: string;
}

export interface LabTrace {
  finalAction?: string;
  selectedServingMode?: string | null;
  effectiveServingMode?: string | null;
  safetyFlags?: unknown[];
  validatorOverrides?: unknown[];
  customerMessage?: string;
}

export interface LabSessionState {
  history: LabConversationMessage[];
  collectedFacts?: Record<string, unknown>;
  requestedFields?: unknown[];
  safetyFlags?: unknown[];
  lastAction?: string;
  handoffPending?: boolean;
}

export interface LabSessionDump {
  conversationRef: string;
  state: LabSessionState;
  traces: LabTrace[];
}

export interface ValidatedTurnResultLike {
  finalAction?: string;
  customerMessage?: string;
  validatorOverrides?: unknown[];
  trace?: LabTrace;
  state?: LabSessionState;
}

export interface EvidenceSummary {
  conversationRef: string;
  messageCount: number;
  traceCount: number;
  collectedFactCount: number;
  requestedFields: string[];
  handoffPending: boolean;
  lastAction: string | null;
  selectedServingMode: string | null;
  safetyFlags: string[];
  validatorOverrideCodes: string[];
  finalCustomerMessage: string | null;
}

export function assertValidSessionDump(value: unknown): LabSessionDump {
  if (!isRecord(value)) {
    throw new Error("Session dump must be a JSON object.");
  }

  if (typeof value.conversationRef !== "string" || !value.conversationRef) {
    throw new Error("Session dump is missing conversationRef.");
  }

  if (!isRecord(value.state)) {
    throw new Error("Session dump is missing state.");
  }

  if (!Array.isArray(value.state.history)) {
    throw new Error("Session dump is missing state.history.");
  }

  if (!Array.isArray(value.traces)) {
    throw new Error("Session dump is missing traces.");
  }

  return value as unknown as LabSessionDump;
}

export function summarizeEvidence({
  session,
  result,
}: {
  session: LabSessionDump;
  result?: ValidatedTurnResultLike;
}): EvidenceSummary {
  const latestTrace = result?.trace ?? session.traces.at(-1);
  const state = result?.state ?? session.state;
  const collectedFacts = isRecord(state.collectedFacts)
    ? state.collectedFacts
    : {};
  const requestedFields = toStringArray(state.requestedFields);
  const safetyFlags = toStringArray(
    latestTrace?.safetyFlags ?? state.safetyFlags,
  );
  const validatorOverrides = Array.isArray(result?.validatorOverrides)
    ? result?.validatorOverrides
    : latestTrace?.validatorOverrides;

  return {
    conversationRef: session.conversationRef,
    messageCount: session.state.history.length,
    traceCount: session.traces.length,
    collectedFactCount: Object.keys(collectedFacts).length,
    requestedFields,
    handoffPending: state.handoffPending ?? false,
    lastAction:
      result?.finalAction ??
      latestTrace?.finalAction ??
      state.lastAction ??
      null,
    selectedServingMode:
      latestTrace?.effectiveServingMode ??
      latestTrace?.selectedServingMode ??
      null,
    safetyFlags,
    validatorOverrideCodes: extractOverrideCodes(validatorOverrides),
    finalCustomerMessage:
      result?.customerMessage ??
      latestTrace?.customerMessage ??
      lastAssistantMessage(session.state.history),
  };
}

function lastAssistantMessage(
  history: LabConversationMessage[],
): string | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];

    if (message?.role === "assistant" && typeof message.content === "string") {
      return message.content;
    }
  }

  return null;
}

function extractOverrideCodes(overrides: unknown): string[] {
  if (!Array.isArray(overrides)) {
    return [];
  }

  return overrides.flatMap((override) => {
    if (!isRecord(override)) {
      return [];
    }

    return typeof override.code === "string" ? [override.code] : [];
  });
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
