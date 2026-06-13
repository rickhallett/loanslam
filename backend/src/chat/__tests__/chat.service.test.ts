import { describe, expect, it } from 'vitest';
import { POLICY_VERSION, type ChatTurnResponse } from '@loanslam/contracts';
import type { RequestContext } from '../../ports/chat.port.js';
import type { ChatServiceDeps } from '../../composition/types.js';
import { ChatService, createChatService } from '../services/chat.service.js';
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

const ctx: RequestContext = { requestRef: 'req_test_1' };

interface Harness {
  service: ChatService;
  repos: FakeRepos;
  ticket: FakeTicket;
  model: FakeModel;
}

function build(opts: {
  signal: ReturnType<typeof grounding>;
  model?: FakeModel;
  kb?: ChatServiceDeps['kb'];
}): Harness {
  const repos = makeRepos();
  const ticket = new FakeTicket();
  const model = opts.model ?? new FakeModel();
  const deps: ChatServiceDeps = {
    repos,
    model,
    retrieval: new FakeRetrieval(opts.signal),
    ticket,
    kb: opts.kb ?? [],
    config: fakeConfig(),
    logger: noopLogger,
  };
  return { service: createChatService(deps), repos, ticket, model };
}

async function startSession(h: Harness): Promise<string> {
  const out = await h.service.createSession({}, ctx);
  expect(out.setSessionId).toBeDefined();
  expect(out.csrfToken).toBeDefined();
  return out.setSessionId!;
}

function body(out: { response: { responseObject: ChatTurnResponse | null } }): ChatTurnResponse {
  expect(out.response.responseObject).not.toBeNull();
  return out.response.responseObject!;
}

describe('ChatService.createSession', () => {
  it('greets with a clarify reply, sets cookie + csrf, audits session_created', async () => {
    const h = build({ signal: grounding([], false) });
    const out = await h.service.createSession({}, ctx);
    const turn = body(out);
    expect(turn.reply.mode).toBe('clarify');
    expect(turn.state.phase).toBe('anonymous_active');
    expect(out.response.statusCode).toBe(201);
    expect(h.repos.audit.types()).toContain('session_created');
    expect(h.repos.audit.types()).toContain('message_outbound');
  });
});

describe('ChatService.handleMessage — unauthenticated', () => {
  it('returns 401 fail envelope when the session id is missing/unknown', async () => {
    const h = build({ signal: grounding([], false) });
    const out = await h.service.handleMessage(
      'nope',
      { clientMessageId: 'm1', text: 'hi' },
      ctx,
    );
    expect(out.response.success).toBe(false);
    expect(out.response.statusCode).toBe(401);
    expect(out.response.responseObject).toBeNull();
  });
});

describe('ChatService.handleMessage — grounded answer', () => {
  it('returns mode answer with exactly one citation and links from the hit', async () => {
    const top = hit({
      itemId: 'how-much-can-i-borrow',
      question: 'How much can I borrow?',
      servingMode: 'answer',
      score: 0.8,
      answerText: 'It depends on your circumstances; an application will tell you.',
      links: [{ label: 'Apply', href: 'https://example.com/apply' }],
    });
    const h = build({ signal: grounding([top], true) });
    const sid = await startSession(h);

    const out = await h.service.handleMessage(
      sid,
      { clientMessageId: 'm1', text: 'How much can I borrow?' },
      ctx,
    );
    const turn = body(out);
    expect(turn.reply.mode).toBe('answer');
    if (turn.reply.mode === 'answer') {
      expect(turn.reply.citations).toHaveLength(1);
      expect(turn.reply.citations[0]!.itemId).toBe('how-much-can-i-borrow');
      expect(turn.reply.links).toHaveLength(1);
    }
    expect(h.model.classifyCalls).toBe(1);
    expect(h.model.phraseCalls).toBe(1);
  });

  it('only the answer reply carries citations; other modes do not', async () => {
    const top = hit({ itemId: 'apr', servingMode: 'excluded', score: 0.7 });
    const h = build({ signal: grounding([top], false) });
    const sid = await startSession(h);
    const out = await h.service.handleMessage(
      sid,
      { clientMessageId: 'm1', text: "What's your APR?" },
      ctx,
    );
    const turn = body(out);
    expect(turn.reply.mode).toBe('refusal');
    expect('citations' in turn.reply).toBe(false);
  });

  it('downgrades to fallback when the model cannot phrase safely', async () => {
    const top = hit({ itemId: 'x', servingMode: 'answer', score: 0.9 });
    const model = new FakeModel({ phrase: null });
    const h = build({ signal: grounding([top], true), model });
    const sid = await startSession(h);
    const out = await h.service.handleMessage(
      sid,
      { clientMessageId: 'm1', text: 'a grounded question' },
      ctx,
    );
    expect(body(out).reply.mode).toBe('fallback');
  });
});

