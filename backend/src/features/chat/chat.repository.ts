import { randomUUID } from 'node:crypto';

import type { ConversationState } from '@loanslam/contracts';
import type { PrismaClient } from '@prisma/client';

import type {
  AuditEventInput,
  AuditEventRecord,
  ChatRepository,
  ChatSessionRecord,
  ClientMessageRecord,
  CreateSessionInput,
  JsonObject,
  JsonValue,
  TicketHandoffInput,
  TicketHandoffRecord,
  TicketHandoffStatus,
  TranscriptDirection,
  TranscriptEntryInput,
  TranscriptEntryRecord,
  TranscriptRole,
} from './chat.models.js';

type ChatSessionRow = {
  id: string;
  conversationRef: string;
  csrfTokenHash: string;
  state: string;
  structuredState: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type TranscriptEntryRow = {
  id: string;
  sessionId: string;
  requestRef: string;
  direction: string;
  role: string;
  content: string;
  metadata: unknown;
  createdAt: Date;
};

type AuditEventRow = {
  id: string;
  sessionId: string;
  requestRef: string;
  eventType: string;
  reasonCode: string | null;
  payload: unknown;
  createdAt: Date;
};

type ClientMessageRow = {
  id: string;
  sessionId: string;
  clientMessageId: string;
  requestRef: string;
  responsePayload: unknown;
  createdAt: Date;
  completedAt: Date | null;
};

type TicketHandoffRow = {
  id: string;
  sessionId: string;
  requestRef: string;
  provider: string;
  providerReference: string;
  status: string;
  payload: unknown;
  createdAt: Date;
};

export class ChatRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatRepositoryError';
  }
}

export class PrismaChatRepository implements ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createSession(input: CreateSessionInput): Promise<ChatSessionRecord> {
    const session = await this.prisma.chatSession.create({
      data: {
        conversationRef: createConversationRef(),
        csrfTokenHash: input.csrfTokenHash,
        state: 'active',
        structuredState: serializeJson({}),
      },
    });

    return mapSession(session);
  }

  async getSessionById(sessionId: string): Promise<ChatSessionRecord | null> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    return session ? mapSession(session) : null;
  }

  async getSessionByConversationRef(conversationRef: string): Promise<ChatSessionRecord | null> {
    const session = await this.prisma.chatSession.findUnique({
      where: { conversationRef },
    });

    return session ? mapSession(session) : null;
  }

  async rotateCsrf(sessionId: string, csrfTokenHash: string): Promise<ChatSessionRecord> {
    const session = await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { csrfTokenHash },
    });

    return mapSession(session);
  }

  async appendTranscript(entry: TranscriptEntryInput): Promise<TranscriptEntryRecord> {
    const transcript = await this.prisma.transcriptEntry.create({
      data: {
        sessionId: entry.sessionId,
        requestRef: entry.requestRef,
        direction: entry.direction,
        role: entry.role,
        content: entry.content,
        metadata: serializeJson(entry.metadata ?? {}),
      },
    });

    return mapTranscript(transcript);
  }

  async appendAudit(event: AuditEventInput): Promise<AuditEventRecord> {
    const audit = await this.prisma.auditEvent.create({
      data: {
        sessionId: event.sessionId,
        requestRef: event.requestRef,
        eventType: event.eventType,
        reasonCode: event.reasonCode ?? null,
        payload: serializeJson(event.payload ?? {}),
      },
    });

    return mapAudit(audit);
  }

  async recordClientMessage(
    sessionId: string,
    clientMessageId: string,
    requestRef: string,
  ): Promise<ClientMessageRecord> {
    try {
      const clientMessage = await this.prisma.clientMessage.create({
        data: {
          sessionId,
          clientMessageId,
          requestRef,
          responsePayload: null,
          completedAt: null,
        },
      });

      return mapClientMessage(clientMessage, true);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.prisma.clientMessage.findUnique({
        where: {
          sessionId_clientMessageId: {
            sessionId,
            clientMessageId,
          },
        },
      });

      if (!existing) {
        throw new ChatRepositoryError('Client message unique conflict could not be reloaded');
      }

      return mapClientMessage(existing, false);
    }
  }

  async completeClientMessage(
    clientMessageRecordId: string,
    responsePayload: JsonObject,
  ): Promise<ClientMessageRecord> {
    const clientMessage = await this.prisma.clientMessage.update({
      where: { id: clientMessageRecordId },
      data: {
        responsePayload: serializeJson(responsePayload),
        completedAt: new Date(),
      },
    });

    return mapClientMessage(clientMessage, false);
  }

  async hasRequestActivity(sessionId: string, requestRef: string): Promise<boolean> {
    const [transcriptCount, auditCount, ticketCount] = await this.prisma.$transaction([
      this.prisma.transcriptEntry.count({ where: { sessionId, requestRef } }),
      this.prisma.auditEvent.count({ where: { sessionId, requestRef } }),
      this.prisma.ticketHandoff.count({ where: { sessionId, requestRef } }),
    ]);

    return transcriptCount + auditCount + ticketCount > 0;
  }

  async updateSessionState(
    sessionId: string,
    state: ConversationState,
    structuredState: JsonObject,
  ): Promise<ChatSessionRecord> {
    const session = await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        state,
        structuredState: serializeJson(structuredState),
      },
    });

    return mapSession(session);
  }

  async recordTicketHandoff(ticket: TicketHandoffInput): Promise<TicketHandoffRecord> {
    const handoff = await this.prisma.ticketHandoff.create({
      data: {
        sessionId: ticket.sessionId,
        requestRef: ticket.requestRef,
        provider: ticket.provider,
        providerReference: ticket.providerReference,
        status: ticket.status,
        payload: serializeJson(ticket.payload ?? {}),
      },
    });

    return mapTicketHandoff(handoff);
  }
}

