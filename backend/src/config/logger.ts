import pino, { type LoggerOptions, type DestinationStream } from 'pino';

import { env } from './env.js';

const loggerOptions: LoggerOptions = {
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.csrfToken',
      '*.csrfTokenHash',
      '*.sessionSecret',
      '*.password',
      '*.token',
      '*.apiKey',
      'DATABASE_URL',
      'OPENAI_API_KEY',
      'TICKET_WEBHOOK_SECRET',
      'databaseUrl',
      'connectionString',
      'err.message',
      'error.message',
    ],
    censor: '[redacted]',
  },
};

export function createLogger(stream?: DestinationStream): pino.Logger {
  return pino(
    {
      ...loggerOptions,
      level: env.LOG_LEVEL,
    },
    stream,
  );
}

export const logger = createLogger();
