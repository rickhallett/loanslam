import type { AuditEvent, TranscriptEntry } from '@loanslam/contracts';
import type { Session, ServerConversationState } from '../../domain/conversation.js';
import type {
  SessionStore,
  TranscriptStore,
  AuditStore,
  IdempotencyStore,
} from '../../ports/repository.port.js';

/**
 * Prisma / SQL Server persistence — the PRODUCTION TARGET.
 *
 * IMPORTANT: this path requires two things the demo does not:
 *   1. `npm run prisma:generate` (generates the typed `@prisma/client`), and
 *   2. a SQL Server `DATABASE_URL` (see backend/docker-compose.sqlserver.yml).
 *
 * To keep the repo compiling WITHOUT a generated client, the Prisma client is
 * loaded through a dynamic-import boundary and typed against the minimal
 * hand-written `PrismaLike` interface below. At runtime the real generated
 * client satisfies this shape; at compile time we never depend on generated
 * artefacts. The model field names mirror backend/prisma/schema.prisma.
 */

// ── Minimal local typing for the generated client (boundary only) ───────────────

interface ModelDelegate {
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  findUnique(args: {
    where: Record<string, unknown>;
  }): Promise<Record<string, unknown> | null>;
  findFirst(args: {
    where: Record<string, unknown>;
  }): Promise<Record<string, unknown> | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
  }): Promise<Record<string, unknown>[]>;
}

/** The slice of the generated PrismaClient this module touches. */
export interface PrismaLike {
  session: ModelDelegate;
  transcriptEntry: ModelDelegate;
  auditEvent: ModelDelegate;
  idempotency: ModelDelegate;
  $disconnect?: () => Promise<void>;
}

/**
 * Lazily construct the real PrismaClient via dynamic import so this file
 * compiles without `prisma generate` having been run. Typed loosely (`any`) at
 * the import boundary, then narrowed to `PrismaLike`.
 */
export async function loadPrismaClient(databaseUrl: string | undefined): Promise<PrismaLike> {
  const mod: any = await import('@prisma/client');
  const PrismaClient = mod.PrismaClient as new (opts?: unknown) => PrismaLike;
  return new PrismaClient(
    databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
  );
}

// ── Row <-> domain mapping helpers ──────────────────────────────────────────────

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v : '';
}

function toSession(row: Record<string, unknown>): Session {
  return {
    id: str(row, 'id'),
    conversationRef: str(row, 'conversationRef'),
    createdAt: asIso(row['createdAt']),
    updatedAt: asIso(row['updatedAt']),
    state: JSON.parse(str(row, 'stateJson') || '{}') as ServerConversationState,
    history: JSON.parse(str(row, 'historyJson') || '[]') as Session['history'],
    csrfToken: str(row, 'csrfToken'),
  };
}

function asIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return new Date().toISOString();
}

function toTranscript(row: Record<string, unknown>): TranscriptEntry {
  return {
    id: str(row, 'id'),
    conversationRef: str(row, 'conversationRef'),
    requestRef: str(row, 'requestRef'),
    direction: str(row, 'direction') as TranscriptEntry['direction'],
    author: str(row, 'author') as TranscriptEntry['author'],
    text: str(row, 'text'),
    replyMode: (row['replyMode'] as TranscriptEntry['replyMode']) ?? null,
    ts: asIso(row['ts']),
  };
}

function toAudit(row: Record<string, unknown>): AuditEvent {
  return {
    id: str(row, 'id'),
    conversationRef: str(row, 'conversationRef'),
    requestRef: str(row, 'requestRef'),
    type: str(row, 'type') as AuditEvent['type'],
    ts: asIso(row['ts']),
    policyVersion: str(row, 'policyVersion'),
    reasonCode: (row['reasonCode'] as AuditEvent['reasonCode']) ?? null,
    replyMode: (row['replyMode'] as AuditEvent['replyMode']) ?? null,
    groundingServingMode:
      (row['groundingServingMode'] as AuditEvent['groundingServingMode']) ?? null,
    payload: JSON.parse(str(row, 'payloadJson') || '{}') as AuditEvent['payload'],
  };
}

