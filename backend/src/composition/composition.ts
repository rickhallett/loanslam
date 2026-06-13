import type { Express } from 'express';
import { config, type AppConfig } from '../config/env.js';
import { logger, type Logger } from '../config/logger.js';
import { knowledgeBase } from '../config/kb.js';
import { createModelAdapter } from '../ai/index.js';
import { createRetrievalAdapter } from '../retrieval/index.js';
import { createTicketAdapter } from '../ticket/index.js';
import { createRepositories } from '../persistence/index.js';
import { ChatService } from '../chat/services/chat.service.js';
import { createApp } from '../server.js';
import type { IChatService } from '../ports/chat.port.js';
import type { Repositories } from '../ports/repository.port.js';

/**
 * Composition root. The ONE place concrete adapters, repositories, and the
 * ChatService are wired together. server.ts stays composition-wiring-free; this
 * keeps the runtime singletons out of the HTTP shell (architecture.md).
 */
export interface BuiltService {
  chatService: IChatService;
  repos: Repositories;
  config: AppConfig;
  logger: Logger;
}

/** Build the fully-wired ChatService and its concrete dependencies. */
export async function buildChatService(): Promise<BuiltService> {
  const kb = knowledgeBase();
  const repos = await createRepositories(config, logger);
  const model = createModelAdapter(config, logger);
  const retrieval = createRetrievalAdapter(kb, config.groundingThreshold);
  const ticket = createTicketAdapter(config, logger);

  const chatService = new ChatService({ repos, model, retrieval, ticket, kb, config, logger });

  logger.info(
    {
      persistence: config.persistence,
      aiEnabled: config.ai.enabled,
      model: config.ai.enabled ? config.ai.model : 'deterministic',
      kbItems: kb.length,
      groundingThreshold: config.groundingThreshold,
    },
    'composition: ChatService wired',
  );

  return { chatService, repos, config, logger };
}

/** Build the HTTP app with the wired ChatService. */
export async function buildApp(): Promise<{ app: Express; config: AppConfig; logger: Logger }> {
  const { chatService } = await buildChatService();
  const app = createApp({ chatService, config, logger });
  return { app, config, logger };
}
