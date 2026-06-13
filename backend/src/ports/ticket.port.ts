import type { IntakeFieldName, ReasonCode } from '@loanslam/contracts';

/**
 * Ticket / handoff boundary. The MVP creates tickets by POSTing to the human
 * team's webhook through this replaceable adapter (brief §7). In the POC the
 * default adapter records the payload to the audit trail instead of POSTing,
 * so the demo is self-contained; set TICKET_WEBHOOK_URL to POST for real.
 */
export interface TicketAdapter {
  createTicket(req: TicketRequest): Promise<TicketResult>;
}

export interface TicketRequest {
  conversationRef: string;
  reasonCode: ReasonCode;
  /** 'account' | 'vulnerability' | 'change_request' | 'general'. */
  category: string;
  priority: 'normal' | 'high' | 'urgent';
  /** Standard handoff PII collected for the human agent (never credentials). */
  contact: Partial<Record<IntakeFieldName, string>>;
  /** Short, redacted summary of the conversation so far. */
  summary: string;
}

export interface TicketResult {
  ticketRef: string;
  /** 'delivered' = POSTed to webhook; 'recorded' = demo-mode, stored locally. */
  status: 'delivered' | 'recorded' | 'failed';
}
