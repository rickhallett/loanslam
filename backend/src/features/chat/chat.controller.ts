import type { Request, Response, NextFunction } from 'express';

import type { ChatResponse, CreateSessionResponse, ServiceResponse } from '@loanslam/contracts';

import { env, type AppEnv } from '../../config/env.js';
import { getSubmittedCsrfToken, setCsrfCookie } from '../../middleware/csrf.js';
import { setSessionCookie } from '../../middleware/session.js';
import type { ChatService } from './chat.service.js';

export interface ChatControllerOptions {
  chatService: ChatService;
  appEnv?: AppEnv;
}

export class ChatController {
  private readonly appEnv: AppEnv;

  constructor(private readonly options: ChatControllerOptions) {
    this.appEnv = options.appEnv ?? env;
  }

  createSession = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await this.options.chatService.createSession();
      this.setCookies(response, result.sessionId, result.response.csrfToken);
      sendServiceResponse(response, 201, 'Session created', result.response);
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const sessionId = requireSessionId(request);
      const csrfToken = getSubmittedCsrfToken(request) ?? '';
      const result = await this.options.chatService.sendMessage(sessionId, request.body, csrfToken);
      setCsrfCookie(response, result.csrfToken, this.csrfConfig);
      sendServiceResponse(response, 200, 'Message processed', result);
    } catch (error) {
      next(error);
    }
  };

  submitIntake = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const sessionId = requireSessionId(request);
      const csrfToken = getSubmittedCsrfToken(request) ?? '';
      const result = await this.options.chatService.submitIntake(
        sessionId,
        request.body,
        csrfToken,
      );
      setCsrfCookie(response, result.csrfToken, this.csrfConfig);
      sendServiceResponse(response, 200, 'Intake submitted', result);
    } catch (error) {
      next(error);
    }
  };

  reset = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const sessionId = requireSessionId(request);
      const result = await this.options.chatService.reset(sessionId, request.body);
      this.setCookies(response, result.sessionId, result.response.csrfToken);
      sendServiceResponse(response, 200, 'Chat reset', result.response);
    } catch (error) {
      next(error);
    }
  };

  private setCookies(response: Response, sessionId: string, csrfToken: string): void {
    setSessionCookie(response, sessionId, this.sessionConfig);
    setCsrfCookie(response, csrfToken, this.csrfConfig);
  }

  private get sessionConfig() {
    return {
      cookieName: this.appEnv.SESSION_COOKIE_NAME,
      secret: this.appEnv.SESSION_SECRET,
      nodeEnv: this.appEnv.NODE_ENV,
    };
  }

  private get csrfConfig() {
    return {
      cookieName: this.appEnv.CSRF_COOKIE_NAME,
      nodeEnv: this.appEnv.NODE_ENV,
    };
  }
}

function requireSessionId(request: Request): string {
  if (!request.sessionId) {
    throw new Error('Session middleware did not populate request.sessionId');
  }

  return request.sessionId;
}

function sendServiceResponse<T extends ChatResponse | CreateSessionResponse>(
  response: Response,
  statusCode: number,
  message: string,
  responseObject: T,
): void {
  response.status(statusCode).json({
    success: true,
    message,
    statusCode,
    responseObject,
  } satisfies ServiceResponse<T>);
}
