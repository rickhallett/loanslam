import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import type { AuditEvent, TranscriptEntry } from '@loanslam/contracts';
import type { AppConfig } from '../../config/env.js';
import type { Session } from '../../domain/conversation.js';
import { initialConversationState } from '../../domain/conversation.js';
import { createMemoryRepositories } from '../memory/index.js';

// A no-op logger satisfying the structurally-used subset of the pino Logger.
// Cast to the real type because the stores only ever call .info/.warn here.
const fakeLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as any;

function makeConfig(dataDir: string): AppConfig {
  return {
    port: 8787,
    nodeEnv: 'test',
    logLevel: 'silent',
    widgetOrigin: 'http://localhost:5173',
    ai: { enabled: false, apiKey: '', baseUrl: '', model: 'test' },
    groundingThreshold: 0.42,
    persistence: 'memory',
    dataDir,
    databaseUrl: undefined,
    ticket: { webhookUrl: undefined, webhookToken: undefined },
    sessionSecret: 'test-secret',
  };
}

function makeSession(id: string, ref: string): Session {
  const now = new Date().toISOString();
  return {
    id,
    conversationRef: ref,
    createdAt: now,
    updatedAt: now,
    state: initialConversationState(),
    history: [],
    csrfToken: `csrf-${id}`,
  };
}

function makeTranscript(ref: string, n: number): TranscriptEntry {
  return {
    id: `txt_${n}`,
    conversationRef: ref,
    requestRef: `req_${n}`,
    direction: n % 2 === 0 ? 'inbound' : 'outbound',
    author: n % 2 === 0 ? 'customer' : 'bot',
    text: `message ${n}`,
    replyMode: null,
    ts: new Date().toISOString(),
  };
}

function makeAudit(ref: string, n: number): AuditEvent {
  return {
    id: `evt_${n}`,
    conversationRef: ref,
    requestRef: `req_${n}`,
    type: 'message_inbound',
    ts: new Date().toISOString(),
    policyVersion: 'poc-test',
    reasonCode: null,
    replyMode: null,
    groundingServingMode: null,
    payload: { n },
  };
}

