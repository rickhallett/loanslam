import type {
  ConversationState,
  IntakeField,
  UiPlan,
  ValidatedTurnResult,
} from "@loanslam/contracts";

/**
 * Thin HTTP client for the LoanSlam engine's lab server.
 *
 * The engine owns OpenAI, retrieval, grounding, policy, and config; this client
 * only speaks its JSON contract over the proxied /sessions routes:
 *
 *   POST /sessions                      -> { conversationRef, state }
 *   POST /sessions/:ref/messages        -> ValidatedTurnResult
 *   POST /sessions/:ref/reset           -> { conversationRef, state, traces }
 *   POST /sessions/:ref/intake          -> IntakeResult
 *   POST /sessions/:ref/cancel-handoff  -> { conversationRef, state }
 */

interface SessionResponse {
  conversationRef: string;
  state: ConversationState;
}

export interface IntakeResult {
  conversationRef: string;
  state: ConversationState;
  finalAction: string;
  ui: UiPlan;
  customerMessage: string;
  reference: string;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      isErrorPayload(payload) && payload.message
        ? payload.message
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return payload as T;
}

function isErrorPayload(value: unknown): value is { message?: string } {
  return typeof value === "object" && value !== null && "message" in value;
}

export async function createSession(): Promise<string> {
  const session = await requestJson<SessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return session.conversationRef;
}

export async function sendMessage(
  conversationRef: string,
  message: string,
): Promise<ValidatedTurnResult> {
  return requestJson<ValidatedTurnResult>(
    `/sessions/${encodeURIComponent(conversationRef)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
  );
}

export async function resetSession(conversationRef: string): Promise<void> {
  await requestJson(`/sessions/${encodeURIComponent(conversationRef)}/reset`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function submitIntake(
  conversationRef: string,
  fields: Record<IntakeField, string>,
): Promise<IntakeResult> {
  return requestJson<IntakeResult>(
    `/sessions/${encodeURIComponent(conversationRef)}/intake`,
    {
      method: "POST",
      body: JSON.stringify(fields),
    },
  );
}

export async function cancelHandoff(conversationRef: string): Promise<void> {
  await requestJson(
    `/sessions/${encodeURIComponent(conversationRef)}/cancel-handoff`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}
