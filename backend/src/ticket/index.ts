import type { AppConfig } from '../config/env.js';
import type { Logger } from '../config/logger.js';
import type { TicketAdapter } from '../ports/ticket.port.js';
import { WebhookTicketAdapter } from './webhook-ticket.adapter.js';

/**
 * Composition entry point for the ticket boundary. Returns the webhook adapter,
 * which POSTs to `config.ticket.webhookUrl` when set and otherwise records the
 * ticket locally (demo mode).
 */
export function createTicketAdapter(config: AppConfig, logger: Logger): TicketAdapter {
  return new WebhookTicketAdapter({ config, logger });
}

export { WebhookTicketAdapter, createWebhookTicketAdapter } from './webhook-ticket.adapter.js';
export type { FetchImpl, WebhookTicketAdapterDeps } from './webhook-ticket.adapter.js';
