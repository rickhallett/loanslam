import { pino } from 'pino';
import { config } from './env.js';

/**
 * Process-wide structured logger. Lives under config, NOT exported from
 * server.ts (architecture.md: server.ts is composition wiring only). Pretty in
 * dev, JSON in production.
 */
export const logger = pino({
  level: config.logLevel,
  ...(config.nodeEnv === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }
    : {}),
});

export type Logger = typeof logger;
