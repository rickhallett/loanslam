import type {
  ChatTurnResponse,
  CreateSessionRequest,
  HealthResponse,
  IntakeRequest,
  MessageRequest,
  ResetRequest,
  ServiceResponse,
  SessionCreatedResponse,
} from '@loanslam/contracts';

/**
 * Base API origin. In dev the widget (an iframe app on :5173) talks to the
 * backend on :8787; in production the origin is injected at build time.
 */
const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787';

const CSRF_HEADER = 'x-csrf-token';

/** Thrown for any non-2xx transport outcome or an unsuccessful envelope. */
export class ChatApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ChatApiError';
  }
}

/** Minimal subset of the global `fetch` we depend on (lets tests inject one). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Generates a fresh idempotency key per send. `crypto.randomUUID` is available
 * in every browser the widget targets and in the jsdom/node test runtime.
 */
const newClientMessageId = (): string => crypto.randomUUID();

/**
 * Typed transport for the chat backend. Owns the CSRF double-submit token in
 * memory only — it is captured from the session response header and echoed on
 * every later state-changing request. The session id itself lives in an
 * HttpOnly cookie this code never reads (brief §16).
 */
export class ChatClient {
  /** CSRF token held in memory only; never persisted to browser storage. */
  private csrfToken: string | null = null;

  constructor(
    private readonly baseUrl: string = API_BASE,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  /** Current CSRF token, exposed for tests/diagnostics. */
  getCsrfToken(): string | null {
    return this.csrfToken;
  }

  async health(): Promise<HealthResponse> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/health`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return this.unwrap<HealthResponse>(res);
  }

  async createSession(locale?: string): Promise<SessionCreatedResponse> {
    const body: CreateSessionRequest = locale ? { locale } : {};
    const res = await this.fetchImpl(`${this.baseUrl}/api/session`, {
      method: 'POST',
      credentials: 'include',
      headers: this.jsonHeaders(),
      body: JSON.stringify(body),
    });
    // The CSRF token is minted on session create and returned in the header.
    const token = res.headers.get(CSRF_HEADER);
    if (token) this.csrfToken = token;
    return this.unwrap<SessionCreatedResponse>(res);
  }

  async sendMessage(text: string): Promise<ChatTurnResponse> {
    const body: MessageRequest = {
      clientMessageId: newClientMessageId(),
      text,
    };
    const res = await this.fetchImpl(`${this.baseUrl}/api/message`, {
      method: 'POST',
      credentials: 'include',
      headers: this.jsonHeaders(true),
      body: JSON.stringify(body),
    });
    return this.unwrap<ChatTurnResponse>(res);
  }

  async submitIntake(formId: string, values: Record<string, string>): Promise<ChatTurnResponse> {
    const body: IntakeRequest = { formId, values };
    const res = await this.fetchImpl(`${this.baseUrl}/api/intake`, {
      method: 'POST',
      credentials: 'include',
      headers: this.jsonHeaders(true),
      body: JSON.stringify(body),
    });
    return this.unwrap<ChatTurnResponse>(res);
  }

  async reset(): Promise<ChatTurnResponse> {
    const body: ResetRequest = {};
    const res = await this.fetchImpl(`${this.baseUrl}/api/reset`, {
      method: 'POST',
      credentials: 'include',
      headers: this.jsonHeaders(true),
      body: JSON.stringify(body),
    });
    return this.unwrap<ChatTurnResponse>(res);
  }

  private jsonHeaders(withCsrf = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (withCsrf && this.csrfToken) headers[CSRF_HEADER] = this.csrfToken;
    return headers;
  }

  /** Parse the ServiceResponse envelope and surface failures cleanly. */
  private async unwrap<T>(res: Response): Promise<T> {
    let envelope: ServiceResponse<T> | null = null;
    try {
      envelope = (await res.json()) as ServiceResponse<T>;
    } catch {
      throw new ChatApiError(
        res.ok ? 'Malformed response from server.' : `Request failed (${res.status}).`,
        res.status,
      );
    }

    if (!envelope || envelope.success !== true || envelope.responseObject === null) {
      const message = envelope?.message ?? 'Request failed.';
      const code = envelope?.statusCode ?? res.status;
      throw new ChatApiError(message, code);
    }
    return envelope.responseObject;
  }
}

/** Factory with production defaults; tests pass a fake fetch / base URL. */
export function createChatClient(baseUrl?: string, fetchImpl?: FetchLike): ChatClient {
  return new ChatClient(baseUrl ?? API_BASE, fetchImpl);
}
