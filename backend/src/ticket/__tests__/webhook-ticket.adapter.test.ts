import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type { TicketRequest } from '../../ports/ticket.port.js';
import { WebhookTicketAdapter } from '../webhook-ticket.adapter.js';
import type { FetchImpl } from '../webhook-ticket.adapter.js';

// Minimal logger fake implementing the surface the adapter uses.
const fakeLogger = (): Logger =>
  ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }) as unknown as Logger;

// Build only the config slice the adapter reads; cast to AppConfig for the deps.
const makeConfig = (ticket: AppConfig['ticket']): AppConfig =>
  ({ ticket }) as unknown as AppConfig;

const baseRequest = (): TicketRequest => ({
  conversationRef: 'conv_abc123def456',
  reasonCode: 'account_specific',
  category: 'account',
  priority: 'high',
  contact: { full_name: 'Jane Doe', email: 'jane@example.com' },
  summary: 'Customer asks about their specific balance.',
});

describe('WebhookTicketAdapter', () => {
  it('POSTs and returns delivered when the webhook resolves 2xx, body includes ticketRef + contact', async () => {
    const calls: Array<{ url: string; init: Parameters<FetchImpl>[1] }> = [];
    const fetchImpl: FetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200 };
    });

    const adapter = new WebhookTicketAdapter({
      config: makeConfig({ webhookUrl: 'https://hooks.example.com/tickets', webhookToken: 'sek-ret' }),
      logger: fakeLogger(),
      fetchImpl,
    });

    const req = baseRequest();
    const result = await adapter.createTicket(req);

    expect(result.status).toBe('delivered');
    expect(result.ticketRef).toMatch(/^tkt_/);

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('expected a fetch call');

    expect(call.url).toBe('https://hooks.example.com/tickets');
    expect(call.init?.method).toBe('POST');
    expect(call.init?.headers?.['authorization']).toBe('Bearer sek-ret');
    expect(call.init?.headers?.['content-type']).toBe('application/json');
    expect(call.init?.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(call.init?.body ?? '{}') as Record<string, unknown>;
    expect(body['ticketRef']).toBe(result.ticketRef);
    expect(body['contact']).toEqual(req.contact);
    expect(body['conversationRef']).toBe(req.conversationRef);
    expect(body['reasonCode']).toBe(req.reasonCode);
  });

  it('omits the Authorization header when no token is configured', async () => {
    let seen: Parameters<FetchImpl>[1] | undefined;
    const fetchImpl: FetchImpl = vi.fn(async (_url, init) => {
      seen = init;
      return { ok: true, status: 201 };
    });

    const adapter = new WebhookTicketAdapter({
      config: makeConfig({ webhookUrl: 'https://hooks.example.com/tickets', webhookToken: undefined }),
      logger: fakeLogger(),
      fetchImpl,
    });

    const result = await adapter.createTicket(baseRequest());

    expect(result.status).toBe('delivered');
    expect(seen?.headers?.['authorization']).toBeUndefined();
  });

  it('returns recorded and never calls fetch in demo mode (no webhookUrl)', async () => {
    const fetchImpl: FetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));

    const adapter = new WebhookTicketAdapter({
      config: makeConfig({ webhookUrl: undefined, webhookToken: undefined }),
      logger: fakeLogger(),
      fetchImpl,
    });

    const result = await adapter.createTicket(baseRequest());

    expect(result.status).toBe('recorded');
    expect(result.ticketRef).toMatch(/^tkt_/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns failed (without throwing) when fetch throws', async () => {
    const logger = fakeLogger();
    const fetchImpl: FetchImpl = vi.fn(async () => {
      throw new Error('connection refused');
    });

    const adapter = new WebhookTicketAdapter({
      config: makeConfig({ webhookUrl: 'https://hooks.example.com/tickets', webhookToken: 'sek-ret' }),
      logger,
      fetchImpl,
    });

    let result: Awaited<ReturnType<typeof adapter.createTicket>> | undefined;
    await expect(
      (async () => {
        result = await adapter.createTicket(baseRequest());
      })(),
    ).resolves.toBeUndefined();

    expect(result?.status).toBe('failed');
    expect(result?.ticketRef).toMatch(/^tkt_/);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('returns failed (without throwing) when the webhook responds non-2xx', async () => {
    const logger = fakeLogger();
    const fetchImpl: FetchImpl = vi.fn(async () => ({ ok: false, status: 503 }));

    const adapter = new WebhookTicketAdapter({
      config: makeConfig({ webhookUrl: 'https://hooks.example.com/tickets', webhookToken: undefined }),
      logger,
      fetchImpl,
    });

    const result = await adapter.createTicket(baseRequest());

    expect(result.status).toBe('failed');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
