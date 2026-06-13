import type { CookieOptions } from 'express';
import type { AppConfig } from '../config/env.js';

/** Cookie names. The session id is HttpOnly; the CSRF token is readable. */
export const SESSION_COOKIE = 'ls_sid';
export const CSRF_COOKIE = 'ls_csrf';

/**
 * Environment-aware cookie policy. The widget is embedded as a third-party
 * iframe, so in production the session cookie must be SameSite=None; Secure;
 * Partitioned (CHIPS) to survive Safari/Firefox third-party blocking
 * (architecture.md "iframe session / cookie strategy"). In development over
 * plain http we relax to SameSite=lax / not-secure so localhost works.
 *
 * `partitioned` is a valid Express 5 / cookie option; typed loosely here because
 * @types/express may lag the runtime support.
 */
type CookiePolicy = Pick<CookieOptions, 'sameSite' | 'secure' | 'path'> & {
  partitioned?: boolean;
};

function cookiePolicy(config: AppConfig): CookiePolicy {
  const isProd = config.nodeEnv === 'production';
  return isProd
    ? { sameSite: 'none', secure: true, partitioned: true, path: '/' }
    : { sameSite: 'lax', secure: false, path: '/' };
}

/** Options for the HttpOnly session cookie (`ls_sid`). Never readable by JS. */
export function sessionCookieOptions(config: AppConfig): CookieOptions {
  return { httpOnly: true, ...cookiePolicy(config) } as CookieOptions;
}

/**
 * Options for the readable double-submit CSRF cookie (`ls_csrf`). NOT HttpOnly —
 * the widget must read it to echo the token in the `x-csrf-token` header.
 */
export function csrfCookieOptions(config: AppConfig): CookieOptions {
  return { httpOnly: false, ...cookiePolicy(config) } as CookieOptions;
}
