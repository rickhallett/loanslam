import { describe, expect, it, vi } from 'vitest';
import type { ChatTurnResponse, ServiceResponse, SessionCreatedResponse } from '@loanslam/contracts';
import { ChatApiError, ChatClient } from '../api/client.js';

function envelope<T>(responseObject: T, overrides: Partial<ServiceResponse<T>> = {}): string {
  return JSON.stringify({
    success: true,
    message: 'ok',
    responseObject,
    statusCode: 200,
    ...overrides,
  } satisfies ServiceResponse<T>);
}

const sessionResponse: SessionCreatedResponse = {
  conversationRef: 'conv_1',
  requestRef: 'req_1',
  state: {
    phase: 'anonymous_active',
    vulnerabilityFlagged: false,
    awaitingForm: false,
    goalSummary: null,
  },
  reply: { mode: 'clarify', text: 'Hi, how can I help?' },
};

const turnResponse: ChatTurnResponse = {
  ...sessionResponse,
  requestRef: 'req_2',
  reply: { mode: 'fallback', text: 'Let me connect you to a human.' },
};

describe('ChatClient', () => {
  it('captures the x-csrf-token from the session header and echoes it on later requests', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/api/session')) {
        return new Response(envelope(sessionResponse), {
          status: 200,
          headers: { 'x-csrf-token': 'csrf-token-123' },
        });
      }
      return new Response(envelope(turnResponse), { status: 200 });
    });

    const client = new ChatClient('http://test', fetchImpl);

    await client.createSession();
    expect(client.getCsrfToken()).toBe('csrf-token-123');

    await client.sendMessage('hello');

    const sessionCall = calls[0];
    const messageCall = calls[1];
    // The session create request does not carry a CSRF header yet.
    expect((sessionCall?.init?.headers as Record<string, string>)['x-csrf-token']).toBeUndefined();
    // Subsequent state-changing requests echo the captured token.
    expect((messageCall?.init?.headers as Record<string, string>)['x-csrf-token']).toBe(
      'csrf-token-123',
    );
    // Credentialed fetch is always used.
    expect(sessionCall?.init?.credentials).toBe('include');
    expect(messageCall?.init?.credentials).toBe('include');
  });

  it('generates a fresh clientMessageId per send', async () => {
    const bodies: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ''));
      return new Response(envelope(turnResponse), { status: 200 });
    });
    const client = new ChatClient('http://test', fetchImpl);

    await client.sendMessage('one');
    await client.sendMessage('two');

    const first = JSON.parse(bodies[0] ?? '{}') as { clientMessageId?: string };
    const second = JSON.parse(bodies[1] ?? '{}') as { clientMessageId?: string };
    expect(first.clientMessageId).toBeTruthy();
    expect(second.clientMessageId).toBeTruthy();
    expect(first.clientMessageId).not.toBe(second.clientMessageId);
  });

  it('throws a ChatApiError when the envelope reports failure', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(envelope(null, { success: false, message: 'CSRF mismatch', statusCode: 403 }), {
          status: 200,
        }),
    );
    const client = new ChatClient('http://test', fetchImpl);

    await expect(client.sendMessage('x')).rejects.toBeInstanceOf(ChatApiError);
    await expect(client.sendMessage('x')).rejects.toMatchObject({
      message: 'CSRF mismatch',
      statusCode: 403,
    });
  });
});