describe('ChatService.handleMessage — excluded (no rate quoted)', () => {
  it('refuses without quoting any figure', async () => {
    const top = hit({ itemId: 'apr', servingMode: 'excluded', score: 0.7 });
    const h = build({ signal: grounding([top], false) });
    const sid = await startSession(h);
    const out = await h.service.handleMessage(
      sid,
      { clientMessageId: 'm1', text: "What's your APR?" },
      ctx,
    );
    const turn = body(out);
    expect(turn.reply.mode).toBe('refusal');
    expect(turn.reply.text).not.toMatch(/\d+\s*%/);
    expect(turn.reply.text).not.toMatch(/APR is/i);
  });
});

describe('ChatService — account-specific intake -> handoff', () => {
  it('routes to intake, then submitIntake creates a ticket and confirms handoff', async () => {
    const top = hit({ itemId: 'balance', servingMode: 'handoff_account_specific', score: 0.7 });
    const h = build({ signal: grounding([top], false) });
    const sid = await startSession(h);

    const ask = await h.service.handleMessage(
      sid,
      { clientMessageId: 'm1', text: "What's my balance?" },
      ctx,
    );
    const askTurn = body(ask);
    expect(askTurn.reply.mode).toBe('intake_request');
    expect(askTurn.state.phase).toBe('awaiting_intake');
    expect(askTurn.state.awaitingForm).toBe(true);

    const submit = await h.service.submitIntake(
      sid,
      {
        formId: 'account_handoff',
        values: {
          full_name: 'Jane Doe',
          date_of_birth: '1990-01-02',
          email: 'jane@example.com',
        },
      },
      ctx,
    );
    const subTurn = body(submit);
    expect(subTurn.reply.mode).toBe('handoff');
    if (subTurn.reply.mode === 'handoff') {
      expect(subTurn.reply.ticketRef).toBeTruthy();
    }
    expect(subTurn.state.phase).toBe('handoff_pending');
    expect(subTurn.state.awaitingForm).toBe(false);

    expect(h.ticket.tickets).toHaveLength(1);
    expect(h.ticket.tickets[0]!.category).toBe('account');
    expect(h.ticket.tickets[0]!.priority).toBe('high');
    expect(h.ticket.tickets[0]!.reasonCode).toBe('account_specific');
    // Only allowed PII stored; no stray keys.
    expect(h.ticket.tickets[0]!.contact.full_name).toBe('Jane Doe');

    const auditTypes = h.repos.audit.types();
    expect(auditTypes).toContain('intake_submitted');
    expect(auditTypes).toContain('ticket_created');
  });

  it('submitIntake without a pending form returns 400', async () => {
    const h = build({ signal: grounding([], false) });
    const sid = await startSession(h);
    const out = await h.service.submitIntake(
      sid,
      { formId: 'account_handoff', values: {} },
      ctx,
    );
    expect(out.response.statusCode).toBe(400);
    expect(out.response.success).toBe(false);
  });

  it('submitIntake with invalid values returns 400 and no ticket', async () => {
    const top = hit({ itemId: 'balance', servingMode: 'handoff_account_specific', score: 0.7 });
    const h = build({ signal: grounding([top], false) });
    const sid = await startSession(h);
    await h.service.handleMessage(sid, { clientMessageId: 'm1', text: 'my balance' }, ctx);
    const out = await h.service.submitIntake(
      sid,
      { formId: 'account_handoff', values: { full_name: 'Jane' } },
      ctx,
    );
    expect(out.response.statusCode).toBe(400);
    expect(h.ticket.tickets).toHaveLength(0);
  });
});

describe('ChatService — vulnerability stops the pipeline', () => {
  it('returns vulnerability reply + urgent ticket and never classifies', async () => {
    const h = build({ signal: grounding([], false) });
    const sid = await startSession(h);
    const out = await h.service.handleMessage(
      sid,
      { clientMessageId: 'm1', text: "I can't pay this month" },
      ctx,
    );
    const turn = body(out);
    expect(turn.reply.mode).toBe('vulnerability');
    if (turn.reply.mode === 'vulnerability') {
      expect(turn.reply.links.length).toBeGreaterThan(0);
      expect(turn.reply.ticketRef).toBeTruthy();
    }
    expect(turn.state.vulnerabilityFlagged).toBe(true);
    expect(turn.state.phase).toBe('handoff_pending');

    // Pipeline STOPPED before classification.
    expect(h.model.classifyCalls).toBe(0);
    expect(h.repos.audit.types()).not.toContain('classification');

    // Urgent ticket created.
    expect(h.ticket.tickets).toHaveLength(1);
    expect(h.ticket.tickets[0]!.priority).toBe('urgent');
    expect(h.ticket.tickets[0]!.category).toBe('vulnerability');
  });

  it('model failclosed verdict is routed as vulnerability', async () => {
    const model = new FakeModel({
      vulnerability: { vulnerable: false, category: null, confidence: 0, source: 'failclosed' },
    });
    const h = build({ signal: grounding([], false), model });
    const sid = await startSession(h);
    const out = await h.service.handleMessage(
      sid,
      { clientMessageId: 'm1', text: 'an ordinary looking question' },
      ctx,
    );
    expect(body(out).reply.mode).toBe('vulnerability');
    expect(h.model.classifyCalls).toBe(0);
    const vulnCheck = h.repos.audit.events.find((e) => e.type === 'vulnerability_check');
    expect(vulnCheck?.reasonCode).toBe('model_error_failclosed');
  });
});

