import {
  existsSync,
  mkdirSync,
  readFileSync,
  appendFileSync,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { resolve } from 'node:path';
import type { AuditEvent, TranscriptEntry } from '@loanslam/contracts';
import type { Session, ServerConversationState } from '../../domain/conversation.js';
import type {
  SessionStore,
  TranscriptStore,
  AuditStore,
  IdempotencyStore,
} from '../../ports/repository.port.js';
import type { Logger } from '../../config/logger.js';

/**
 * File-backed, in-memory persistence — the DEMO DEFAULT. Everything lives in
 * Maps for O(1) reads; durability comes from writing to JSON files under
 * `dataDir` so the audit trail is reviewable and survives a restart.
 *
 * Durability strategy (single-process POC):
 *  - sessions / idempotency: full snapshot on every write (small, mutable).
 *  - audit / transcripts:    APPEND-ONLY .jsonl (one JSON object per line) so
 *                            the regulated trail is never rewritten or dropped.
 * Writes are synchronous, which makes them "concurrent-safe-enough" for the
 * single-process demo: each store mutation completes before the next runs.
 */

const SESSIONS_FILE = 'sessions.json';
const IDEMPOTENCY_FILE = 'idempotency.json';
const AUDIT_FILE = 'audit.jsonl';
const TRANSCRIPTS_FILE = 'transcripts.jsonl';

/** Ensure the data directory exists; create it (recursively) when missing. */
function ensureDataDir(dataDir: string): string {
  const dir = resolve(dataDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Read a whole JSON file, returning `fallback` when absent or unreadable. */
function readJsonFile<T>(path: string, fallback: T, logger: Logger): T {
  if (!existsSync(path)) return fallback;
  try {
    const raw = readFileSync(path, 'utf-8');
    if (raw.trim() === '') return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, path }, 'file-store: failed to read JSON file, starting empty');
    return fallback;
  }
}

/**
 * Read an append-only .jsonl file, parsing one record per non-empty line. A
 * single corrupt line (e.g. a partial write before a crash) is skipped, not
 * fatal — the rest of the trail still loads.
 */
function readJsonl<T>(path: string, logger: Logger): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  const raw = readFileSync(path, 'utf-8');
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch (err) {
      logger.warn({ err, path }, 'file-store: skipping corrupt jsonl line');
    }
  }
  return out;
}

/** Append one record as a single JSON line (newline-terminated). */
function appendJsonl(path: string, record: unknown): void {
  appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf-8');
}

/**
 * Atomically snapshot a structure to a JSON file: write to a temp file, then
 * rename over the target (rename is atomic on POSIX). A crash mid-write leaves
 * the previous good file intact instead of a truncated, unparseable one that
 * would silently reset the store to empty on the next load. (Production
 * durability against power loss is the transactional SQL Server path.)
 */
function writeJsonFile(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmp, path);
}

// ── Session store ─────────────────────────────────────────────────────────────

export class FileSessionStore implements SessionStore {
  private readonly path: string;
  /** Keyed by secret session id. */
  private readonly byId = new Map<string, Session>();
  /** Index from non-secret conversationRef -> session id. */
  private readonly refToId = new Map<string, string>();

  constructor(dataDir: string, logger: Logger) {
    this.path = resolve(dataDir, SESSIONS_FILE);
    const loaded = readJsonFile<Session[]>(this.path, [], logger);
    for (const session of loaded) {
      this.byId.set(session.id, session);
      this.refToId.set(session.conversationRef, session.id);
    }
  }

  private snapshot(): void {
    writeJsonFile(this.path, [...this.byId.values()]);
  }

  async create(session: Session): Promise<Session> {
    this.byId.set(session.id, session);
    this.refToId.set(session.conversationRef, session.id);
    this.snapshot();
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    return this.byId.get(id) ?? null;
  }

  async findByConversationRef(ref: string): Promise<Session | null> {
    const id = this.refToId.get(ref);
    if (id === undefined) return null;
    return this.byId.get(id) ?? null;
  }

  async updateState(id: string, state: ServerConversationState): Promise<void> {
    const existing = this.byId.get(id);
    if (existing === undefined) return;
    existing.state = state;
    existing.updatedAt = new Date().toISOString();
    this.snapshot();
  }

  async appendHistory(id: string, message: Session['history'][number]): Promise<void> {
    const existing = this.byId.get(id);
    if (existing === undefined) return;
    existing.history.push(message);
    existing.updatedAt = new Date().toISOString();
    this.snapshot();
  }

  async reset(id: string, freshState: ServerConversationState): Promise<void> {
    const existing = this.byId.get(id);
    if (existing === undefined) return;
    existing.state = freshState;
    existing.history = [];
    existing.updatedAt = new Date().toISOString();
    this.snapshot();
  }
}

// ── Transcript store (append-only) ──────────────────────────────────────────────

export class FileTranscriptStore implements TranscriptStore {
  private readonly path: string;
  private readonly entries: TranscriptEntry[];

  constructor(dataDir: string, logger: Logger) {
    this.path = resolve(dataDir, TRANSCRIPTS_FILE);
    this.entries = readJsonl<TranscriptEntry>(this.path, logger);
  }

  async append(entry: TranscriptEntry): Promise<void> {
    this.entries.push(entry);
    appendJsonl(this.path, entry);
  }

  async listByConversation(conversationRef: string): Promise<TranscriptEntry[]> {
    return this.entries.filter((e) => e.conversationRef === conversationRef);
  }
}

// ── Audit store (append-only) ───────────────────────────────────────────────────

export class FileAuditStore implements AuditStore {
  private readonly path: string;
  private readonly events: AuditEvent[];

  constructor(dataDir: string, logger: Logger) {
    this.path = resolve(dataDir, AUDIT_FILE);
    this.events = readJsonl<AuditEvent>(this.path, logger);
  }

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
    appendJsonl(this.path, event);
  }

  async listByConversation(conversationRef: string): Promise<AuditEvent[]> {
    return this.events.filter((e) => e.conversationRef === conversationRef);
  }
}

// ── Idempotency store ───────────────────────────────────────────────────────────

export class FileIdempotencyStore implements IdempotencyStore {
  private readonly path: string;
  private readonly seenKeys: Set<string>;

  constructor(dataDir: string, logger: Logger) {
    this.path = resolve(dataDir, IDEMPOTENCY_FILE);
    const loaded = readJsonFile<string[]>(this.path, [], logger);
    this.seenKeys = new Set(loaded);
  }

  private key(sessionId: string, clientMessageId: string): string {
    return `${sessionId}:${clientMessageId}`;
  }

  private snapshot(): void {
    writeJsonFile(this.path, [...this.seenKeys]);
  }

  async seen(sessionId: string, clientMessageId: string): Promise<boolean> {
    const key = this.key(sessionId, clientMessageId);
    if (this.seenKeys.has(key)) return true;
    // Atomically record-on-first-sight: subsequent retries return true.
    this.seenKeys.add(key);
    this.snapshot();
    return false;
  }
}

export { ensureDataDir };
