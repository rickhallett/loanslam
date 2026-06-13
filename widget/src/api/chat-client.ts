import {
  chatResponseSchema,
  createSessionResponseSchema,
  serviceResponseSchema,
  type ChatResponse,
  type ServiceResponse,
} from '@loanslam/contracts';

export interface WidgetChatClient {
  createSession(): Promise<ChatResponse>;
  sendMessage(text: string): Promise<ChatResponse>;
  submitIntake(intake: Record<string, string>): Promise<ChatResponse>;
  reset(): Promise<ChatResponse>;
}

export interface ChatClientOptions {
  baseUrl?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  idFactory?: (() => string) | undefined;
}

export interface SessionSnapshot {
  conversationRef: string | null;
  csrfToken: string | null;
}

export function createChatClient(options: ChatClientOptions = {}): WidgetChatClient & {
  getSessionSnapshot(): SessionSnapshot;
} {
  const baseUrl = options.baseUrl ?? getConfiguredBaseUrl();
  const fetchImpl = options.fetchImpl ?? fetch;
  const createId = options.idFactory ?? createClientRequestId;
  let csrfToken: string | null = null;
  let conversationRef: string | null = null;

  async function requestChat(
    path: string,
    init: RequestInit,
    requiresCsrf: boolean,
  ): Promise<ChatResponse> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (requiresCsrf) {
      if (!csrfToken) {
        throw new Error('Cannot call chat endpoint before session creation');
      }

      headers['x-csrf-token'] = csrfToken;
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });
    const body: unknown = await response.json();
    const schema = serviceResponseSchema(
      path === '/chat/session' ? createSessionResponseSchema : chatResponseSchema,
    );
    const parsed = schema.parse(body) as ServiceResponse<ChatResponse>;

    if (!response.ok || !parsed.success) {
      throw new Error(parsed.message || 'Chat request failed');
    }

    csrfToken = parsed.responseObject.csrfToken;
    conversationRef = parsed.responseObject.conversationRef;

    return parsed.responseObject;
  }

  return {
    createSession() {
      return requestChat(
        '/chat/session',
        {
          method: 'POST',
        },
        false,
      );
    },

    sendMessage(text: string) {
      return requestChat(
        '/chat/message',
        {
          method: 'POST',
          body: JSON.stringify({
            clientMessageId: createId(),
            text,
          }),
        },
        true,
      );
    },

    submitIntake(intake: Record<string, string>) {
      return requestChat(
        '/chat/intake',
        {
          method: 'POST',
          body: JSON.stringify({
            clientRequestId: createId(),
            intake,
          }),
        },
        true,
      );
    },

    reset() {
      return requestChat(
        '/chat/reset',
        {
          method: 'POST',
          body: JSON.stringify({
            clientRequestId: createId(),
            reason: 'user_requested',
          }),
        },
        true,
      );
    },

    getSessionSnapshot() {
      return { conversationRef, csrfToken };
    },
  };
}

function getConfiguredBaseUrl(): string {
  const value: unknown = import.meta.env.VITE_API_BASE_URL;
  return typeof value === 'string' ? value : '';
}

function createClientRequestId(): string {
  const random = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  return `client_${random.replaceAll('-', '')}`;
}
