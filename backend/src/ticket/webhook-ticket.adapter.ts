import type { AppConfig } from '../config/env.js';
import type { Logger } from '../config/logger.js';
import { newTicketRef } from '../common/ids.js';
import type { TicketAdapter, TicketRequest, TicketResult } from '../ports/ticket.port.js';

/** Minimal fetch surface this adapter needs; matches the global `fetch`. */
export type FetchImpl = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number }>;

export interface WebhookTicketAdapterDeps {
  config: AppConfig;
  logger: Logger;
  /** Injectable for tests; defaults to the platform fetch. */
  fetchImpl?: FetchImpl;
}

/** How long we wait on the webhook before treating delivery as failed. */
const WEBHOOK_TIMEOUT_MS = 5_000;

/**
 * Ticket / handoff boundary (brief §7). Always mints a ticketRef so the pipeline
 * has something to show the customer and audit. When a webhook URL is configured
 * it POSTs the handoff payload to the human team; otherwise it runs in demo mode
 * and merely records the ticket locally.
 *
 * A webhook that errors, times out, or returns non-2xx is LOGGED and reported as
 * 'failed' — this method NEVER throws, because the turn must still respond and
 * the audit trail must capture the failure (audit-event map: `ticket_created` /
 * `failure`).
 */
export class WebhookTicketAdapter implements TicketAdapter {
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly fetchImpl: FetchImpl;

  constructor({ config, logger, fetchImpl }: WebhookTicketAdapterDeps) {
    this.config = config;
    this.logger = logger;
    // globalThis.fetch is bound here (not at default-param time) so a single
    // adapter instance keeps working even if the global is swapped in tests.
    this.fetchImpl = fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
  }

  async createTicket(req: TicketRequest): Promise<TicketResult> {
    const ticketRef = newTicketRef();
    const { webhookUrl, webhookToken } = this.config.ticket;

    // Demo mode: nothing to POST to, so we just record the payload locally.
    if (!webhookUrl) {
      return { ticketRef, status: 'recorded' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (webhookToken) {
        headers['authorization'] = `Bearer ${webhookToken}`;
      }

      const res = await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ticketRef, ...req }),
        signal: controller.signal,
      });

      if (res.ok) {
        return { ticketRef, status: 'delivered' };
      }

      // Non-2xx: the webhook rejected us. Record, log, but do not throw.
      this.logger.warn(
        { ticketRef, conversationRef: req.conversationRef, status: res.status },
        'ticket webhook returned non-2xx; ticket marked failed',
      );
      return { ticketRef, status: 'failed' };
    } catch (err) {
      // Thrown error, abort/timeout, or network failure. Swallow and report.
      this.logger.error(
        { ticketRef, conversationRef: req.conversationRef, err },
        'ticket webhook delivery failed; ticket marked failed',
      );
      return { ticketRef, status: 'failed' };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Factory mirroring the production default fetch. */
export function createWebhookTicketAdapter(deps: WebhookTicketAdapterDeps): WebhookTicketAdapter {
  return new WebhookTicketAdapter(deps);
}