export class InMemoryChatRepository implements ChatRepository {
  private readonly sessions = new Map<string, ChatSessionRecord>();
  private readonly sessionIdsByConversationRef = new Map<string, string>();
  private readonly clientMessagesBySessionAndClientId = new Map<string, ClientMessageRecord>();
  private readonly clientMessageKeysById = new Map<string, string>();
  readonly transcriptEntries: TranscriptEntryRecord[] = [];
  readonly auditEvents: AuditEventRecord[] = [];
  readonly ticketHandoffs: TicketHandoffRecord[] = [];

  createSession(input: CreateSessionInput): Promise<ChatSessionRecord> {
    const now = new Date();
    const session: ChatSessionRecord = {
      id: createRecordId('session'),
      conversationRef: createConversationRef(),
      csrfTokenHash: input.csrfTokenHash,
      state: 'active',
      structuredState: {},
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, cloneSession(session));
    this.sessionIdsByConversationRef.set(session.conversationRef, session.id);

    return Promise.resolve(cloneSession(session));
  }

  getSessionById(sessionId: string): Promise<ChatSessionRecord | null> {
    const session = this.sessions.get(sessionId);
    return Promise.resolve(session ? cloneSession(session) : null);
  }

  getSessionByConversationRef(conversationRef: string): Promise<ChatSessionRecord | null> {
    const sessionId = this.sessionIdsByConversationRef.get(conversationRef);
    if (!sessionId) {
      return Promise.resolve(null);
    }

    return this.getSessionById(sessionId);
  }

  rotateCsrf(sessionId: string, csrfTokenHash: string): Promise<ChatSessionRecord> {
    const session = this.requireSession(sessionId);
    const updated = {
      ...session,
      csrfTokenHash,
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, cloneSession(updated));
    return Promise.resolve(cloneSession(updated));
  }

  appendTranscript(entry: TranscriptEntryInput): Promise<TranscriptEntryRecord> {
    this.requireSession(entry.sessionId);

    const transcript: TranscriptEntryRecord = {
      id: createRecordId('transcript'),
      sessionId: entry.sessionId,
      requestRef: entry.requestRef,
      direction: entry.direction,
      role: entry.role,
      content: entry.content,
      metadata: cloneJsonObject(entry.metadata ?? {}),
      createdAt: new Date(),
    };

    this.transcriptEntries.push(cloneTranscript(transcript));
    return Promise.resolve(cloneTranscript(transcript));
  }