describe('file-backed memory persistence', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'loanslam-persist-'));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('creates the data dir if missing', () => {
    const nested = join(dataDir, 'does', 'not', 'exist', 'yet');
    expect(existsSync(nested)).toBe(false);
    createMemoryRepositories(makeConfig(nested), fakeLogger);
    expect(existsSync(nested)).toBe(true);
  });

  describe('SessionStore round-trip', () => {
    it('creates and finds by id and by conversationRef', async () => {
      const repos = createMemoryRepositories(makeConfig(dataDir), fakeLogger);
      const session = makeSession('sid-1', 'conv_abc');
      const created = await repos.sessions.create(session);
      expect(created).toEqual(session);

      expect(await repos.sessions.findById('sid-1')).toEqual(session);
      expect(await repos.sessions.findByConversationRef('conv_abc')).toEqual(session);
      expect(await repos.sessions.findById('nope')).toBeNull();
      expect(await repos.sessions.findByConversationRef('nope')).toBeNull();
    });

    it('updateState replaces state and bumps updatedAt', async () => {
      const repos = createMemoryRepositories(makeConfig(dataDir), fakeLogger);
      await repos.sessions.create(makeSession('sid-1', 'conv_abc'));

      const next = initialConversationState();
      next.phase = 'collecting_info';
      next.customerGoal = 'borrow money';
      await repos.sessions.updateState('sid-1', next);

      const found = await repos.sessions.findById('sid-1');
      expect(found?.state.phase).toBe('collecting_info');
      expect(found?.state.customerGoal).toBe('borrow money');
    });

    it('appendHistory accumulates messages', async () => {
      const repos = createMemoryRepositories(makeConfig(dataDir), fakeLogger);
      await repos.sessions.create(makeSession('sid-1', 'conv_abc'));

      await repos.sessions.appendHistory('sid-1', {
        role: 'user',
        content: 'hi',
        ts: new Date().toISOString(),
      });
      await repos.sessions.appendHistory('sid-1', {
        role: 'assistant',
        content: 'hello',
        ts: new Date().toISOString(),
      });

      const found = await repos.sessions.findById('sid-1');
      expect(found?.history).toHaveLength(2);
      expect(found?.history[0]?.content).toBe('hi');
      expect(found?.history[1]?.role).toBe('assistant');
    });

    it('reset clears history and installs fresh state', async () => {
      const repos = createMemoryRepositories(makeConfig(dataDir), fakeLogger);
      await repos.sessions.create(makeSession('sid-1', 'conv_abc'));
      await repos.sessions.appendHistory('sid-1', {
        role: 'user',
        content: 'hi',
        ts: new Date().toISOString(),
      });

      await repos.sessions.reset('sid-1', initialConversationState());
      const found = await repos.sessions.findById('sid-1');
      expect(found?.history).toHaveLength(0);
      expect(found?.state.phase).toBe('anonymous_active');
      // Same session id is preserved.
      expect(found?.id).toBe('sid-1');
    });
  });

  describe('TranscriptStore round-trip', () => {
    it('appends and lists by conversation', async () => {
      const repos = createMemoryRepositories(makeConfig(dataDir), fakeLogger);
      await repos.transcripts.append(makeTranscript('conv_a', 0));
      await repos.transcripts.append(makeTranscript('conv_a', 1));
      await repos.transcripts.append(makeTranscript('conv_b', 2));

      const a = await repos.transcripts.listByConversation('conv_a');
      const b = await repos.transcripts.listByConversation('conv_b');
      expect(a).toHaveLength(2);
      expect(b).toHaveLength(1);
      expect(a.map((e) => e.id)).toEqual(['txt_0', 'txt_1']);
    });
  });

  describe('AuditStore round-trip', () => {
    it('appends and lists by conversation', async () => {
      const repos = createMemoryRepositories(makeConfig(dataDir), fakeLogger);
      await repos.audit.append(makeAudit('conv_a', 0));
      await repos.audit.append(makeAudit('conv_a', 1));
      await repos.audit.append(makeAudit('conv_b', 2));

      const a = await repos.audit.listByConversation('conv_a');
      expect(a).toHaveLength(2);
      expect(await repos.audit.listByConversation('conv_b')).toHaveLength(1);
      expect(a[0]?.payload).toEqual({ n: 0 });
    });
  });

  describe('IdempotencyStore', () => {
    it('seen() returns false then true for the same key', async () => {
      const repos = createMemoryRepositories(makeConfig(dataDir), fakeLogger);
      expect(await repos.idempotency.seen('sid-1', 'cmid-1')).toBe(false);
      expect(await repos.idempotency.seen('sid-1', 'cmid-1')).toBe(true);
      // Different key is independent.
      expect(await repos.idempotency.seen('sid-1', 'cmid-2')).toBe(false);
      expect(await repos.idempotency.seen('sid-2', 'cmid-1')).toBe(false);
    });
  });

  describe('durability: survives restart', () => {
    it('reloads sessions, transcripts, audit, and idempotency from disk', async () => {
      const config = makeConfig(dataDir);
      const first = createMemoryRepositories(config, fakeLogger);

      const session = makeSession('sid-1', 'conv_abc');
      await first.sessions.create(session);
      await first.sessions.appendHistory('sid-1', {
        role: 'user',
        content: 'persist me',
        ts: new Date().toISOString(),
      });
      await first.transcripts.append(makeTranscript('conv_abc', 0));
      await first.transcripts.append(makeTranscript('conv_abc', 1));
      await first.audit.append(makeAudit('conv_abc', 0));
      expect(await first.idempotency.seen('sid-1', 'cmid-1')).toBe(false);

      // Construct a SECOND instance pointing at the SAME dir.
      const second = createMemoryRepositories(config, fakeLogger);

      const reloadedSession = await second.sessions.findById('sid-1');
      expect(reloadedSession).not.toBeNull();
      expect(reloadedSession?.conversationRef).toBe('conv_abc');
      expect(reloadedSession?.history).toHaveLength(1);
      expect(reloadedSession?.history[0]?.content).toBe('persist me');
      // Lookup by ref must also work after reload (index rebuilt on load).
      expect(await second.sessions.findByConversationRef('conv_abc')).not.toBeNull();

      const reloadedTranscripts = await second.transcripts.listByConversation('conv_abc');
      expect(reloadedTranscripts).toHaveLength(2);

      const reloadedAudit = await second.audit.listByConversation('conv_abc');
      expect(reloadedAudit).toHaveLength(1);

      // Idempotency key recorded by the first instance is still "seen".
      expect(await second.idempotency.seen('sid-1', 'cmid-1')).toBe(true);
    });

    it('audit and transcripts are append-only jsonl (one object per line)', async () => {
      const repos = createMemoryRepositories(makeConfig(dataDir), fakeLogger);
      await repos.audit.append(makeAudit('conv_a', 0));
      await repos.audit.append(makeAudit('conv_a', 1));
      await repos.transcripts.append(makeTranscript('conv_a', 0));

      const auditPath = resolve(dataDir, 'audit.jsonl');
      const transcriptsPath = resolve(dataDir, 'transcripts.jsonl');
      expect(existsSync(auditPath)).toBe(true);
      expect(existsSync(transcriptsPath)).toBe(true);

      const auditLines = readFileSync(auditPath, 'utf-8').trim().split('\n');
      expect(auditLines).toHaveLength(2);
      // Each line is a standalone JSON object.
      for (const line of auditLines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    it('tolerates a corrupt jsonl line on reload', async () => {
      const config = makeConfig(dataDir);
      const first = createMemoryRepositories(config, fakeLogger);
      await first.audit.append(makeAudit('conv_a', 0));

      // Corrupt the file by hand: a junk line plus a valid one.
      const auditPath = resolve(dataDir, 'audit.jsonl');
      const good = JSON.stringify(makeAudit('conv_a', 1));
      // Append a broken line and a good line manually.
      const fs = await import('node:fs');
      fs.appendFileSync(auditPath, 'not-json{{{\n', 'utf-8');
      fs.appendFileSync(auditPath, `${good}\n`, 'utf-8');

      const second = createMemoryRepositories(config, fakeLogger);
      const events = await second.audit.listByConversation('conv_a');
      // The good original + the good appended line load; junk is skipped.
      expect(events).toHaveLength(2);
    });
  });
});
