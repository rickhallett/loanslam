import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createChatClient } from './chat-client.js';

describe('createChatClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a session with credentials and keeps only csrf/conversation refs in memory', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(sessionEnvelope()));
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const client = createChatClient({
      baseUrl: 'https://api.example',
      fetchImpl: fetchMock,
    });

    const response = await client.createSession();

    expect(response.conversationRef).toBe('conv_123');
    expect(fetchMock).toHaveBeenCalledWith('https://api.example/chat/session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
    });
    expect(client.getSessionSnapshot()).toEqual({
      conversationRef: 'conv_123',
      csrfToken: 'csrf_123',
    });
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it('sends messages with csrf token and credentials', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(sessionEnvelope()))
      .mockResolvedValueOnce(jsonResponse(messageEnvelope()));
    const client = createChatClient({
      baseUrl: 'https://api.example',
      fetchImpl: fetchMock,
      idFactory: () => 'client-message-1',
    });

    await client.createSession();
    await client.sendMessage('How do I apply?');

    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example/chat/message', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf_123',
      },
      body: JSON.stringify({ clientMessageId: 'client-message-1', text: 'How do I apply?' }),
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function sessionEnvelope() {
  return {
    success: true,
    message: 'Session created',
    statusCode: 201,
    responseObject: {
      conversationRef: 'conv_123',
      requestRef: 'req_123',
      correlationRef: 'corr_123',
      csrfToken: 'csrf_123',
      state: 'active',
      messages: [assistantMessage('Hello from Loanslam.', 'session_greeting')],
      audit: { events: ['session_created'], reasonCodes: ['session_created'] },
    },
  };
}

function messageEnvelope() {
  return {
    success: true,
    message: 'Message processed',
    statusCode: 200,
    responseObject: {
      conversationRef: 'conv_123',
      requestRef: 'req_124',
      correlationRef: 'corr_124',
      csrfToken: 'csrf_123',
      state: 'active',
      messages: [assistantMessage('Apply online through Loanslam.', 'general_process_question')],
      audit: { events: ['message_routed'], reasonCodes: ['general_process_question'] },
    },
  };
}

function assistantMessage(text: string, reasonCode: string) {
  return {
    id: `msg_${reasonCode}`,
    role: 'assistant',
    text,
    createdAt: '2026-06-13T12:00:00.000Z',
    reasonCode,
  };
}