  appendAudit(event: AuditEventInput): Promise<AuditEventRecord> {
    this.requireSession(event.sessionId);

    const audit: AuditEventRecord = {
      id: createRecordId('audit'),
      sessionId: event.sessionId,
      requestRef: event.requestRef,
      eventType: event.eventType,
      reasonCode: event.reasonCode ?? null,
      payload: cloneJsonObject(event.payload ?? {}),
      createdAt: new Date(),
    };

    this.auditEvents.push(cloneAudit(audit));
    return Promise.resolve(cloneAudit(audit));
  }

  recordClientMessage(
    sessionId: string,
    clientMessageId: string,
    requestRef: string,
  ): Promise<ClientMessageRecord> {
    this.requireSession(sessionId);

    const key = createClientMessageKey(sessionId, clientMessageId);
    const existing = this.clientMessagesBySessionAndClientId.get(key);
    if (existing) {
      return Promise.resolve(cloneClientMessage({ ...existing, created: false }));
    }

    const clientMessage: ClientMessageRecord = {
      id: createRecordId('client_message'),
      sessionId,
      clientMessageId,
      requestRef,
      responsePayload: null,
      created: true,
      createdAt: new Date(),
      completedAt: null,
    };

    this.clientMessagesBySessionAndClientId.set(key, cloneClientMessage(clientMessage));
    this.clientMessageKeysById.set(clientMessage.id, key);
    return Promise.resolve(cloneClientMessage(clientMessage));
  }

  completeClientMessage(
    clientMessageRecordId: string,
    responsePayload: JsonObject,
  ): Promise<ClientMessageRecord> {
    const key = this.clientMessageKeysById.get(clientMessageRecordId);
    if (!key) {
      throw new ChatRepositoryError(`Client message not found: ${clientMessageRecordId}`);
    }

    const existing = this.clientMessagesBySessionAndClientId.get(key);
    if (!existing) {
      throw new ChatRepositoryError(`Client message not found: ${clientMessageRecordId}`);
    }

    const updated: ClientMessageRecord = {
      ...existing,
      responsePayload: cloneJsonObject(responsePayload),
      created: false,
      completedAt: new Date(),
    };

    this.clientMessagesBySessionAndClientId.set(key, cloneClientMessage(updated));
    return Promise.resolve(cloneClientMessage(updated));
  }

  hasRequestActivity(sessionId: string, requestRef: string): Promise<boolean> {
    const hasTranscript = this.transcriptEntries.some(
      (entry) => entry.sessionId === sessionId && entry.requestRef === requestRef,
    );
    const hasAudit = this.auditEvents.some(
      (event) => event.sessionId === sessionId && event.requestRef === requestRef,
    );
    const hasTicket = this.ticketHandoffs.some(
      (ticket) => ticket.sessionId === sessionId && ticket.requestRef === requestRef,
    );

    return Promise.resolve(hasTranscript || hasAudit || hasTicket);
  }

  updateSessionState(
    sessionId: string,
    state: ConversationState,
    structuredState: JsonObject,
  ): Promise<ChatSessionRecord> {
    const session = this.requireSession(sessionId);
    const updated = {
      ...session,
      state,
      structuredState: cloneJsonObject(structuredState),
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, cloneSession(updated));
    return Promise.resolve(cloneSession(updated));
  }

  recordTicketHandoff(ticket: TicketHandoffInput): Promise<TicketHandoffRecord> {
    this.requireSession(ticket.sessionId);

    const handoff: TicketHandoffRecord = {
      id: createRecordId('ticket_handoff'),
      sessionId: ticket.sessionId,
      requestRef: ticket.requestRef,
      provider: ticket.provider,
      providerReference: ticket.providerReference,
      status: ticket.status,
      payload: cloneJsonObject(ticket.payload ?? {}),
      createdAt: new Date(),
    };

    this.ticketHandoffs.push(cloneTicketHandoff(handoff));
    return Promise.resolve(cloneTicketHandoff(handoff));
  }

  private requireSession(sessionId: string): ChatSessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new ChatRepositoryError(`Chat session not found: ${sessionId}`);
    }

    return cloneSession(session);
  }
}

function createConversationRef(): string {
  return `conv_${randomUUID().replaceAll('-', '')}`;
}

function createRecordId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

function createClientMessageKey(sessionId: string, clientMessageId: string): string {
  return `${sessionId}:${clientMessageId}`;
}

