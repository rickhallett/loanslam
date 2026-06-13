import { createHmac, timingSafeEqual } from 'node:crypto';

import type { CookieOptions, NextFunction, Request, Response } from 'express';

import type { AppEnv } from '../config/env.js';

export interface SessionCookieConfig {
  cookieName: string;
  secret: string;
  nodeEnv: AppEnv['NODE_ENV'];
}

export function sessionMiddleware(config: SessionCookieConfig) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const value = getCookie(request, config.cookieName);
    const sessionId = value ? verifySessionCookieValue(value, config.secret) : null;

    if (sessionId) {
      request.sessionId = sessionId;
    }

    next();
  };
}

export function setSessionCookie(
  response: Response,
  sessionId: string,
  config: SessionCookieConfig,
): void {
  response.cookie(config.cookieName, createSessionCookieValue(sessionId, config.secret), {
    ...baseCookieOptions(config),
    httpOnly: true,
  });
}

export function clearSessionCookie(response: Response, config: SessionCookieConfig): void {
  response.clearCookie(config.cookieName, baseCookieOptions(config));
}

function createSessionCookieValue(sessionId: string, secret: string): string {
  const payload = Buffer.from(sessionId, 'utf8').toString('base64url');
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

function verifySessionCookieValue(value: string, secret: string): string | null {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) {
    return null;
  }

  if (!safeEqual(signature, sign(payload, secret))) {
    return null;
  }

  try {
    return Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function baseCookieOptions(config: SessionCookieConfig): CookieOptions {
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

function getCookie(request: Request, name: string): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' ? value : undefined;
}
