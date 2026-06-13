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
import { POLICY_VERSION } from '@loanslam/contracts';
import { createApp } from '../../server.js';
import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type {
  IChatService,
  RequestContext,
} from '../../ports/chat.port.js';
import type { TurnOutcome } from '../../composition/types.js';
import { ServiceResponseFactory } from '../../common/serviceResponse.js';

// ── Local fakes (this module may not import sibling concrete impls) ──────────

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
    ai: { enabled: false, apiKey: '', baseUrl: '', model: 'fake' },
    groundingThreshold: 0.42,
    persistence: 'memory',
    dataDir: './.data',
    databaseUrl: undefined,
    ticket: { webhookUrl: undefined, webhookToken: undefined },
    sessionSecret: 'test',
    ...overrides,
  };
}

const cannedState = {
  phase: 'anonymous_active' as const,
  vulnerabilityFlagged: false,
  awaitingForm: false,
  goalSummary: null,
};

const cannedTurn: ChatTurnResponse = {
  conversationRef: 'conv_test123',
  requestRef: 'req_test123',
  state: cannedState,
  reply: { mode: 'fallback', text: 'I can connect you to a human.' },
};

/**
 * Fake service returning deterministic TurnOutcomes. Records the ctx/session it
 * was called with so transport behaviour can be asserted.
 */
class FakeChatService implements IChatService {
  public lastSessionId: string | undefined;
  public lastCtx: RequestContext | undefined;
  public readonly issuedSessionId = 'sid_fake_session_value_01234567890123456789';
  public readonly issuedCsrf = 'csrf_fake_token_value_0123456789';

  async createSession(
    _input: CreateSessionRequest,
    ctx: RequestContext,
  ): Promise<TurnOutcome<SessionCreatedResponse>> {
    this.lastCtx = ctx;
    return {
      response: ServiceResponseFactory.ok(cannedTurn, 'Session created.', 200),
      setSessionId: this.issuedSessionId,
      csrfToken: this.issuedCsrf,
    };
  }

  async handleMessage(
    sessionId: string | undefined,
    _input: MessageRequest,
    ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    this.lastSessionId = sessionId;
    this.lastCtx = ctx;
    return { response: ServiceResponseFactory.ok(cannedTurn, 'OK', 200) };
  }

  async submitIntake(
    sessionId: string | undefined,
    _input: IntakeRequest,
    ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    this.lastSessionId = sessionId;
    this.lastCtx = ctx;
    return { response: ServiceResponseFactory.ok(cannedTurn, 'OK', 200) };
  }

  async reset(
    sessionId: string | undefined,
    ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    this.lastSessionId = sessionId;
    this.lastCtx = ctx;
    return {
      response: ServiceResponseFactory.ok(cannedTurn, 'Reset.', 200),
      clearSession: true,
    };
  }
}

function buildApp(serviceOverride?: IChatService) {
  const service = serviceOverride ?? new FakeChatService();
  const app = createApp({
    chatService: service,
    config: fakeConfig(),
    logger: fakeLogger(),
  });
  return { app, service };
}

/** Pull the value of a Set-Cookie entry by name from a supertest response. */
function cookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'];
  if (!raw) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  return list.find((c) => c.startsWith(`${name}=`));
}

describe('POST /api/session', () => {
  let svc: FakeChatService;
  let app: ReturnType<typeof buildApp>['app'];

  beforeEach(() => {
    svc = new FakeChatService();
    app = buildApp(svc).app;
  });

  it('returns a 200 envelope', async () => {
    const res = await request(app).post('/api/session').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.responseObject.reply.mode).toBe('fallback');
  });

  it('sets the ls_sid session cookie as HttpOnly', async () => {
    const res = await request(app).post('/api/session').send({});
    const sid = cookie(res, 'ls_sid');
    expect(sid).toBeDefined();
    expect(sid).toContain(svc.issuedSessionId);
    expect(sid?.toLowerCase()).toContain('httponly');
  });

  it('sets a readable ls_csrf cookie (NOT HttpOnly)', async () => {
    const res = await request(app).post('/api/session').send({});
    const csrf = cookie(res, 'ls_csrf');
    expect(csrf).toBeDefined();
    expect(csrf).toContain(svc.issuedCsrf);
    expect(csrf?.toLowerCase()).not.toContain('httponly');
  });

  it('returns the CSRF token in the x-csrf-token response header', async () => {
    const res = await request(app).post('/api/session').send({});
    expect(res.headers['x-csrf-token']).toBe(svc.issuedCsrf);
  });

  it('passes a requestRef ctx to the service', async () => {
    await request(app).post('/api/session').send({});
    expect(svc.lastCtx?.requestRef).toMatch(/^req_/);
  });

  it('uses dev cookie policy (SameSite=Lax, not Secure) in development', async () => {
    const res = await request(app).post('/api/session').send({});
    const sid = cookie(res, 'ls_sid');
    expect(sid?.toLowerCase()).toContain('samesite=lax');
    expect(sid?.toLowerCase()).not.toContain('secure');
  });

  it('uses CHIPS policy (SameSite=None; Secure; Partitioned) in production', async () => {
    const prodApp = createApp({
      chatService: new FakeChatService(),
      config: fakeConfig({ nodeEnv: 'production' }),
      logger: fakeLogger(),
    });
    const res = await request(prodApp).post('/api/session').send({});
    const sid = cookie(res, 'ls_sid');
    expect(sid?.toLowerCase()).toContain('samesite=none');
    expect(sid?.toLowerCase()).toContain('secure');
    expect(sid?.toLowerCase()).toContain('partitioned');
    expect(sid?.toLowerCase()).toContain('httponly');
  });
});

// Keep a reference so POLICY_VERSION import is meaningful and stable.
describe('contract sanity', () => {
  it('policy version is exported', () => {
    expect(typeof POLICY_VERSION).toBe('string');
  });
});
