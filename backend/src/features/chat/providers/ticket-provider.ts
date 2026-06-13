import type { IntakeSubmitRequest, TicketResult } from '@loanslam/contracts';

export interface TicketInput {
  conversationRef: string;
  requestRef: string;
  intake: IntakeSubmitRequest['intake'];
  transcriptSummary: string;
  reasonCode: string;
}

export interface TicketProvider {
  submitHandoff(input: TicketInput): Promise<TicketResult>;
}
