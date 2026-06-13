import { Router } from 'express';

import { env, type AppEnv } from '../../config/env.js';
import { csrfProtection } from '../../middleware/csrf.js';
import type { ChatRepository } from './chat.models.js';
import { ChatController } from './chat.controller.js';
import type { ChatService } from './chat.service.js';

export interface ChatRoutesOptions {
  chatService: ChatService;
  repository: ChatRepository;
  appEnv?: AppEnv;
}

export function createChatRouter(options: ChatRoutesOptions): Router {
  const appEnv = options.appEnv ?? env;
  const controller = new ChatController({ chatService: options.chatService, appEnv });
  const router = Router();
  const requireCsrf = csrfProtection(options.repository);

  router.post('/session', controller.createSession);
  router.post('/message', requireCsrf, controller.sendMessage);
  router.post('/intake', requireCsrf, controller.submitIntake);
  router.post('/reset', requireCsrf, controller.reset);

  return router;
}
