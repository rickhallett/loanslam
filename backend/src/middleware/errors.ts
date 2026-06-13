import type { NextFunction, Request, Response } from 'express';

import type { ServiceResponse } from '@loanslam/contracts';

import { logger } from '../config/logger.js';
import { ChatServiceError } from '../features/chat/chat.service.js';

export interface ErrorResponseObject {
  errorCode: string;
}

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function errorMiddleware(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  void next;

  const normalized = normalizeError(error);

  if (normalized.statusCode >= 500) {
    logger.error({ error }, 'Unhandled HTTP error');
  }

  response.status(normalized.statusCode).json({
    success: false,
    message: normalized.publicMessage,
    statusCode: normalized.statusCode,
    responseObject: { errorCode: normalized.errorCode },
  } satisfies ServiceResponse<ErrorResponseObject>);
}

function normalizeError(error: unknown): {
  statusCode: number;
  errorCode: string;
  publicMessage: string;
} {
  if (error instanceof ChatServiceError || error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      publicMessage: error.statusCode === 400 ? 'Invalid request' : error.message,
    };
  }

  if (isMalformedJsonError(error)) {
    return {
      statusCode: 400,
      errorCode: 'invalid_request',
      publicMessage: 'Invalid request',
    };
  }

  return {
    statusCode: 500,
    errorCode: 'internal_error',
    publicMessage: 'Internal server error',
  };
}

function isMalformedJsonError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { status?: unknown; statusCode?: unknown; type?: unknown };
  return (
    (candidate.status === 400 || candidate.statusCode === 400) &&
    candidate.type === 'entity.parse.failed'
  );
}
