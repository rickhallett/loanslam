import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';

import type { ClassifierResult, VulnerabilityResult } from '@loanslam/contracts';

import { createApp } from '../../../app.js';
import { env } from '../../../config/env.js';
import { InMemoryChatRepository } from '../chat.repository.js';
import { ChatService } from '../chat.service.js';
import type { ModelProvider } from '../providers/model-provider.js';
import type { RagProvider } from '../providers/rag-provider.js';
import type { TicketProvider } from '../providers/ticket-provider.js';

describe('chat routes', () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
  });

  it('creates sessions with cookies and never returns the raw session id', async () => {
    const client = await startTestClient();
    servers.push(client);

    const response = await client.fetch('/chat/session', { method: 'POST' });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('loanslam_sid=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('loanslam_csrf=');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain('SameSite=None');
    expect(setCookie).not.toContain('Partitioned');
    const responseObject = body.responseObject as Record<string, unknown>;
    expect(responseObject.conversationRef).toMatch(/^conv_/);
    expect(typeof responseObject.csrfToken).toBe('string');
    expect(responseObject.state).toBe('active');
    expect(JSON.stringify(responseObject)).not.toMatch(/session_[0-9a-f]{32}/);
    expect(responseObject.sessionId).toBeUndefined();
  });

  it('requires CSRF for message calls', async () => {
    const client = await startTestClient();
    servers.push(client);
    const session = await client.createSession();

    const response = await client.fetch('/chat/message', {
      method: 'POST',
      headers: { cookie: session.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ clientMessageId: 'client-message-1', text: 'Hello' }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      success: false,
      statusCode: 403,
      responseObject: { errorCode: 'csrf_invalid' },
    });
  });

  it('requires CSRF for intake calls', async () => {
    const client = await startTestClient();
    servers.push(client);
    const session = await client.createSession();

    const response = await client.fetch('/chat/intake', {
      method: 'POST',
      headers: { cookie: session.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        clientRequestId: 'client-intake-1',
        intake: { name: 'Alex', situationalContext: 'Please call me.' },
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      success: false,
      statusCode: 403,
      responseObject: { errorCode: 'csrf_invalid' },
    });
  });

  it('requires CSRF for reset calls', async () => {
    const client = await startTestClient();
    servers.push(client);
    const session = await client.createSession();

    const response = await client.fetch('/chat/reset', {
      method: 'POST',
      headers: { cookie: session.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ clientRequestId: 'client-reset-1', reason: 'user_requested' }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      success: false,
      statusCode: 403,
      responseObject: { errorCode: 'csrf_invalid' },
    });
  });

  it('returns a safe ServiceResponse envelope for invalid payloads', async () => {
    const client = await startTestClient();
    servers.push(client);
    const session = await client.createSession();

    const response = await client.fetch('/chat/message', {
      method: 'POST',
      headers: {
        cookie: session.cookie,
        'content-type': 'application/json',
        'x-csrf-token': session.csrfToken,
      },
      body: JSON.stringify({ clientMessageId: 'client-message-1', text: '   ' }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      message: 'Invalid request',
      statusCode: 400,
      responseObject: { errorCode: 'invalid_request' },
    });
  });

  it('returns a safe invalid-request envelope for malformed JSON', async () => {
    const client = await startTestClient();
    servers.push(client);

    const response = await client.fetch('/chat/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"broken"',
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      message: 'Invalid request',
      statusCode: 400,
      responseObject: { errorCode: 'invalid_request' },
    });
  });
});

async function startTestClient() {
  const repository = new InMemoryChatRepository();
  const service = new ChatService({
    repository,
    modelProvider: new RouteFakeModelProvider(),
    ragProvider: new RouteFakeRagProvider(),
    ticketProvider: new RouteFakeTicketProvider(),
  });
  const app = createApp({ chatService: service, appEnv: { ...env, NODE_ENV: 'test' } });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    async fetch(path: string, init?: RequestInit) {
      return fetch(`${baseUrl}${path}`, init);
    },
    async createSession() {
      const response = await this.fetch('/chat/session', { method: 'POST' });
      const body = (await response.json()) as {
        responseObject: { csrfToken: string };
      };
      const setCookie = response.headers.get('set-cookie') ?? '';
      return {
        csrfToken: body.responseObject.csrfToken,
        cookie: toCookieHeader(setCookie),
      };
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

function toCookieHeader(setCookieHeader: string): string {
  return setCookieHeader
    .split(/,(?=\s*loanslam_)/)
    .map((cookie) => cookie.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

class RouteFakeModelProvider implements ModelProvider {
  classifyVulnerability(): Promise<VulnerabilityResult> {
    return Promise.resolve({
      isVulnerable: false,
      routeToHuman: false,
      confidence: 0.97,
      signals: [],
      reasonCode: 'no_vulnerability_detected',
    });
  }

  classifyAction(): Promise<ClassifierResult> {
    return Promise.resolve({
      action: 'answer',
      confidence: 0.9,
      reasonCode: 'general_process_question',
      requiresGrounding: true,
    });
  }

  generateAnswer() {
    return Promise.resolve({
      text: 'Loanslam can help with general application process questions.',
      reasonCode: 'general_process_question',
    });
  }
}

class RouteFakeRagProvider implements RagProvider {
  retrieve() {
    return Promise.resolve({
      answerable: true,
      grounded: true,
      citations: [
        {
          sourceId: 'kb_general_process',
          title: 'Loanslam application process',
          score: 0.82,
        },
      ],
      context: 'Loanslam can answer general application process questions.',
      score: 0.82,
      reasonCode: 'grounded_retrieval',
    });
  }
}

class RouteFakeTicketProvider implements TicketProvider {
  submitHandoff() {
    return Promise.resolve({
      provider: 'fake-ticket-provider',
      providerReference: 'ticket_fake_1',
      status: 'pending' as const,
      reasonCode: 'fake_ticket_pending',
    });
  }
}
