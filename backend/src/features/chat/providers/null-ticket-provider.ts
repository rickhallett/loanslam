import { randomUUID } from 'node:crypto';

import type { TicketResult } from '@loanslam/contracts';

import type { TicketInput, TicketProvider } from './ticket-provider.js';

export class NullTicketProvider implements TicketProvider {
  submitHandoff(input: TicketInput): Promise<TicketResult> {
    void input;

    return Promise.resolve({
      provider: 'null-ticket-provider',
      providerReference: `handoff_${randomUUID().replaceAll('-', '')}`,
      status: 'pending',
      reasonCode: 'local_handoff_pending',
    });
  }
}