// ── Stores ──────────────────────────────────────────────────────────────────────

export class PrismaSessionStore implements SessionStore {
  constructor(private readonly db: PrismaLike) {}

  async create(session: Session): Promise<Session> {
    await this.db.session.create({
      data: {
        id: session.id,
        conversationRef: session.conversationRef,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        stateJson: JSON.stringify(session.state),
        historyJson: JSON.stringify(session.history),
        csrfToken: session.csrfToken,
      },
    });
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    const row = await this.db.session.findUnique({ where: { id } });
    return row ? toSession(row) : null;
  }

  async findByConversationRef(ref: string): Promise<Session | null> {
    const row = await this.db.session.findUnique({ where: { conversationRef: ref } });
    return row ? toSession(row) : null;
  }

  async updateState(id: string, state: ServerConversationState): Promise<void> {
    await this.db.session.update({
      where: { id },
      data: { stateJson: JSON.stringify(state), updatedAt: new Date() },
    });
  }

  async appendHistory(id: string, message: Session['history'][number]): Promise<void> {
    // Read-modify-write: history is stored as a JSON column on the session row.
    const row = await this.db.session.findUnique({ where: { id } });
    if (!row) return;
    const history = JSON.parse(str(row, 'historyJson') || '[]') as Session['history'];
    history.push(message);
    await this.db.session.update({
      where: { id },
      data: { historyJson: JSON.stringify(history), updatedAt: new Date() },
    });
  }

  async reset(id: string, freshState: ServerConversationState): Promise<void> {
    await this.db.session.update({
      where: { id },
      data: {
        stateJson: JSON.stringify(freshState),
        historyJson: JSON.stringify([]),
        updatedAt: new Date(),
      },
    });
  }
}

export class PrismaTranscriptStore implements TranscriptStore {
  constructor(private readonly db: PrismaLike) {}

  async append(entry: TranscriptEntry): Promise<void> {
    await this.db.transcriptEntry.create({
      data: {
        id: entry.id,
        conversationRef: entry.conversationRef,
        requestRef: entry.requestRef,
        direction: entry.direction,
        author: entry.author,
        text: entry.text,
        replyMode: entry.replyMode,
        ts: new Date(entry.ts),
      },
    });
  }

  async listByConversation(conversationRef: string): Promise<TranscriptEntry[]> {
    const rows = await this.db.transcriptEntry.findMany({
      where: { conversationRef },
      orderBy: { ts: 'asc' },
    });
    return rows.map(toTranscript);
  }
}

export class PrismaAuditStore implements AuditStore {
  constructor(private readonly db: PrismaLike) {}

  async append(event: AuditEvent): Promise<void> {
    await this.db.auditEvent.create({
      data: {
        id: event.id,
        conversationRef: event.conversationRef,
        requestRef: event.requestRef,
        type: event.type,
        ts: new Date(event.ts),
        policyVersion: event.policyVersion,
        reasonCode: event.reasonCode,
        replyMode: event.replyMode,
        groundingServingMode: event.groundingServingMode,
        payloadJson: JSON.stringify(event.payload),
      },
    });
  }

  async listByConversation(conversationRef: string): Promise<AuditEvent[]> {
    const rows = await this.db.auditEvent.findMany({
      where: { conversationRef },
      orderBy: { ts: 'asc' },
    });
    return rows.map(toAudit);
  }
}

export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: PrismaLike) {}

  async seen(sessionId: string, clientMessageId: string): Promise<boolean> {
    const existing = await this.db.idempotency.findUnique({
      where: { sessionId_clientMessageId: { sessionId, clientMessageId } },
    });
    if (existing) return true;
    await this.db.idempotency.create({ data: { sessionId, clientMessageId } });
    return false;
  }
}
