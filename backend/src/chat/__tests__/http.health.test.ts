import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { pino } from 'pino';
import type {
  ChatTurnResponse,
  CreateSessionRequest,
  IntakeRequest,
  MessageRequest,
  SessionCreatedResponse,
} from '@loanslam/contracts';
import { createApp } from '../../server.js';
import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type { IChatService, RequestContext } from '../../ports/chat.port.js';
import type { TurnOutcome } from '../../composition/types.js';
import { ServiceResponseFactory } from '../../common/serviceResponse.js';

// pino-http reads internal pino symbols, so use a real silent pino instance.
function fakeLogger(): Logger {
  return pino({ level: 'silent' }) as unknown as Logger;
}

function fakeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 8787,
    nodeEnv: 'development',
    logLevel: 'silent',
    widgetOrigin: 'http://localhost:5173',
    ai: { enabled: true, apiKey: 'k', baseUrl: '', model: 'fake' },
    groundingThreshold: 0.42,
    persistence: 'memory',
    dataDir: './.data',
    databaseUrl: undefined,
    ticket: { webhookUrl: undefined, webhookToken: undefined },
    sessionSecret: 'test',
    ...overrides,
  };
}

const cannedTurn: ChatTurnResponse = {
  conversationRef: 'conv_x',
  requestRef: 'req_x',
  state: {
    phase: 'anonymous_active',
    vulnerabilityFlagged: false,
    awaitingForm: false,
    goalSummary: null,
  },
  reply: { mode: 'fallback', text: 'fallback' },
};

class NoopChatService implements IChatService {
  async createSession(
    _i: CreateSessionRequest,
    _c: RequestContext,
  ): Promise<TurnOutcome<SessionCreatedResponse>> {
    return { response: ServiceResponseFactory.ok(cannedTurn, 'OK', 200) };
  }
  async handleMessage(
    _s: string | undefined,
    _i: MessageRequest,
    _c: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    return { response: ServiceResponseFactory.ok(cannedTurn, 'OK', 200) };
  }
  async submitIntake(
    _s: string | undefined,
    _i: IntakeRequest,
    _c: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    return { response: ServiceResponseFactory.ok(cannedTurn, 'OK', 200) };
  }
  async reset(
    _s: string | undefined,
    _c: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    return { response: ServiceResponseFactory.ok(cannedTurn, 'OK', 200) };
  }
}

function buildApp(config: AppConfig) {
  return createApp({
    chatService: new NoopChatService(),
    config,
    logger: fakeLogger(),
  });
}

describe('GET /api/health', () => {
  it('returns 200 with an ok HealthResponse envelope', async () => {
    const app = buildApp(fakeConfig());
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const obj = res.body.responseObject;
    expect(obj.status).toBe('ok');
    expect(typeof obj.uptimeSeconds).toBe('number');
    expect(obj.aiEnabled).toBe(true);
    expect(obj.persistence).toBe('memory');
  });

  it('reflects config flags in the payload', async () => {
    const app = buildApp(
      fakeConfig({
        ai: { enabled: false, apiKey: '', baseUrl: '', model: 'm' },
        persistence: 'sqlserver',
      }),
    );
    const res = await request(app).get('/api/health');
    expect(res.body.responseObject.aiEnabled).toBe(false);
    expect(res.body.responseObject.persistence).toBe('sqlserver');
  });
});

describe('error handling', () => {
  it('returns a safe 500 fail envelope when the service throws', async () => {
    class ThrowingService extends NoopChatService {
      override async handleMessage(): Promise<TurnOutcome<ChatTurnResponse>> {
        throw new Error('boom secret internals');
      }
    }
    const app = createApp({
      chatService: new ThrowingService(),
      config: fakeConfig(),
      logger: fakeLogger(),
    });
    const csrf = 'csrf_fake_token_value_0123456789';
    const res = await request(app)
      .post('/api/message')
      .set('Cookie', [`ls_csrf=${csrf}`])
      .set('x-csrf-token', csrf)
      .send({ clientMessageId: 'c1', text: 'hello' });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('boom secret internals');
  });
});

describe('openapi document', () => {
  it('builds a v3 document with the registered paths', async () => {
    const { buildOpenApiDocument } = await import('../../config/openapi.js');
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe('3.0.0');
    expect(doc.paths['/api/health']).toBeDefined();
    expect(doc.paths['/api/session']).toBeDefined();
    expect(doc.paths['/api/message']).toBeDefined();
    expect(doc.paths['/api/intake']).toBeDefined();
    expect(doc.paths['/api/reset']).toBeDefined();
  });
});
