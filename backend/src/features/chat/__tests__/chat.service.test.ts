import { describe, expect, it } from 'vitest';

import type {
  ClassifierResult,
  GroundingCitation,
  RetrievalResult,
  VulnerabilityResult,
} from '@loanslam/contracts';

import { InMemoryChatRepository } from '../chat.repository.js';
import { ChatService } from '../chat.service.js';
import type { ModelProvider } from '../providers/model-provider.js';
import type { RagProvider } from '../providers/rag-provider.js';
import type { TicketProvider } from '../providers/ticket-provider.js';

const citation: GroundingCitation = {
  sourceId: 'kb_general_process',
  title: 'Loanslam application process',
  excerpt: 'Loanslam can answer general application process questions.',
  url: 'https://loanslam.example/support/application-process',
  score: 0.82,
};

describe('ChatService', () => {
  it('audits inbound and outbound messages around provider calls', async () => {
    const { service, repository } = createService();
    const created = await service.createSession();

    const response = await service.sendMessage(created.sessionId, {
      clientMessageId: 'client-message-1',
      text: 'How does the application process work?',
    });

    expect(response.state).toBe('active');
    expect(repository.transcriptEntries.map((entry) => entry.direction)).toEqual([
      'outbound',
      'inbound',
      'outbound',
    ]);
    expect(repository.transcriptEntries.at(1)).toMatchObject({
      requestRef: response.requestRef,
      direction: 'inbound',
      role: 'user',
      content: 'How does the application process work?',
    });
    expect(repository.transcriptEntries.at(2)).toMatchObject({
      requestRef: response.requestRef,
      direction: 'outbound',
      role: 'assistant',
    });
    expect(repository.auditEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(['message_received', 'message_routed']),
    );
  });

  it('routes to handoff intake when the vulnerability provider errors', async () => {
    const providers = createProviders({
      classifyVulnerability: () => Promise.reject(new Error('provider unavailable')),
    });
    const { service, repository } = createService(providers);
    const created = await service.createSession();

    const response = await service.sendMessage(created.sessionId, {
      clientMessageId: 'client-message-1',
      text: 'I am struggling and need help.',
    });

    expect(response.state).toBe('awaiting_handoff_intake');
    if (response.state !== 'awaiting_handoff_intake') {
      throw new Error('Expected handoff intake response');
    }
    expect(response.form.fields.map((field) => field.name)).toEqual([
      'name',
      'dob',
      'address',
      'phone',
      'email',
      'situationalContext',
    ]);
    expect(response.audit.reasonCodes).toContain('vulnerability_provider_failed');
    expect(repository.auditEvents.map((event) => event.reasonCode)).toContain(
      'vulnerability_provider_failed',
    );
    expect(providers.model.classifyActionCalls).toBe(0);
  });

  it('bypasses classifier when vulnerability detection routes to a human', async () => {
    const providers = createProviders({
      vulnerability: {
        isVulnerable: true,
        routeToHuman: true,
        confidence: 0.91,
        signals: ['financial_difficulty'],
        reasonCode: 'vulnerability_financial_difficulty',
      },
    });
    const { service } = createService(providers);
    const created = await service.createSession();

    const response = await service.sendMessage(created.sessionId, {
      clientMessageId: 'client-message-1',
      text: 'I cannot afford repayments and I am worried.',
    });

    expect(response.state).toBe('awaiting_handoff_intake');
    expect(response.audit.reasonCodes).toContain('vulnerability_financial_difficulty');
    expect(providers.model.classifyActionCalls).toBe(0);
    expect(providers.rag.retrieveCalls).toBe(0);
  });

  it('routes ungrounded retrieval to fallback instead of answering', async () => {
    const providers = createProviders({
      retrieval: {
        answerable: false,
        grounded: false,
        citations: [],
        reasonCode: 'ungrounded_retrieval',
      },
    });
    const { service } = createService(providers);
    const created = await service.createSession();

    const response = await service.sendMessage(created.sessionId, {
      clientMessageId: 'client-message-1',
      text: 'Tell me the secret approval rule.',
    });

    expect(response.state).toBe('safe_fallback');
    expect(response.messages.at(-1)?.reasonCode).toBe('ungrounded_retrieval');
    expect(providers.model.generateAnswerCalls).toBe(0);
  });

  it('routes account-specific actions to handoff even when retrieval is ungrounded', async () => {
    const providers = createProviders({
      retrieval: {
        answerable: false,
        grounded: false,
        citations: [],
        reasonCode: 'ungrounded_retrieval',
      },
      classifier: {
        action: 'request_handoff_intake',
        confidence: 0.91,
        reasonCode: 'account_specific_request',
        requiresGrounding: false,
      },
    });
    const { service } = createService(providers);
    const created = await service.createSession();

    const response = await service.sendMessage(created.sessionId, {
      clientMessageId: 'client-message-1',
      text: 'Can you change my repayment date?',
    });

    expect(response.state).toBe('awaiting_handoff_intake');
    expect(response.audit.reasonCodes).toContain('account_specific_request');
    expect(providers.model.classifyActionCalls).toBe(1);
    expect(providers.model.generateAnswerCalls).toBe(0);
  });

  it('returns the approved intake form for account-specific actions', async () => {
    const { service } = createService(
      createProviders({
        classifier: {
          action: 'request_handoff_intake',
          confidence: 0.87,
          reasonCode: 'account_specific_request',
          requiresGrounding: false,
        },
      }),
    );
    const created = await service.createSession();

    const response = await service.sendMessage(created.sessionId, {
      clientMessageId: 'client-message-1',
      text: 'Can you change my loan repayment date?',
    });

    expect(response.state).toBe('awaiting_handoff_intake');
    if (response.state !== 'awaiting_handoff_intake') {
      throw new Error('Expected handoff intake response');
    }
    expect(response.form.title).toBe('Support handoff');
    expect(response.form.fields.every((field) => field.required)).toBe(true);
    expect(response.audit.reasonCodes).toContain('account_specific_request');
  });

  it('includes grounding citations on answer actions', async () => {
    const { service } = createService();
    const created = await service.createSession();

    const response = await service.sendMessage(created.sessionId, {
      clientMessageId: 'client-message-1',
      text: 'What can the chat help with?',
    });

    expect(response.state).toBe('active');
    expect(response.messages.at(-1)?.citations).toEqual([citation]);
    expect(response.audit.reasonCodes).toContain('general_process_question');
  });

  it('returns the original request reference for duplicate client message ids without double-writing', async () => {
    const providers = createProviders();
    const { service, repository } = createService(providers);
    const created = await service.createSession();

    const first = await service.sendMessage(created.sessionId, {
      clientMessageId: 'client-message-1',
      text: 'How does the application process work?',
    });
    const transcriptCount = repository.transcriptEntries.length;
    const auditCount = repository.auditEvents.length;
    const duplicate = await service.sendMessage(created.sessionId, {
      clientMessageId: 'client-message-1',
      text: 'How does the application process work?',
    });

    expect(duplicate.requestRef).toBe(first.requestRef);
    expect(duplicate).toEqual(first);
    expect(repository.transcriptEntries).toHaveLength(transcriptCount);
    expect(repository.auditEvents).toHaveLength(auditCount);
    expect(providers.model.classifyVulnerabilityCalls).toBe(1);
    expect(providers.rag.retrieveCalls).toBe(1);
  });

  it('rejects incomplete handoff intake before writing ticket records', async () => {
    const { service, repository } = createService();
    const created = await service.createSession();

    await expect(
      service.submitIntake(created.sessionId, {
        clientRequestId: 'client-intake-1',
        intake: {
          name: 'Alex Customer',
          situationalContext: 'I need help with my application.',
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'invalid_request',
    });

    expect(repository.ticketHandoffs).toHaveLength(0);
    expect(repository.auditEvents.map((event) => event.eventType)).not.toContain('intake_received');
  });

  it('records failed webhook handoff attempts without throwing away the audit trail', async () => {
    const providers = createProviders({ ticket: new ThrowingTicketProvider() });
    const { service, repository } = createService(providers);
    const created = await service.createSession();

    const response = await service.submitIntake(created.sessionId, {
      clientRequestId: 'client-intake-1',
      intake: {
        name: 'Alex Customer',
        dob: '1990-01-31',
        address: '1 High Street, London',
        phone: '+447700900123',
        email: 'alex@example.com',
        situationalContext: 'I need help with my application.',
      },
    });

    expect(response.state).toBe('handoff_pending');
    expect(response.audit.reasonCodes).toContain('ticket_webhook_failed');
    expect(response.messages.at(-1)?.text).toContain('could not send');
    expect(repository.ticketHandoffs).toHaveLength(1);
    expect(repository.ticketHandoffs[0]).toMatchObject({
      provider: 'ticket-provider',
      status: 'failed',
    });
    expect(repository.auditEvents.map((event) => event.eventType)).toContain(
      'ticket_handoff_recorded',
    );
  });

  it('routes grounded answer generation safe fallback output to fallback state', async () => {
    const providers = createProviders({
      generateAnswer: () =>
        Promise.resolve({
          text: 'I cannot answer that from approved information.',
          reasonCode: 'safe_fallback',
        }),
    });
    const { service, repository } = createService(providers);
    const created = await service.createSession();

    const response = await service.sendMessage(created.sessionId, {
      clientMessageId: 'client-message-1',
      text: 'What can the chat help with?',
    });

    expect(response.state).toBe('safe_fallback');
    expect(response.messages.at(-1)?.reasonCode).toBe('safe_fallback');
    expect(repository.auditEvents.map((event) => event.eventType)).toContain('message_routed');
  });

  it('does not convert repository write failures into provider fallbacks', async () => {
    const providers = createProviders();
    const repository = new FailingAnswerWriteRepository();
    const service = new ChatService({
      repository,
      modelProvider: providers.model,
      ragProvider: providers.rag,
      ticketProvider: providers.ticket,
    });
    const created = await service.createSession();

    await expect(
      service.sendMessage(created.sessionId, {
        clientMessageId: 'client-message-1',
        text: 'What can the chat help with?',
      }),
    ).rejects.toThrow('answer transcript write failed');

    expect(
      repository.transcriptEntries.some((entry) => entry.content.includes('cannot generate')),
    ).toBe(false);
  });

  it('does not replay the message pipeline when completion fails after request activity', async () => {
    const providers = createProviders();
    const repository = new FailingFirstCompletionRepository();
    const service = new ChatService({
      repository,
      modelProvider: providers.model,
      ragProvider: providers.rag,
      ticketProvider: providers.ticket,
    });
    const created = await service.createSession();

    await expect(
      service.sendMessage(created.sessionId, {
        clientMessageId: 'client-message-1',
        text: 'What can the chat help with?',
      }),
    ).rejects.toThrow('client message completion failed');
    const transcriptCount = repository.transcriptEntries.length;
    const auditCount = repository.auditEvents.length;

    await expect(
      service.sendMessage(created.sessionId, {
        clientMessageId: 'client-message-1',
        text: 'What can the chat help with?',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'message_incomplete',
    });

    expect(repository.transcriptEntries).toHaveLength(transcriptCount);
    expect(repository.auditEvents).toHaveLength(auditCount);
    expect(providers.model.classifyVulnerabilityCalls).toBe(1);
    expect(providers.rag.retrieveCalls).toBe(1);
  });

  it('does not report audit write failures as vulnerability provider failures', async () => {
    const providers = createProviders();
    const repository = new FailingVulnerabilityAuditRepository();
    const service = new ChatService({
      repository,
      modelProvider: providers.model,
      ragProvider: providers.rag,
      ticketProvider: providers.ticket,
    });
    const created = await service.createSession();

    await expect(
      service.sendMessage(created.sessionId, {
        clientMessageId: 'client-message-1',
        text: 'What can the chat help with?',
      }),
    ).rejects.toThrow('vulnerability audit write failed');

    expect(repository.auditEvents.map((event) => event.eventType)).not.toContain(
      'vulnerability_provider_failed',
    );
    expect(providers.model.classifyVulnerabilityCalls).toBe(1);
    expect(providers.model.classifyActionCalls).toBe(0);
  });
});

function createService(overrides: ReturnType<typeof createProviders> = createProviders()) {
  const repository = new InMemoryChatRepository();
  const service = new ChatService({
    repository,
    modelProvider: overrides.model,
    ragProvider: overrides.rag,
    ticketProvider: overrides.ticket,
  });

  return { service, repository };
}

function createProviders(overrides: ProviderOverrides = {}) {
  const model = new FakeModelProvider(overrides);
  const rag = new FakeRagProvider(overrides);
  const ticket = overrides.ticket ?? new FakeTicketProvider();

  return { model, rag, ticket };
}

type ProviderOverrides = {
  vulnerability?: VulnerabilityResult;
  classifier?: ClassifierResult;
  retrieval?: RetrievalResult;
  classifyVulnerability?: ModelProvider['classifyVulnerability'];
  generateAnswer?: ModelProvider['generateAnswer'];
  ticket?: TicketProvider;
};

class FakeModelProvider implements ModelProvider {
  classifyVulnerabilityCalls = 0;
  classifyActionCalls = 0;
  generateAnswerCalls = 0;

  constructor(private readonly overrides: ProviderOverrides) {}

  classifyVulnerability(
    input: Parameters<ModelProvider['classifyVulnerability']>[0],
  ): Promise<VulnerabilityResult> {
    this.classifyVulnerabilityCalls += 1;

    if (this.overrides.classifyVulnerability) {
      return this.overrides.classifyVulnerability(input);
    }

    return Promise.resolve(
      this.overrides.vulnerability ?? {
        isVulnerable: false,
        routeToHuman: false,
        confidence: 0.97,
        signals: [],
        reasonCode: 'no_vulnerability_detected',
      },
    );
  }

  classifyAction(): Promise<ClassifierResult> {
    this.classifyActionCalls += 1;
    return Promise.resolve(
      this.overrides.classifier ?? {
        action: 'answer',
        confidence: 0.9,
        reasonCode: 'general_process_question',
        requiresGrounding: true,
      },
    );
  }

  generateAnswer(): Promise<{ text: string; reasonCode: string }> {
    this.generateAnswerCalls += 1;
    if (this.overrides.generateAnswer) {
      return this.overrides.generateAnswer({
        conversationRef: 'conv_fake',
        requestRef: 'req_fake',
        message: 'fake message',
        retrieval: {
          answerable: true,
          grounded: true,
          citations: [citation],
          reasonCode: 'grounded_retrieval',
        },
        citations: [citation],
      });
    }

    return Promise.resolve({
      text: 'Loanslam can help with general application process questions.',
      reasonCode: 'general_process_question',
    });
  }
}

class FakeRagProvider implements RagProvider {
  retrieveCalls = 0;

  constructor(private readonly overrides: ProviderOverrides) {}

  retrieve(): Promise<RetrievalResult> {
    this.retrieveCalls += 1;
    return Promise.resolve(
      this.overrides.retrieval ?? {
        answerable: true,
        grounded: true,
        citations: [citation],
        context: 'Loanslam can answer general application process questions.',
        score: 0.82,
        reasonCode: 'grounded_retrieval',
      },
    );
  }
}

class FakeTicketProvider implements TicketProvider {
  submitHandoff(): Promise<{
    provider: string;
    providerReference: string;
    status: 'pending';
    reasonCode: string;
  }> {
    return Promise.resolve({
      provider: 'fake-ticket-provider',
      providerReference: 'ticket_fake_1',
      status: 'pending',
      reasonCode: 'fake_ticket_pending',
    });
  }
}

class ThrowingTicketProvider implements TicketProvider {
  submitHandoff(): Promise<never> {
    return Promise.reject(new Error('network down'));
  }
}

class FailingAnswerWriteRepository extends InMemoryChatRepository {
  override appendTranscript(
    entry: Parameters<InMemoryChatRepository['appendTranscript']>[0],
  ): ReturnType<InMemoryChatRepository['appendTranscript']> {
    if (
      entry.direction === 'outbound' &&
      entry.content === 'Loanslam can help with general application process questions.'
    ) {
      return Promise.reject(new Error('answer transcript write failed'));
    }

    return super.appendTranscript(entry);
  }
}

class FailingFirstCompletionRepository extends InMemoryChatRepository {
  private completionAttempts = 0;

  override completeClientMessage(
    clientMessageRecordId: string,
    responsePayload: Parameters<InMemoryChatRepository['completeClientMessage']>[1],
  ): ReturnType<InMemoryChatRepository['completeClientMessage']> {
    this.completionAttempts += 1;
    if (this.completionAttempts === 1) {
      return Promise.reject(new Error('client message completion failed'));
    }

    return super.completeClientMessage(clientMessageRecordId, responsePayload);
  }
}

class FailingVulnerabilityAuditRepository extends InMemoryChatRepository {
  override appendAudit(
    event: Parameters<InMemoryChatRepository['appendAudit']>[0],
  ): ReturnType<InMemoryChatRepository['appendAudit']> {
    if (event.eventType === 'vulnerability_checked') {
      return Promise.reject(new Error('vulnerability audit write failed'));
    }

    return super.appendAudit(event);
  }
}
