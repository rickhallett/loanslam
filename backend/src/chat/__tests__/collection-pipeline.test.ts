import { describe, expect, it } from 'vitest';
import type { ChatTurnResponse } from '@loanslam/contracts';
import type { RequestContext } from '../../ports/chat.port.js';
import type { ChatServiceDeps } from '../../composition/types.js';
import { ChatService, createChatService } from '../services/chat.service.js';
import { DeterministicModelAdapter } from '../../ai/deterministic-model.adapter.js';
import { FakeRetrieval, FakeTicket, fakeConfig, grounding, hit, makeRepos, noopLogger, type FakeRepos } from './fakes.js';

const ctx: RequestContext = { requestRef: 'req_test_1' };

interface Harness {
  service: ChatService;
  repos: FakeRepos;
  ticket: FakeTicket;
}

/** Harness wired with the REAL deterministic extractor so extraction reflects
 *  each message's text. Retrieval is pinned to an account-specific hit so the
 *  first turn routes into the collect-then-handoff journey. */
function build(): Harness {
  const repos = makeRepos();
  const ticket = new FakeTicket();
  const top = hit({ itemId: 'balance', servingMode: 'handoff_account_specific', score: 0.7 });
  const deps: ChatServiceDeps = {
    repos,
    model: new DeterministicModelAdapter(fakeConfig()),
    retrieval: new FakeRetrieval(grounding([top], false)),
    ticket,
    kb: [],
    config: fakeConfig(),
    logger: noopLogger,
  };
  return { service: createChatService(deps), repos, ticket };
}

function body(out: { response: { responseObject: ChatTurnResponse | null } }): ChatTurnResponse {
  expect(out.response.responseObject).not.toBeNull();
  return out.response.responseObject!;
}

async function start(h: Harness): Promise<string> {
  const out = await h.service.createSession({}, ctx);
  return out.setSessionId!;
}

let n = 0;
function msg(text: string) {
  n += 1;
  return { clientMessageId: `m${n}`, text };
}

describe('conversational slot collection (pipeline)', () => {
  it('turn 1 still offers the intake form, then a free-text turn collects the next slot', async () => {
    const h = build();
    const sid = await start(h);

    const t1 = body(await h.service.handleMessage(sid, msg("What's my balance?"), ctx));
    expect(t1.reply.mode).toBe('intake_request');
    expect(t1.state.awaitingForm).toBe(true);

    h.repos.audit.events.length = 0; // focus on the continuation turn
    const t2 = body(await h.service.handleMessage(sid, msg('my name is Jane Smith'), ctx));

    expect(t2.reply.mode).toBe('clarify');
    expect(t2.reply.text.toLowerCase()).toContain('date of birth');

    // Mid-collection bypasses re-classification but still runs the safety gate
    // and records the slot-filling step.
    expect(h.repos.audit.types()).toEqual([
      'message_inbound',
      'vulnerability_check',
      'extraction',
      'collection_step',
      'message_outbound',
    ]);

    const session = await h.repos.sessions.findById(sid);
    expect(session?.state.collected.full_name).toBe('Jane Smith');
  });

  it('completes and creates a ticket when all required slots arrive up front', async () => {
    const h = build();
    const sid = await start(h);

    const t1 = body(
      await h.service.handleMessage(
        sid,
        msg('I need to sort my account: my name is Jane Smith, dob 1990-01-02, email jane@example.com'),
        ctx,
      ),
    );

    expect(t1.reply.mode).toBe('handoff');
    if (t1.reply.mode === 'handoff') expect(t1.reply.ticketRef).toBeTruthy();
    expect(t1.state.phase).toBe('handoff_pending');
    expect(h.ticket.tickets).toHaveLength(1);
    expect(h.ticket.tickets[0]!.reasonCode).toBe('account_specific');
    expect(h.ticket.tickets[0]!.contact.full_name).toBe('Jane Smith');
  });

  it('vulnerability pre-empts collection mid-flow', async () => {
    const h = build();
    const sid = await start(h);
    await h.service.handleMessage(sid, msg("What's my balance?"), ctx); // begin collection

    h.repos.audit.events.length = 0; // focus on the vulnerability turn
    const t2 = body(await h.service.handleMessage(sid, msg("actually I can't pay anything, I'm struggling"), ctx));
    expect(t2.reply.mode).toBe('vulnerability');
    expect(t2.state.vulnerabilityFlagged).toBe(true);
    // The vulnerability gate pre-empted collection: no slot-filling this turn.
    expect(h.repos.audit.types()).not.toContain('collection_step');
    expect(h.repos.audit.types()).not.toContain('extraction');
  });

  it('escalates to a human when the clarification budget is exhausted', async () => {
    const h = build();
    const sid = await start(h);
    await h.service.handleMessage(sid, msg("What's my balance?"), ctx); // turn 1, clarify budget 1
    await h.service.handleMessage(sid, msg('hmm'), ctx); // no progress, budget 2
    const t = body(await h.service.handleMessage(sid, msg('not sure'), ctx)); // budget exhausted

    expect(t.reply.mode).toBe('handoff');
    expect(t.state.phase).toBe('handoff_pending');
    expect(h.ticket.tickets).toHaveLength(1);
  });

  it('escalates when the customer refuses a required field', async () => {
    const h = build();
    const sid = await start(h);
    await h.service.handleMessage(sid, msg("What's my balance?"), ctx); // asks for full_name

    h.repos.audit.events.length = 0;
    const t = body(await h.service.handleMessage(sid, msg("I'd rather not give my name"), ctx));
    expect(t.reply.mode).toBe('handoff');
    const step = h.repos.audit.events.find((e) => e.type === 'collection_step');
    expect(step?.reasonCode).toBe('slot_refused');
  });
});
