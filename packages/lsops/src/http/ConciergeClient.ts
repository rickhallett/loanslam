import { JsonClient, type JsonResponse } from "./JsonClient";

export interface ConciergeSession {
  conversationRef: string;
}

export interface ConciergeTurnRequest {
  message: string;
  pageContext?: Record<string, unknown>;
  formState?: Record<string, unknown> | null;
}

export interface ConciergeAssistantReply {
  message?: string;
  navigateTo?: unknown;
  formFill?: unknown;
}

export interface ConciergeTurnResponse {
  assistant?: ConciergeAssistantReply;
}

export class ConciergeClient {
  private readonly client: JsonClient;

  constructor(baseUrl: string, options: { fetchImpl?: typeof fetch } = {}) {
    this.client = new JsonClient(
      options.fetchImpl
        ? { baseUrl, fetchImpl: options.fetchImpl }
        : { baseUrl },
    );
  }

  async createSession(): Promise<JsonResponse<ConciergeSession>> {
    return this.client.request<ConciergeSession>("/api/concierge/sessions", {
      method: "POST",
    });
  }

  async sendMessage(
    conversationRef: string,
    body: ConciergeTurnRequest,
  ): Promise<JsonResponse<ConciergeTurnResponse>> {
    return this.client.request<ConciergeTurnResponse>(
      `/api/concierge/sessions/${encodeURIComponent(conversationRef)}/messages`,
      {
        method: "POST",
        body,
      },
    );
  }

  async sessionLookupStatus(
    conversationRef: string,
  ): Promise<"exists" | "missing" | "unknown"> {
    const response = await this.client.request(
      `/api/concierge/sessions/${encodeURIComponent(conversationRef)}/messages`,
      {
        method: "POST",
        body: {},
      },
    );
    if (response.status === 400) return "exists";
    if (response.status === 404) return "missing";
    return "unknown";
  }
}
