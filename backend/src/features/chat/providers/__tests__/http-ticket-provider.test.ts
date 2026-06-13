import { describe, expect, it, vi } from 'vitest';

import { HttpTicketProvider } from '../http-ticket-provider.js';

const input = {
  conversationRef: 'conv_123',
  requestRef: 'req_123',
  reasonCode: 'handoff_intake_submitted',
  transcriptSummary: 'Support handoff requested.',
  intake: {
    name: 'Alex Customer',
    dob: '1990-01-31',
    address: '1 High Street, London',
    phone: '+447700900123',
    email: 'alex@example.com',
    situationalContext: 'I need support.',
  },
};

describe('HttpTicketProvider', () => {
  it('sends replay-friendly signed webhook headers with a bounded request signal', async () => {
    let requestInit: RequestInit | undefined;
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      requestInit = init;
      return Promise.resolve(new Response('{}', { status: 202 }));
    });
    const provider = new HttpTicketProvider({
      webhookUrl: 'https://tickets.example/webhook',
      webhookSecret: 'secret',
      fetchImpl,
    });

    const result = await provider.submitHandoff(input);

    expect(result.status).toBe('submitted');
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal);
    expect(requestInit?.headers).toMatchObject({
      'content-type': 'application/json',
      'x-loanslam-event': 'loanslam.chat_handoff_requested',
      'x-loanslam-signature-version': 'v1',
    });
    expect((requestInit?.headers as Record<string, string>)['x-loanslam-signature']).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(
      (requestInit?.headers as Record<string, string>)['x-loanslam-signature-timestamp'],
    ).toMatch(/^\d+$/);
  });
});
