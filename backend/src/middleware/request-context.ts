import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export interface RequestContext {
  correlationRef: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    requestContext: RequestContext;
    sessionId?: string;
  }
}

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const header = request.get('x-correlation-ref') ?? request.get('x-request-id');
  const correlationRef = header && header.length > 0 ? header : createCorrelationRef();
  request.requestContext = { correlationRef };
  response.setHeader('x-correlation-ref', correlationRef);
  next();
}

function createCorrelationRef(): string {
  return `corr_${randomUUID().replaceAll('-', '')}`;
}
