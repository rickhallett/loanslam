import { describe, it, expect, beforeEach } from 'vitest';
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

function fakeConfig(): AppConfig {
  return {
    port: 8787,
    nodeEnv: 'development',
    logLevel: 'silent',
    widgetOrigin: 'http://localhost:5173',
    ai: { enabled: false, apiKey: '', baseUrl: '', model: 'fake' },
    groundingThreshold: 0.42,
    persistence: 'memory',
    dataDir: './.data',
    databaseUrl: undefined,
    ticket: { webhookUrl: undefined, webhookToken: undefined },
    sessionSecret: 'test',
  };
}

const cannedTurn: ChatTurnResponse = {
  conversationRef: 'conv_test123',
  requestRef: 'req_test123',
  state: {
    phase: 'anonymous_active',
    vulnerabilityFlagged: false,
    awaitingForm: false,
    goalSummary: null,
  },
  reply: { mode: 'fallback', text: 'I can connect you to a human.' },
};

class FakeChatService implements IChatService {
  public messageCalled = false;
  public lastSessionId: string | undefined;
  public readonly issuedSessionId = 'sid_fake_session_value';
  public readonly issuedCsrf = 'csrf_fake_token_value_0123456789';

  async createSession(
    _input: CreateSessionRequest,
    _ctx: RequestContext,
  ): Promise<TurnOutcome<SessionCreatedResponse>> {
    return {
      response: ServiceResponseFactory.ok(cannedTurn, 'Session created.', 200),
      setSessionId: this.issuedSessionId,
      csrfToken: this.issuedCsrf,
    };
  }

  async handleMessage(
    sessionId: string | undefined,
    _input: MessageRequest,
    _ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    this.messageCalled = true;
    this.lastSessionId = sessionId;
    return { response: ServiceResponseFactory.ok(cannedTurn, 'OK', 200) };
  }

  async submitIntake(
    _sessionId: string | undefined,
    _input: IntakeRequest,
    _ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    return { response: ServiceResponseFactory.ok(cannedTurn, 'OK', 200) };
  }

  async reset(
    _sessionId: string | undefined,
    _ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    return {
      response: ServiceResponseFactory.ok(cannedTurn, 'Reset.', 200),
      clearSession: true,
    };
  }
}

function buildApp() {
  const service = new FakeChatService();
  const app = createApp({
    chatService: service,
    config: fakeConfig(),
    logger: fakeLogger(),
  });
  return { app, service };
}

const CSRF = 'csrf_fake_token_value_0123456789';
const validBody: MessageRequest = { clientMessageId: 'c1', text: 'hello' };

describe('POST /api/message — CSRF guard', () => {
  let app: ReturnType<typeof buildApp>['app'];
  let svc: FakeChatService;

  beforeEach(() => {
    const built = buildApp();
    app = built.app;
    svc = built.service;
  });

  it('rejects with 403 when no CSRF header is present', async () => {
    const res = await request(app)
      .post('/api/message')
      .set('Cookie', [`ls_csrf=${CSRF}`])
      .send(validBody);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(svc.messageCalled).toBe(false);
  });

  it('rejects with 403 when the header does not match the cookie', async () => {
    const res = await request(app)
      .post('/api/message')
      .set('Cookie', [`ls_csrf=${CSRF}`])
      .set('x-csrf-token', 'wrong-token')
      .send(validBody);
    expect(res.status).toBe(403);
    expect(svc.messageCalled).toBe(false);
  });

  it('rejects with 403 when the cookie is absent', async () => {
    const res = await request(app)
      .post('/api/message')
      .set('x-csrf-token', CSRF)
      .send(validBody);
    expect(res.status).toBe(403);
    expect(svc.messageCalled).toBe(false);
  });

  it('passes when header matches the double-submit cookie', async () => {
    const res = await request(app)
      .post('/api/message')
      .set('Cookie', [`ls_csrf=${CSRF}`])
      .set('x-csrf-token', CSRF)
      .send(validBody);
    expect(res.status).toBe(200);
    expect(svc.messageCalled).toBe(true);
  });

  it('reads the HttpOnly session id from the ls_sid cookie', async () => {
    await request(app)
      .post('/api/message')
      .set('Cookie', [`ls_csrf=${CSRF}`, 'ls_sid=sid_from_cookie'])
      .set('x-csrf-token', CSRF)
      .send(validBody);
    expect(svc.lastSessionId).toBe('sid_from_cookie');
  });
});

describe('POST /api/message — body validation', () => {
  let app: ReturnType<typeof buildApp>['app'];
  let svc: FakeChatService;

  beforeEach(() => {
    const built = buildApp();
    app = built.app;
    svc = built.service;
  });

  it('returns 400 with a fail envelope on a bad body (after passing CSRF)', async () => {
    const res = await request(app)
      .post('/api/message')
      .set('Cookie', [`ls_csrf=${CSRF}`])
      .set('x-csrf-token', CSRF)
      .send({ text: '' }); // missing clientMessageId, empty text
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid request/i);
    expect(svc.messageCalled).toBe(false);
  });

  it('returns 400 when text exceeds the max length', async () => {
    const res = await request(app)
      .post('/api/message')
      .set('Cookie', [`ls_csrf=${CSRF}`])
      .set('x-csrf-token', CSRF)
      .send({ clientMessageId: 'c1', text: 'x'.repeat(5000) });
    expect(res.status).toBe(400);
    expect(svc.messageCalled).toBe(false);
  });
});

describe('POST /api/reset', () => {
  it('clears both cookies on reset', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/reset')
      .set('Cookie', [`ls_csrf=${CSRF}`])
      .set('x-csrf-token', CSRF)
      .send({});
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    const list = Array.isArray(setCookie) ? setCookie : [setCookie];
    expect(list.some((c) => c?.startsWith('ls_sid='))).toBe(true);
    expect(list.some((c) => c?.startsWith('ls_csrf='))).toBe(true);
  });
});
