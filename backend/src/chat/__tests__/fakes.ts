import type {
  AuditEvent,
  GroundingSignal,
  RetrievalHit,
  TranscriptEntry,
} from '@loanslam/contracts';
import type {
  ClassificationInput,
  ClassificationResult,
  ModelAdapter,
  PhraseInput,
  VulnerabilityInput,
  VulnerabilityVerdict,
} from '../../ports/model.port.js';
import type { RetrievalAdapter } from '../../ports/retrieval.port.js';
import type { TicketAdapter, TicketRequest, TicketResult } from '../../ports/ticket.port.js';
import type {
  AuditStore,
  IdempotencyStore,
  Repositories,
  SessionStore,
  TranscriptStore,
} from '../../ports/repository.port.js';
import type { ServerConversationState, Session } from '../../domain/conversation.js';
import type { AppConfig } from '../../config/env.js';

// ── Model fake ────────────────────────────────────────────────────────────────

export interface FakeModelOptions {
  vulnerability?: VulnerabilityVerdict;
  classification?: ClassificationResult;
  /** null simulates the model declining to phrase safely. */
  phrase?: string | null;
}

export class FakeModel implements ModelAdapter {
  detectCalls = 0;
  classifyCalls = 0;
  phraseCalls = 0;

  constructor(private readonly opts: FakeModelOptions = {}) {}

  async detectVulnerability(_input: VulnerabilityInput): Promise<VulnerabilityVerdict> {
    this.detectCalls += 1;
    return (
      this.opts.vulnerability ?? {
        vulnerable: false,
        category: null,
        confidence: 0.0,
        source: 'deterministic',
      }
    );
  }

  async classify(_input: ClassificationInput): Promise<ClassificationResult> {
    this.classifyCalls += 1;
    return (
      this.opts.classification ?? {
        action: 'answer',
        customerGoal: 'general question',
        confidence: 0.9,
        source: 'deterministic',
      }
    );
  }

  async phraseAnswer(input: PhraseInput): Promise<string | null> {
    this.phraseCalls += 1;
    if (this.opts.phrase === null) return null;
    return this.opts.phrase ?? `Phrased: ${input.groundedAnswerText}`;
  }
}

// ── Retrieval fake ──────────────────────────────────────────────────────────

export function hit(partial: Partial<RetrievalHit> & { itemId: string }): RetrievalHit {
  return {
    itemId: partial.itemId,
    question: partial.question ?? 'q',
    servingMode: partial.servingMode ?? 'answer',
    score: partial.score ?? 0.9,
    answerText: partial.answerText ?? 'Approved grounded answer text.',
    links: partial.links ?? [],
    routeReason: partial.routeReason ?? null,
  };
}

export function grounding(hits: RetrievalHit[], grounded: boolean): GroundingSignal {
  const top = hits[0];
  return {
    grounded,
    topScore: top?.score ?? 0,
    topServingMode: top?.servingMode ?? null,
    hits,
  };
}

export class FakeRetrieval implements RetrievalAdapter {
  constructor(private readonly signal: GroundingSignal) {}
  async retrieve(): Promise<GroundingSignal> {
    return this.signal;
  }
}

// ── Ticket fake ─────────────────────────────────────────────────────────────

export class FakeTicket implements TicketAdapter {
  tickets: TicketRequest[] = [];
  async createTicket(req: TicketRequest): Promise<TicketResult> {
    this.tickets.push(req);
    return { ticketRef: `tkt_test_${this.tickets.length}`, status: 'recorded' };
  }
}

// ── Repository fakes (in-memory Maps) ─────────────────────────────────────────

export class FakeSessionStore implements SessionStore {
  sessions = new Map<string, Session>();

  async create(session: Session): Promise<Session> {
    // Persist a copy so the service's in-memory working object is not the same
    // array reference we store (mirrors a real DB-backed store).
    this.sessions.set(session.id, this.clone(session));
    return session;
  }
  async findById(id: string): Promise<Session | null> {
    const s = this.sessions.get(id);
    return s ? this.clone(s) : null;
  }
  private clone(s: Session): Session {
    return {
      ...s,
      state: { ...s.state, collected: { ...s.state.collected } },
      history: s.history.map((m) => ({ ...m })),
    };
  }
  async findByConversationRef(ref: string): Promise<Session | null> {
    for (const s of this.sessions.values()) if (s.conversationRef === ref) return s;
    return null;
  }
  async updateState(id: string, state: ServerConversationState): Promise<void> {
    const s = this.sessions.get(id);
    if (s) s.state = state;
  }
  async appendHistory(id: string, message: Session['history'][number]): Promise<void> {
    const s = this.sessions.get(id);
    if (s) s.history.push(message);
  }
  async reset(id: string, freshState: ServerConversationState): Promise<void> {
    const s = this.sessions.get(id);
    if (s) {
      s.state = freshState;
      s.history = [];
    }
  }
}

export class FakeTranscriptStore implements TranscriptStore {
  entries: TranscriptEntry[] = [];
  async append(entry: TranscriptEntry): Promise<void> {
    this.entries.push(entry);
  }
  async listByConversation(conversationRef: string): Promise<TranscriptEntry[]> {
    return this.entries.filter((e) => e.conversationRef === conversationRef);
  }
}

export class FakeAuditStore implements AuditStore {
  events: AuditEvent[] = [];
  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
  async listByConversation(conversationRef: string): Promise<AuditEvent[]> {
    return this.events.filter((e) => e.conversationRef === conversationRef);
  }
  types(): string[] {
    return this.events.map((e) => e.type);
  }
}

export class FakeIdempotencyStore implements IdempotencyStore {
  private keys = new Set<string>();
  async seen(sessionId: string, clientMessageId: string): Promise<boolean> {
    const key = `${sessionId}::${clientMessageId}`;
    if (this.keys.has(key)) return true;
    this.keys.add(key);
    return false;
  }
}

export interface FakeRepos extends Repositories {
  sessions: FakeSessionStore;
  transcripts: FakeTranscriptStore;
  audit: FakeAuditStore;
  idempotency: FakeIdempotencyStore;
}

export function makeRepos(): FakeRepos {
  return {
    sessions: new FakeSessionStore(),
    transcripts: new FakeTranscriptStore(),
    audit: new FakeAuditStore(),
    idempotency: new FakeIdempotencyStore(),
  };
}

// ── Config / logger fakes ─────────────────────────────────────────────────────

export function fakeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 8787,
    nodeEnv: 'test',
    logLevel: 'silent',
    widgetOrigin: 'http://localhost:5173',
    ai: { enabled: false, apiKey: '', baseUrl: '', model: 'test' },
    groundingThreshold: 0.42,
    persistence: 'memory',
    dataDir: './.data',
    databaseUrl: undefined,
    ticket: { webhookUrl: undefined, webhookToken: undefined },
    sessionSecret: 'test',
    ...overrides,
  };
}

// Structural stand-in for the pino logger; the ChatService never logs in tests.
const noop = (): undefined => undefined;
const loggerShim: Record<string, unknown> = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
};
loggerShim['child'] = (): unknown => loggerShim;
export const noopLogger = loggerShim as unknown as import('../../config/logger.js').Logger;
