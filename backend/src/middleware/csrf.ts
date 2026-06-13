import type { NextFunction, Request, Response } from 'express';
import { ServiceResponseFactory } from '../common/serviceResponse.js';
import { CSRF_COOKIE } from './cookies.js';

const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit CSRF guard for state-changing routes. The widget echoes the
 * token (set on `POST /api/session` in the readable `ls_csrf` cookie and the
 * `x-csrf-token` response header) back in the `x-csrf-token` request header on
 * every mutating call. We reject when the header is missing or does not match
 * the cookie.
 *
 * NOTE: `POST /api/session` is deliberately exempt — it bootstraps the token and
 * is protected instead by the CORS origin allowlist (architecture.md).
 */
export function csrf(req: Request, res: Response, next: NextFunction): void {
  const headerToken = req.get(CSRF_HEADER);
  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  const cookieToken = cookies[CSRF_COOKIE];

  if (
    typeof headerToken !== 'string' ||
    typeof cookieToken !== 'string' ||
    headerToken.length === 0 ||
    headerToken !== cookieToken
  ) {
    const fail = ServiceResponseFactory.fail('CSRF token missing or invalid.', 403);
    res.status(fail.statusCode).json(fail);
    return;
  }

  next();
}
