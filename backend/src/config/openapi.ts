import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  chatTurnResponseSchema,
  createSessionRequestSchema,
  healthResponseSchema,
  intakeRequestSchema,
  messageRequestSchema,
  resetRequestSchema,
  serviceResponseSchema,
  sessionCreatedResponseSchema,
} from '@loanslam/contracts';

// extendZodWithOpenApi mutates the shared `z` to add `.openapi()`. Call exactly
// once for the whole process (idempotent guard below in case of re-import).
let extended = false;
function ensureExtended(): void {
  if (!extended) {
    extendZodWithOpenApi(z);
    extended = true;
  }
}
ensureExtended();

/**
 * Process-wide OpenAPI registry. Route files register their paths against this
 * singleton (route-local OpenAPI per architecture.md), and
 * `buildOpenApiDocument()` renders the final v3 document.
 */
export const registry = new OpenAPIRegistry();

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

/**
 * Register the four chat endpoints plus health. Idempotent: guarded so repeated
 * imports during tests do not double-register paths.
 */
let registered = false;
export function registerOpenApiPaths(): void {
  if (registered) return;
  registered = true;

  registry.registerPath({
    method: 'get',
    path: '/api/health',
    summary: 'Liveness / readiness probe.',
    responses: {
      200: {
        description: 'Service health snapshot.',
        content: jsonContent(serviceResponseSchema(healthResponseSchema)),
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/session',
    summary: 'Bootstrap an anonymous session; sets the session + CSRF cookies.',
    request: {
      body: { content: jsonContent(createSessionRequestSchema) },
    },
    responses: {
      200: {
        description: 'Session created.',
        content: jsonContent(serviceResponseSchema(sessionCreatedResponseSchema)),
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/message',
    summary: 'Submit a customer message turn.',
    request: {
      body: { content: jsonContent(messageRequestSchema) },
    },
    responses: {
      200: {
        description: 'Chat turn result.',
        content: jsonContent(serviceResponseSchema(chatTurnResponseSchema)),
      },
      400: { description: 'Invalid request body.' },
      403: { description: 'CSRF token missing or invalid.' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/intake',
    summary: 'Submit a requested handoff/intake form.',
    request: {
      body: { content: jsonContent(intakeRequestSchema) },
    },
    responses: {
      200: {
        description: 'Chat turn result after intake.',
        content: jsonContent(serviceResponseSchema(chatTurnResponseSchema)),
      },
      400: { description: 'Invalid request body.' },
      403: { description: 'CSRF token missing or invalid.' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/reset',
    summary: 'Reset the conversation; clears session + CSRF cookies.',
    request: {
      body: { content: jsonContent(resetRequestSchema) },
    },
    responses: {
      200: {
        description: 'Conversation reset.',
        content: jsonContent(serviceResponseSchema(chatTurnResponseSchema)),
      },
      403: { description: 'CSRF token missing or invalid.' },
    },
  });
}

/** Render the OpenAPI v3 document from the registered paths. */
export function buildOpenApiDocument(): ReturnType<
  OpenApiGeneratorV3['generateDocument']
> {
  registerOpenApiPaths();
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '0.1.0',
      title: 'Loanslam Chat Widget API',
      description:
        'Regulated UK consumer-loans customer-support chat widget (POC).',
    },
    servers: [{ url: '/' }],
  });
}
