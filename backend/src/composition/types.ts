import type { KbItem } from '@loanslam/contracts';
import type { AppConfig } from '../config/env.js';
import type { Logger } from '../config/logger.js';
import type { ModelAdapter } from '../ports/model.port.js';
import type { RetrievalAdapter } from '../ports/retrieval.port.js';
import type { TicketAdapter } from '../ports/ticket.port.js';
import type { Repositories } from '../ports/repository.port.js';
import type { IChatService } from '../ports/chat.port.js';

// Re-export the HTTP-edge contracts so the transport layer can import the
// service contract and its transport-outcome type from one place.
export type { IChatService, RequestContext, TurnOutcome } from '../ports/chat.port.js';

/**
 * Everything the ChatService orchestrator needs, injected at composition time.
 * The ChatService constructor takes exactly this. Tests build it with fakes.
 */
export interface ChatServiceDeps {
  repos: Repositories;
  model: ModelAdapter;
  retrieval: RetrievalAdapter;
  ticket: TicketAdapter;
  kb: KbItem[];
  config: AppConfig;
  logger: Logger;
}

/**
 * Everything the HTTP app needs. The composition root builds the concrete
 * ChatService and hands it to `createApp`. Keeps server.ts as wiring only.
 */
export interface AppDeps {
  chatService: IChatService;
  config: AppConfig;
  logger: Logger;
}
