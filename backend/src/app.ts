import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env, type AppEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { getPrismaClient } from './config/prisma.js';
import type { ChatRepository } from './features/chat/chat.models.js';
import { PrismaChatRepository } from './features/chat/chat.repository.js';
import { createChatRouter } from './features/chat/chat.routes.js';
import { ChatService } from './features/chat/chat.service.js';
import { HttpTicketProvider } from './features/chat/providers/http-ticket-provider.js';
import { NullTicketProvider } from './features/chat/providers/null-ticket-provider.js';
import { OpenAIModelProvider } from './features/chat/providers/openai-model-provider.js';
import { OpenAIRagProvider } from './features/chat/providers/openai-rag-provider.js';
import type { TicketProvider } from './features/chat/providers/ticket-provider.js';
import { errorMiddleware } from './middleware/errors.js';
import { requestContextMiddleware } from './middleware/request-context.js';
import { sessionMiddleware } from './middleware/session.js';

export interface CreateAppOptions {
  chatService?: ChatService;
  repository?: ChatRepository;
  appEnv?: AppEnv;
}

export function createApp(options: CreateAppOptions = {}) {
  const appEnv = options.appEnv ?? env;
  const repository =
    options.repository ?? options.chatService?.repository ?? createDefaultRepository();
  const chatService = options.chatService ?? createDefaultChatService(repository, appEnv);
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: appEnv.WIDGET_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  if (appEnv.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
  }
  app.use(requestContextMiddleware);
  app.use(
    sessionMiddleware({
      cookieName: appEnv.SESSION_COOKIE_NAME,
      secret: appEnv.SESSION_SECRET,
      nodeEnv: appEnv.NODE_ENV,
    }),
  );

  app.get('/health', (_request, response) => {
    response.status(200).json({ ok: true });
  });
  app.use(
    '/chat',
    createChatRouter({
      chatService,
      repository,
      appEnv,
    }),
  );
  app.use(errorMiddleware);

  return app;
}

function createDefaultRepository(): ChatRepository {
  return new PrismaChatRepository(getPrismaClient());
}

function createDefaultChatService(repository: ChatRepository, appEnv: AppEnv): ChatService {
  return new ChatService({
    repository,
    modelProvider: OpenAIModelProvider.fromEnv(appEnv),
    ragProvider: OpenAIRagProvider.fromEnv(appEnv),
    ticketProvider: createTicketProvider(appEnv),
  });
}

function createTicketProvider(appEnv: AppEnv): TicketProvider {
  if (!appEnv.TICKET_WEBHOOK_URL) {
    return new NullTicketProvider();
  }

  const options = {
    webhookUrl: appEnv.TICKET_WEBHOOK_URL,
  };

  if (appEnv.TICKET_WEBHOOK_SECRET) {
    return new HttpTicketProvider({
      ...options,
      webhookSecret: appEnv.TICKET_WEBHOOK_SECRET,
    });
  }

  return new HttpTicketProvider(options);
}
