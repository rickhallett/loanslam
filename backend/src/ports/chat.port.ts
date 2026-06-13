import type {
  ChatTurnResponse,
  CreateSessionRequest,
  IntakeRequest,
  MessageRequest,
  ServiceResponse,
  SessionCreatedResponse,
} from '@loanslam/contracts';

/**
 * Per-request context the thin HTTP edge passes into the service. Keeps cookies
 * and headers out of the domain — the controller owns transport.
 */
export interface RequestContext {
  requestRef: string;
}

/**
 * What a service method returns to the controller: the uniform envelope plus
 * any transport side-effects the controller must apply (set/clear the session
 * cookie, surface the CSRF token). Business outcome lives in the envelope's
 * responseObject; transport stays in the controller.
 */
export interface TurnOutcome<T> {
  response: ServiceResponse<T>;
  /** Controller sets the HttpOnly session cookie to this value when present. */
  setSessionId?: string;
  /** Controller exposes this CSRF token (e.g. response header) when present. */
  csrfToken?: string;
  /** Controller clears the session cookie when true. */
  clearSession?: boolean;
}

/**
 * The orchestration service contract. The route/controller depends on this
 * interface; ChatService implements it. The fail-closed pipeline lives inside
 * `handleMessage`: vulnerability gate -> classifier -> router -> response.
 */
export interface IChatService {
  createSession(
    input: CreateSessionRequest,
    ctx: RequestContext,
  ): Promise<TurnOutcome<SessionCreatedResponse>>;

  handleMessage(
    sessionId: string | undefined,
    input: MessageRequest,
    ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>>;

  submitIntake(
    sessionId: string | undefined,
    input: IntakeRequest,
    ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>>;

  reset(
    sessionId: string | undefined,
    ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>>;
}
