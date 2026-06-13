import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../config/logger.js';
import { newRequestRef } from '../common/ids.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      /** Per-request correlation reference, set by requestContext middleware. */
      requestRef: string;
      /** Child logger bound to this request's ref. */
      logger: Logger;
    }
  }
}

/**
 * Assigns a per-request reference to `res.locals.requestRef` and attaches a
 * child logger bound to it. Everything downstream (controller, service ctx,
 * audit) correlates on this ref. Mounted before the routers.
 */
export function requestContext(baseLogger: Logger) {
  return function requestContextMiddleware(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const requestRef = newRequestRef();
    res.locals.requestRef = requestRef;
    res.locals.logger = baseLogger.child({ requestRef });
    res.setHeader('x-request-ref', requestRef);
    next();
  };
}
