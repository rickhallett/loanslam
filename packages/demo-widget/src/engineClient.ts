import type {
  DemoSessionResponse,
  DemoTurnResponse,
  IntakeField,
} from "@loanslam/contracts";

/**
 * Thin HTTP client for the LoanSlam stakeholder demo API.
 *
 * The engine owns OpenAI, retrieval, grounding, policy, and config. The browser
 * only receives the server-side display model over the proxied /demo routes:
 *
 *   POST /demo/sessions                      -> DemoSessionResponse
 *   POST /demo/sessions/:ref/messages        -> DemoTurnResponse
 *   POST /demo/sessions/:ref/reset           -> DemoSessionResponse
 *   POST /demo/sessions/:ref/intake          -> DemoTurnResponse
 *   POST /demo/sessions/:ref/cancel-handoff  -> DemoSessionResponse
 */

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = import.meta.env.VITE_DEMO_ACCESS_TOKEN;
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { "x-demo-access-token": accessToken } : {}),
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

export async function createSession(): Promise<DemoSessionResponse> {
  return requestJson<DemoSessionResponse>("/demo/sessions", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function sendMessage(
  conversationRef: string,
  message: string,
  continuationToken?: string,
): Promise<DemoTurnResponse> {
  return requestJson<DemoTurnResponse>(
    `/demo/sessions/${encodeURIComponent(conversationRef)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ message, continuationToken }),
    },
  );
}

export async function resetSession(
  conversationRef: string,
  continuationToken?: string,
): Promise<DemoSessionResponse> {
  return requestJson<DemoSessionResponse>(
    `/demo/sessions/${encodeURIComponent(conversationRef)}/reset`,
    {
      method: "POST",
      body: JSON.stringify({ continuationToken }),
    },
  );
}

export async function submitIntake(
  conversationRef: string,
  fields: Record<IntakeField, string>,
  continuationToken?: string,
): Promise<DemoTurnResponse> {
  return requestJson<DemoTurnResponse>(
    `/demo/sessions/${encodeURIComponent(conversationRef)}/intake`,
    {
      method: "POST",
      body: JSON.stringify({ ...fields, continuationToken }),
    },
  );
}

export async function cancelHandoff(
  conversationRef: string,
  continuationToken?: string,
): Promise<DemoSessionResponse> {
  return requestJson<DemoSessionResponse>(
    `/demo/sessions/${encodeURIComponent(conversationRef)}/cancel-handoff`,
    {
      method: "POST",
      body: JSON.stringify({ continuationToken }),
    },
  );
}