function serializeJson(value: JsonValue): string {
  return JSON.stringify(value);
}

function mapSession(session: ChatSessionRow): ChatSessionRecord {
  return {
    id: session.id,
    conversationRef: session.conversationRef,
    csrfTokenHash: session.csrfTokenHash,
    state: session.state as ConversationState,
    structuredState: toJsonObject(session.structuredState),
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
  };
}

function mapTranscript(transcript: TranscriptEntryRow): TranscriptEntryRecord {
  return {
    id: transcript.id,
    sessionId: transcript.sessionId,
    requestRef: transcript.requestRef,
    direction: transcript.direction as TranscriptDirection,
    role: transcript.role as TranscriptRole,
    content: transcript.content,
    metadata: toJsonObject(transcript.metadata),
    createdAt: new Date(transcript.createdAt),
  };
}

function mapAudit(audit: AuditEventRow): AuditEventRecord {
  return {
    id: audit.id,
    sessionId: audit.sessionId,
    requestRef: audit.requestRef,
    eventType: audit.eventType,
    reasonCode: audit.reasonCode,
    payload: toJsonObject(audit.payload),
    createdAt: new Date(audit.createdAt),
  };
}

function mapClientMessage(clientMessage: ClientMessageRow, created: boolean): ClientMessageRecord {
  return {
    id: clientMessage.id,
    sessionId: clientMessage.sessionId,
    clientMessageId: clientMessage.clientMessageId,
    requestRef: clientMessage.requestRef,
    responsePayload:
      clientMessage.responsePayload === null ? null : toJsonObject(clientMessage.responsePayload),
    created,
    createdAt: new Date(clientMessage.createdAt),
    completedAt: clientMessage.completedAt ? new Date(clientMessage.completedAt) : null,
  };
}

function mapTicketHandoff(ticket: TicketHandoffRow): TicketHandoffRecord {
  return {
    id: ticket.id,
    sessionId: ticket.sessionId,
    requestRef: ticket.requestRef,
    provider: ticket.provider,
    providerReference: ticket.providerReference,
    status: ticket.status as TicketHandoffStatus,
    payload: toJsonObject(ticket.payload),
    createdAt: new Date(ticket.createdAt),
  };
}

function toJsonObject(value: unknown): JsonObject {
  return parseJsonObjectForRepository(value, 'repository JSON column');
}

export function parseJsonObjectForRepository(value: unknown, fieldName: string): JsonObject {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return parseJsonObjectForRepository(parsed, fieldName);
    } catch {
      throw new ChatRepositoryError(`${fieldName} contains invalid JSON`);
    }
  }

  if (!isJsonObject(value)) {
    throw new ChatRepositoryError(`${fieldName} must contain a JSON object`);
  }

  return cloneJsonObject(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneSession(session: ChatSessionRecord): ChatSessionRecord {
  return {
    ...session,
    structuredState: cloneJsonObject(session.structuredState),
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
  };
}

function cloneClientMessage(clientMessage: ClientMessageRecord): ClientMessageRecord {
  return {
    ...clientMessage,
    responsePayload: clientMessage.responsePayload
      ? cloneJsonObject(clientMessage.responsePayload)
      : null,
    createdAt: new Date(clientMessage.createdAt),
    completedAt: clientMessage.completedAt ? new Date(clientMessage.completedAt) : null,
  };
}

function cloneTranscript(transcript: TranscriptEntryRecord): TranscriptEntryRecord {
  return {
    ...transcript,
    metadata: cloneJsonObject(transcript.metadata),
    createdAt: new Date(transcript.createdAt),
  };
}

function cloneAudit(audit: AuditEventRecord): AuditEventRecord {
  return {
    ...audit,
    payload: cloneJsonObject(audit.payload),
    createdAt: new Date(audit.createdAt),
  };
}

function cloneTicketHandoff(ticketHandoff: TicketHandoffRecord): TicketHandoffRecord {
  return {
    ...ticketHandoff,
    payload: cloneJsonObject(ticketHandoff.payload),
    createdAt: new Date(ticketHandoff.createdAt),
  };
}

function cloneJsonObject<T extends JsonObject>(value: T): T {
  return structuredClone(value);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