describe('ChatService — idempotency', () => {
  it('a duplicate clientMessageId is acknowledged without reprocessing', async () => {
    const top = hit({ itemId: 'x', servingMode: 'answer', score: 0.9 });
    const h = build({ signal: grounding([top], true) });
    const sid = await startSession(h);

    await h.service.handleMessage(sid, { clientMessageId: 'dup', text: 'a question' }, ctx);
    const classifyAfterFirst = h.model.classifyCalls;

    const second = await h.service.handleMessage(
      sid,
      { clientMessageId: 'dup', text: 'a question' },
      ctx,
    );
    expect(body(second).reply.mode).toBe('clarify');
    // No re-classification on the duplicate.
    expect(h.model.classifyCalls).toBe(classifyAfterFirst);
  });
});

describe('ChatService — audit completeness', () => {
  it('writes message_inbound AND message_outbound for a normal answered turn', async () => {
    const top = hit({ itemId: 'x', servingMode: 'answer', score: 0.9 });
    const h = build({ signal: grounding([top], true) });
    const sid = await startSession(h);
    h.repos.audit.events.length = 0; // focus on the message turn only

    await h.service.handleMessage(sid, { clientMessageId: 'm1', text: 'a grounded question' }, ctx);

    const types = h.repos.audit.types();
    // The full normal-turn event chain from the build-spec.
    expect(types).toEqual([
      'message_inbound',
      'vulnerability_check',
      'classification',
      'grounding_check',
      'routing_decision',
      'message_outbound',
    ]);
  });

  it('records both transcript directions and never drops a message', async () => {
    const top = hit({ itemId: 'x', servingMode: 'answer', score: 0.9 });
    const h = build({ signal: grounding([top], true) });
    const sid = await startSession(h);
    await h.service.handleMessage(sid, { clientMessageId: 'm1', text: 'a grounded question' }, ctx);

    const directions = h.repos.transcripts.entries.map((e) => e.direction);
    // session greeting (outbound) + inbound + outbound.
    expect(directions.filter((d) => d === 'inbound')).toHaveLength(1);
    expect(directions.filter((d) => d === 'outbound')).toHaveLength(2);
  });

  it('stamps every audit event with conversationRef, requestRef and POLICY_VERSION', async () => {
    const h = build({ signal: grounding([], false) });
    const sid = await startSession(h);
    await h.service.handleMessage(sid, { clientMessageId: 'm1', text: 'asdf' }, ctx);
    for (const e of h.repos.audit.events) {
      expect(e.conversationRef).toBeTruthy();
      expect(e.requestRef).toBe('req_test_1');
      expect(e.policyVersion).toBe(POLICY_VERSION);
    }
  });
});

describe('ChatService.reset', () => {
  it('clears state and history and greets again', async () => {
    const top = hit({ itemId: 'balance', servingMode: 'handoff_account_specific', score: 0.7 });
    const h = build({ signal: grounding([top], false) });
    const sid = await startSession(h);
    await h.service.handleMessage(sid, { clientMessageId: 'm1', text: 'my balance' }, ctx);

    const before = await h.repos.sessions.findById(sid);
    expect(before?.state.pendingForm).not.toBeNull();

    const out = await h.service.reset(sid, ctx);
    const turn = body(out);
    expect(turn.reply.mode).toBe('clarify');
    expect(turn.state.phase).toBe('anonymous_active');
    expect(turn.state.awaitingForm).toBe(false);
    expect(turn.state.vulnerabilityFlagged).toBe(false);

    const after = await h.repos.sessions.findById(sid);
    expect(after?.state.pendingForm).toBeNull();
    expect(after?.history).toHaveLength(1); // greeting outbound only
    expect(h.repos.audit.types()).toContain('conversation_reset');
  });
});
