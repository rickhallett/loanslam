import { describe, expect, it } from 'vitest';
import type { GroundingSignal } from '@loanslam/contracts';
import type { RetrievalAdapter } from '../../ports/retrieval.port.js';
import type { ChatServiceDeps } from '../../composition/types.js';
import { ChatService } from '../services/chat.service.js';
import {
  FakeModel,
  FakeRetrieval,
  FakeTicket,
  fakeConfig,
  grounding,
  hit,
  makeRepos,
  noopLogger,
  type FakeRepos,
} from './fakes.js';

const ctx = (n: number) => ({ requestRef: `req_${n}` });

function build(over: Partial<ChatServiceDeps> = {}): { svc: ChatService; repos: FakeRepos } {
  const repos = (over.repos as FakeRepos) ?? makeRepos();
  const svc = new ChatService({
    repos,
    model: over.model ?? new FakeModel(),
    retrieval: over.retrieval ?? new FakeRetrieval(grounding([], false)),
    ticket: over.ticket ?? new FakeTicket(),
    kb: [],
    config: over.config ?? fakeConfig(),
    logger: noopLogger,
  });
  return { svc, repos };
}

async function newSession(svc: ChatService): Promise<string> {
  const created = await svc.createSession({}, ctx(0));
  return created.setSessionId!;
}

describe('pipeline resilience + audit completeness (review findings #3,#4,#6,#12,#13,#17)', () => {
  it('records the intake submission as an inbound turn (redacted, no raw PII)', async () => {
    // Route into awaiting_intake first.
    const retrieval = new FakeRetrieval(
      grounding([hit({ itemId: 'bal', servingMode: 'handoff_account_specific', score: 0.9, answerText: null })], false),
    );
    const { svc, repos } = build({ retrieval });
    const sid = await newSession(svc);
    await svc.handleMessage(sid, { clientMessageId: 'm1', text: "what's my balance?" }, ctx(1));

    const before = repos.audit.events.filter((e) => e.type === 'message_inbound').length;
    await svc.submitIntake(
      sid,
      { formId: 'account_handoff', values: { full_name: 'A B', date_of_birth: '1990-01-01', email: 'a@b.com' } },
      ctx(2),
    );

    const inboundEvents = repos.audit.events.filter((e) => e.type === 'message_inbound');
    expect(inboundEvents.length).toBe(before + 1); // the intake counts as an inbound
    const intakeInbound = inboundEvents.find((e) => e.payload.intake === true);
    expect(intakeInbound).toBeTruthy();
    // The transcript line must NOT contain the raw PII.
    const inboundText = repos.transcripts.entries
      .filter((e) => e.direction === 'inbound')
      .map((e) => e.text)
      .join(' ');
    expect(inboundText).not.toContain('a@b.com');
    expect(inboundText).not.toContain('A B');
  });

  it('a retrieval failure does NOT bypass the vulnerability gate and still completes the turn', async () => {
    class ThrowingRetrieval implements RetrievalAdapter {
      async retrieve(): Promise<GroundingSignal> {
        throw new Error('retrieval down');
      }
    }
    // Model reports vulnerable so we can prove the gate still ran despite retrieval dying.
    const model = new FakeModel({
      vulnerability: { vulnerable: true, category: 'distress', confidence: 0.9, source: 'model' },
    });
    const { svc, repos } = build({ retrieval: new ThrowingRetrieval(), model });
    const sid = await newSession(svc);

    const out = await svc.handleMessage(sid, { clientMessageId: 'm1', text: "I can't cope" }, ctx(1));

    expect(out.response.responseObject?.reply.mode).toBe('vulnerability');
    expect(repos.audit.types()).toContain('failure'); // retrieval failure recorded
    expect(repos.audit.types()).toContain('vulnerability_check'); // gate still ran
    // No message dropped: inbound + outbound both present.
    expect(repos.transcripts.entries.some((e) => e.direction === 'inbound')).toBe(true);
    expect(repos.transcripts.entries.some((e) => e.direction === 'outbound')).toBe(true);
  });

  it('an uncaught pipeline error fails SAFE: records a failure event + a fallback outbound', async () => {
    class ThrowingModel extends FakeModel {
      override async classify(): Promise<never> {
        throw new Error('model exploded after the gate');
      }
    }
    const { svc, repos } = build({ model: new ThrowingModel() });
    const sid = await newSession(svc);

    const out = await svc.handleMessage(sid, { clientMessageId: 'm1', text: 'tell me about loans' }, ctx(1));

    expect(out.response.responseObject?.reply.mode).toBe('fallback'); // never an answer
    expect(repos.audit.types()).toContain('failure');
    // The inbound message is recorded and gets a paired fallback outbound — the
    // turn is never dropped. (The session greeting is also an outbound, so
    // outbound >= inbound; the key is the safe fallback outbound exists.)
    const outbound = repos.transcripts.entries.filter((e) => e.direction === 'outbound');
    expect(repos.transcripts.entries.filter((e) => e.direction === 'inbound').length).toBe(1);
    expect(outbound.some((e) => e.replyMode === 'fallback')).toBe(true);
  });

  it('an unfaithful model phrasing is downgraded to fallback and audited as no_grounding', async () => {
    const retrieval = new FakeRetrieval(
      grounding(
        [hit({ itemId: 'borrow', servingMode: 'answer', score: 0.95, answerText: 'The minimum loan is £1,000.' })],
        true,
      ),
    );
    // The model injects a fabricated amount not in the approved text.
    const model = new FakeModel({
      classification: { action: 'answer', customerGoal: 'borrowing', confidence: 0.9, source: 'deterministic' },
      phrase: 'You can borrow up to £50,000 today!',
    });
    const { svc, repos } = build({ retrieval, model });
    const sid = await newSession(svc);

    const out = await svc.handleMessage(sid, { clientMessageId: 'm1', text: 'how much can I borrow?' }, ctx(1));

    expect(out.response.responseObject?.reply.mode).toBe('fallback'); // not 'answer'
    const routing = repos.audit.events.find((e) => e.type === 'routing_decision');
    expect(routing?.replyMode).toBe('fallback');
    expect(routing?.reasonCode).toBe('no_grounding'); // audit reflects the realised reply
  });

  it('a duplicate (idempotent) retry still records an inbound event for the received message', async () => {
    const { svc, repos } = build();
    const sid = await newSession(svc);
    await svc.handleMessage(sid, { clientMessageId: 'dup', text: 'hello' }, ctx(1));
    await svc.handleMessage(sid, { clientMessageId: 'dup', text: 'hello' }, ctx(2));

    const dupInbound = repos.audit.events.find(
      (e) => e.type === 'message_inbound' && e.payload.duplicate === true,
    );
    expect(dupInbound).toBeTruthy();
  });
});
