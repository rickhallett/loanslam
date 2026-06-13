import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../config/logger.js';
import { ServiceResponseFactory } from '../common/serviceResponse.js';

/**
 * Terminal Express error handler. Logs the real detail server-side and returns a
 * safe, opaque `ServiceResponse` fail envelope (statusCode 500). Never leaks
 * internals, messages, or stack traces to the client (brief: safe failures).
 *
 * Mounted LAST in the middleware chain.
 */
export function errorHandler(baseLogger: Logger) {
  return function errorHandlerMiddleware(
    err: unknown,
    _req: Request,
    res: Response,
    // Express identifies error handlers by arity; `next` must be present.
    next: NextFunction,
  ): void {
    const log = res.locals.logger ?? baseLogger;
    log.error({ err }, 'unhandled error in request pipeline');

    // If the response has already started streaming, defer to Express.
    if (res.headersSent) {
      next(err);
      return;
    }

    const fail = ServiceResponseFactory.fail('Internal server error.', 500);
    res.status(fail.statusCode).json(fail);
  };
}
