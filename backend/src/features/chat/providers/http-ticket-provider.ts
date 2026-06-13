import { createHmac, randomUUID } from 'node:crypto';

import type { TicketResult } from '@loanslam/contracts';

import type { TicketInput, TicketProvider } from './ticket-provider.js';

export interface HttpTicketProviderOptions {
  webhookUrl: string;
  webhookSecret?: string | undefined;
  timeoutMs?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
}

const defaultTimeoutMs = 10_000;

export class HttpTicketProvider implements TicketProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpTicketProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async submitHandoff(input: TicketInput): Promise<TicketResult> {
    const payload = {
      eventType: 'loanslam.chat_handoff_requested',
      eventId: `evt_${randomUUID().replaceAll('-', '')}`,
      conversationRef: input.conversationRef,
      requestRef: input.requestRef,
      reasonCode: input.reasonCode,
      intake: input.intake,
      transcriptSummary: input.transcriptSummary,
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-loanslam-event': payload.eventType,
      'x-loanslam-signature-timestamp': timestamp,
      'x-loanslam-signature-version': 'v1',
    };

    if (this.options.webhookSecret) {
      headers['x-loanslam-signature'] = createHmac('sha256', this.options.webhookSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
    }

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      this.options.timeoutMs ?? defaultTimeoutMs,
    );

    let response: Response;
    try {
      response = await this.fetchImpl(this.options.webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: abortController.signal,
      });
    } catch {
      return {
        provider: 'http-ticket-provider',
        providerReference: payload.eventId,
        status: 'failed',
        reasonCode: 'ticket_webhook_failed',
      };
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return {
        provider: 'http-ticket-provider',
        providerReference: payload.eventId,
        status: 'failed',
        reasonCode: 'ticket_webhook_failed',
      };
    }

    return {
      provider: 'http-ticket-provider',
      providerReference: payload.eventId,
      status: 'submitted',
      reasonCode: 'ticket_webhook_submitted',
    };
  }
}
