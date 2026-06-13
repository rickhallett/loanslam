import type { AuditEvent, TranscriptEntry } from '@loanslam/contracts';
import type { Session, ServerConversationState } from '../domain/conversation.js';

/**
 * Persistence seams. Two implementations live behind these: a file-backed
 * in-memory store (default; zero-friction local demo, audit survives restart)
 * and a Prisma/SQL Server store (production target). Tests swap fakes here.
 */

export interface SessionStore {
  create(session: Session): Promise<Session>;
  /** Look up by the secret session id (from the cookie). */
  findById(id: string): Promise<Session | null>;
  /** Look up by the non-secret conversation reference (support/debug). */
  findByConversationRef(ref: string): Promise<Session | null>;
  updateState(id: string, state: ServerConversationState): Promise<void>;
  appendHistory(id: string, message: Session['history'][number]): Promise<void>;
  /** Reset conversation: fresh state + cleared history, same session id. */
  reset(id: string, freshState: ServerConversationState): Promise<void>;
}

export interface TranscriptStore {
  append(entry: TranscriptEntry): Promise<void>;
  listByConversation(conversationRef: string): Promise<TranscriptEntry[]>;
}

export interface AuditStore {
  append(event: AuditEvent): Promise<void>;
  listByConversation(conversationRef: string): Promise<AuditEvent[]>;
}

export interface IdempotencyStore {
  /**
   * Returns true if (sessionId, clientMessageId) was already processed.
   * Records it atomically when not seen. De-dupes client retries (brief §7).
   */
  seen(sessionId: string, clientMessageId: string): Promise<boolean>;
}

/** Bundle handed to the ChatService at composition time. */
export interface Repositories {
  sessions: SessionStore;
  transcripts: TranscriptStore;
  audit: AuditStore;
  idempotency: IdempotencyStore;
}
