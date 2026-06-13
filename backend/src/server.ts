import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppDeps } from './composition/types.js';
import { createChatController } from './chat/controllers/chat.controller.js';
import { chatRoutes } from './chat/routes/chat.routes.js';
import { healthRoutes } from './chat/routes/health.routes.js';
import { requestContext } from './middleware/requestContext.js';
import { errorHandler } from './middleware/errorHandler.js';

// Re-exported so the cookie policy has a single home but satisfies the spec's
// "export a sessionCookieOptions(config) helper from server.ts" contract.
export { sessionCookieOptions } from './middleware/cookies.js';

/**
 * Compose the Express application. Pure wiring (architecture.md: server.ts is
 * composition only — no runtime singletons live here, none are instantiated).
 * Does NOT call `listen`; the index/composition root owns the lifecycle.
 *
 * Middleware order is load-bearing:
 *   helmet -> cors(credentialed, widget origin) -> cookieParser -> json(64kb)
 *   -> pino-http -> requestContext -> /api routers -> errorHandler (LAST).
 */
export function createApp(deps: AppDeps): Express {
  const { chatService, config, logger } = deps;
  const app = express();

  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: config.widgetOrigin,
      credentials: true,
      // Expose the CSRF header so the widget can read it after /api/session.
      exposedHeaders: ['x-csrf-token', 'x-request-ref'],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '64kb' }));
  app.use(
    pinoHttp({
      logger,
      // Never log the raw session id or any bearer token. The Cookie header
      // carries ls_sid (the secret session id); strip it and Authorization
      // entirely from request/response logs (brief §16: session id stays secret).
      redact: {
        paths: [
          'req.headers.cookie',
          'req.headers.authorization',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
    }),
  );
  app.use(requestContext(logger));

  const controller = createChatController({ chatService, config, logger });

  app.use('/api', healthRoutes(controller));
  app.use('/api', chatRoutes(controller));

  // Terminal error handler MUST be last.
  app.use(errorHandler(logger));

  return app;
}
