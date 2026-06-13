import { Router } from 'express';
import type { ChatController } from '../controllers/chat.controller.js';
import { csrf } from '../../middleware/csrf.js';
import { registerOpenApiPaths } from '../../config/openapi.js';

/**
 * Chat routes mounted under `/api`. CSRF guards every state-changing route
 * EXCEPT `POST /session`, which bootstraps the token and is protected by the
 * CORS origin allowlist instead (architecture.md). OpenAPI paths are registered
 * route-local here.
 */
export function chatRoutes(controller: ChatController): Router {
  registerOpenApiPaths();

  const router = Router();

  // Bootstraps session + CSRF cookies — intentionally NOT behind csrf().
  router.post('/session', controller.createSession);

  // State-changing turns — double-submit CSRF required.
  router.post('/message', csrf, controller.message);
  router.post('/intake', csrf, controller.intake);
  router.post('/reset', csrf, controller.reset);

  return router;
}
