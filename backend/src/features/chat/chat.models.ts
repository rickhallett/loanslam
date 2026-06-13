import type { ChatMessageRole, ConversationState } from '@loanslam/contracts';

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type TranscriptDirection = 'inbound' | 'outbound';
export type TranscriptRole = ChatMessageRole | 'system';
export type TicketHandoffStatus = 'pending' | 'submitted' | 'failed';

export interface ChatSessionRecord {
  id: string;
  conversationRef: string;
  csrfTokenHash: string;
  state: ConversationState;
  structuredState: JsonObject;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionInput {
  csrfTokenHash: string;
}

export interface TranscriptEntryInput {
  sessionId: string;
  requestRef: string;
  direction: TranscriptDirection;
  role: TranscriptRole;
  content: string;
  metadata?: JsonObject;
}

export interface TranscriptEntryRecord {
  id: string;
  sessionId: string;
  requestRef: string;
  direction: TranscriptDirection;
  role: TranscriptRole;
  content: string;
  metadata: JsonObject;
  createdAt: Date;
}

export interface AuditEventInput {
  sessionId: string;
  requestRef: string;
  eventType: string;
  reasonCode?: string | null;
  payload?: JsonObject;
}

export interface AuditEventRecord {
  id: string;
  sessionId: string;
  requestRef: string;
  eventType: string;
  reasonCode: string | null;
  payload: JsonObject;
  createdAt: Date;
}

export interface ClientMessageRecord {
  id: string;
  sessionId: string;
  clientMessageId: string;
  requestRef: string;
  responsePayload: JsonObject | null;
  created: boolean;
  createdAt: Date;
  completedAt: Date | null;
}

export interface TicketHandoffInput {
  sessionId: string;
  requestRef: string;
  provider: string;
  providerReference: string;
  status: TicketHandoffStatus;
  payload?: JsonObject;
}

export interface TicketHandoffRecord {
  id: string;
  sessionId: string;
  requestRef: string;
  provider: string;
  providerReference: string;
  status: TicketHandoffStatus;
  payload: JsonObject;
  createdAt: Date;
}

export interface ChatRepository {
  createSession(input: CreateSessionInput): Promise<ChatSessionRecord>;
  getSessionById(sessionId: string): Promise<ChatSessionRecord | null>;
  getSessionByConversationRef(conversationRef: string): Promise<ChatSessionRecord | null>;
  rotateCsrf(sessionId: string, csrfTokenHash: string): Promise<ChatSessionRecord>;
  appendTranscript(entry: TranscriptEntryInput): Promise<TranscriptEntryRecord>;
  appendAudit(event: AuditEventInput): Promise<AuditEventRecord>;
  recordClientMessage(
    sessionId: string,
    clientMessageId: string,
    requestRef: string,
  ): Promise<ClientMessageRecord>;
  completeClientMessage(
    clientMessageRecordId: string,
    responsePayload: JsonObject,
  ): Promise<ClientMessageRecord>;
  hasRequestActivity(sessionId: string, requestRef: string): Promise<boolean>;
  updateSessionState(
    sessionId: string,
    state: ConversationState,
    structuredState: JsonObject,
  ): Promise<ChatSessionRecord>;
  recordTicketHandoff(ticket: TicketHandoffInput): Promise<TicketHandoffRecord>;
}
