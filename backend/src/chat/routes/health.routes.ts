import { Router } from 'express';
import type { ChatController } from '../controllers/chat.controller.js';
import { registerOpenApiPaths } from '../../config/openapi.js';

/** Health route mounted under `/api`. GET /api/health. */
export function healthRoutes(controller: ChatController): Router {
  registerOpenApiPaths();

  const router = Router();
  router.get('/health', controller.health);
  return router;
}
