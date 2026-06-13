import type { CookieOptions, NextFunction, Request, Response } from 'express';

import type { AppEnv } from '../config/env.js';
import type { ChatRepository } from '../features/chat/chat.models.js';
import { verifyCsrfToken } from '../features/chat/chat.service.js';
import { HttpError } from './errors.js';

export interface CsrfConfig {
  cookieName: string;
  nodeEnv: AppEnv['NODE_ENV'];
}

export function csrfProtection(repository: ChatRepository) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      if (!request.sessionId) {
        throw new HttpError(401, 'session_invalid', 'Session is invalid');
      }

      const csrfToken = getSubmittedCsrfToken(request);
      if (!csrfToken) {
        throw new HttpError(403, 'csrf_invalid', 'CSRF token is invalid');
      }

      const session = await repository.getSessionById(request.sessionId);
      if (!session || !verifyCsrfToken(csrfToken, session.csrfTokenHash)) {
        throw new HttpError(403, 'csrf_invalid', 'CSRF token is invalid');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function setCsrfCookie(response: Response, csrfToken: string, config: CsrfConfig): void {
  response.cookie(config.cookieName, csrfToken, {
    ...baseCookieOptions(config),
    httpOnly: false,
  });
}

export function getSubmittedCsrfToken(request: Request): string | undefined {
  const header = request.get('x-csrf-token');
  return header && header.length > 0 ? header : undefined;
}

function baseCookieOptions(config: CsrfConfig): CookieOptions {
  if (config.nodeEnv === 'production') {
    return {
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
    };
  }

  return {
    secure: false,
    sameSite: 'lax',
    path: '/',
  };
}
