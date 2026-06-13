import type { Request, Response } from 'express';
import type { z } from 'zod';
import {
  createSessionRequestSchema,
  intakeRequestSchema,
  messageRequestSchema,
  resetRequestSchema,
  type ChatTurnResponse,
  type HealthResponse,
  type SessionCreatedResponse,
} from '@loanslam/contracts';
import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type { IChatService, RequestContext } from '../../ports/chat.port.js';
import type { TurnOutcome } from '../../composition/types.js';
import { ServiceResponseFactory } from '../../common/serviceResponse.js';
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  csrfCookieOptions,
  sessionCookieOptions,
} from '../../middleware/cookies.js';

const CSRF_HEADER = 'x-csrf-token';

export interface ChatControllerDeps {
  chatService: IChatService;
  config: AppConfig;
  logger: Logger;
}

/**
 * Thin HTTP edge for the chat pipeline. Owns transport ONLY: body validation,
 * cookie/CSRF/header side-effects, status codes, and response sending. It makes
 * no business decisions — every routing/reply choice is the service's. The
 * controller's job is to translate `TurnOutcome` side-effects into cookies and
 * headers and to pass the envelope through unchanged.
 */
export class ChatController {
  private readonly chatService: IChatService;
  private readonly config: AppConfig;
  private readonly logger: Logger;

  constructor(deps: ChatControllerDeps) {
    this.chatService = deps.chatService;
    this.config = deps.config;
    this.logger = deps.logger;
  }

  /** Build the per-request context the service consumes. */
  private context(res: Response): RequestContext {
    return { requestRef: res.locals.requestRef };
  }

  /** Read the (HttpOnly) session id the browser sent, if any. */
  private sessionId(req: Request): string | undefined {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    return cookies[SESSION_COOKIE];
  }

  /**
   * Validate `req.body` against `schema`. On failure, send a 400 fail envelope
   * listing the issues and return undefined so the caller stops.
   */
  private validate<T>(
    req: Request,
    res: Response,
    schema: z.ZodType<T>,
  ): T | undefined {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(
        (i) => `${i.path.join('.') || '(body)'}: ${i.message}`,
      );
      const fail = ServiceResponseFactory.fail(
        `Invalid request: ${issues.join('; ')}`,
        400,
      );
      res.status(fail.statusCode).json(fail);
      return undefined;
    }
    return result.data;
  }

  /**
   * Apply a TurnOutcome's transport side-effects (cookies + CSRF header), then
   * send the envelope with its declared status code. All cookie policy is
   * environment-aware via the cookie option helpers.
   */
  private send<T>(res: Response, outcome: TurnOutcome<T>): void {
    if (outcome.clearSession) {
      res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.config));
      res.clearCookie(CSRF_COOKIE, csrfCookieOptions(this.config));
    }

    if (outcome.setSessionId) {
      res.cookie(
        SESSION_COOKIE,
        outcome.setSessionId,
        sessionCookieOptions(this.config),
      );
    }

    if (outcome.csrfToken) {
      res.cookie(CSRF_COOKIE, outcome.csrfToken, csrfCookieOptions(this.config));
      res.setHeader(CSRF_HEADER, outcome.csrfToken);
    }

    res.status(outcome.response.statusCode).json(outcome.response);
  }

  createSession = async (req: Request, res: Response): Promise<void> => {
    const input = this.validate(req, res, createSessionRequestSchema);
    if (input === undefined) return;
    const outcome: TurnOutcome<SessionCreatedResponse> =
      await this.chatService.createSession(input, this.context(res));
    this.send(res, outcome);
  };

  message = async (req: Request, res: Response): Promise<void> => {
    const input = this.validate(req, res, messageRequestSchema);
    if (input === undefined) return;
    const outcome: TurnOutcome<ChatTurnResponse> =
      await this.chatService.handleMessage(
        this.sessionId(req),
        input,
        this.context(res),
      );
    this.send(res, outcome);
  };

  intake = async (req: Request, res: Response): Promise<void> => {
    const input = this.validate(req, res, intakeRequestSchema);
    if (input === undefined) return;
    const outcome: TurnOutcome<ChatTurnResponse> =
      await this.chatService.submitIntake(
        this.sessionId(req),
        input,
        this.context(res),
      );
    this.send(res, outcome);
  };

  reset = async (req: Request, res: Response): Promise<void> => {
    const input = this.validate(req, res, resetRequestSchema);
    if (input === undefined) return;
    const outcome: TurnOutcome<ChatTurnResponse> = await this.chatService.reset(
      this.sessionId(req),
      this.context(res),
    );
    this.send(res, outcome);
  };

  health = (_req: Request, res: Response): void => {
    const body: HealthResponse = {
      status: 'ok',
      uptimeSeconds: process.uptime(),
      aiEnabled: this.config.ai.enabled,
      persistence: this.config.persistence,
    };
    const envelope = ServiceResponseFactory.ok(body, 'OK', 200);
    res.status(envelope.statusCode).json(envelope);
  };
}

/** Factory mirroring the manual-composition convention. */
export function createChatController(deps: ChatControllerDeps): ChatController {
  return new ChatController(deps);
}
