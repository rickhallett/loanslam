import type { RetrievalResult } from '@loanslam/contracts';

import type { ConversationState } from '@loanslam/contracts';

export interface RagInput {
  conversationRef: string;
  requestRef: string;
  message: string;
  state: ConversationState;
}

export interface RagProvider {
  retrieve(input: RagInput): Promise<RetrievalResult>;
}
