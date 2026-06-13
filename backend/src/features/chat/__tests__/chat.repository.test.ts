import { describe, expect, it } from 'vitest';

import {
  ChatRepositoryError,
  InMemoryChatRepository,
  parseJsonObjectForRepository,
} from '../chat.repository.js';

describe('InMemoryChatRepository', () => {
  it('creates sessions with an opaque conversation reference and default active state', async () => {
    const repository = new InMemoryChatRepository();

    const session = await repository.createSession({ csrfTokenHash: 'csrf-hash-1' });

    expect(session.id).toMatch(/^session_/);
    expect(session.conversationRef).toMatch(/^conv_/);
    expect(session.conversationRef).not.toBe(session.id);
    expect(session.csrfTokenHash).toBe('csrf-hash-1');
    expect(session.state).toBe('active');
    expect(session.structuredState).toEqual({});
    await expect(repository.getSessionById(session.id)).resolves.toEqual(session);
    await expect(repository.getSessionByConversationRef(session.conversationRef)).resolves.toEqual(
      session,
    );
  });

  it('rotates CSRF hashes without changing the public conversation reference', async () => {
    const repository = new InMemoryChatRepository();
    const session = await repository.createSession({ csrfTokenHash: 'csrf-hash-1' });

    const rotated = await repository.rotateCsrf(session.id, 'csrf-hash-2');

    expect(rotated.id).toBe(session.id);
    expect(rotated.conversationRef).toBe(session.conversationRef);
    expect(rotated.csrfTokenHash).toBe('csrf-hash-2');
    expect(rotated.updatedAt.getTime()).toBeGreaterThanOrEqual(session.updatedAt.getTime());
  });

  it('updates session state with structured state payloads', async () => {
    const repository = new InMemoryChatRepository();
    const session = await repository.createSession({ csrfTokenHash: 'csrf-hash' });

    const updated = await repository.updateSessionState(session.id, 'awaiting_handoff_intake', {
      reasonCode: 'vulnerability_detected',
    });

    expect(updated.state).toBe('awaiting_handoff_intake');
    expect(updated.structuredState).toEqual({ reasonCode: 'vulnerability_detected' });
  });

  it('appends transcript and audit records with session and request references', async () => {
    const repository = new InMemoryChatRepository();
    const session = await repository.createSession({ csrfTokenHash: 'csrf-hash' });

    const transcript = await repository.appendTranscript({
      sessionId: session.id,
      requestRef: 'req_123',
      direction: 'inbound',
      role: 'user',
      content: 'Can I pause repayment?',
      metadata: { source: 'widget' },
    });
    const audit = await repository.appendAudit({
      sessionId: session.id,
      requestRef: 'req_123',
      eventType: 'message_received',
      reasonCode: 'customer_question',
      payload: { length: 22 },
    });

    expect(transcript).toMatchObject({
      sessionId: session.id,
      requestRef: 'req_123',
      direction: 'inbound',
      role: 'user',
      content: 'Can I pause repayment?',
      metadata: { source: 'widget' },
    });
    expect(audit).toMatchObject({
      sessionId: session.id,
      requestRef: 'req_123',
      eventType: 'message_received',
      reasonCode: 'customer_question',
      payload: { length: 22 },
    });
    expect(repository.transcriptEntries).toEqual([transcript]);
    expect(repository.auditEvents).toEqual([audit]);
  });

  it('keeps client messages idempotent per session and returns the original request reference', async () => {
    const repository = new InMemoryChatRepository();
    const session = await repository.createSession({ csrfTokenHash: 'csrf-hash' });

    const first = await repository.recordClientMessage(session.id, 'client-message-1', 'req_first');
    const duplicate = await repository.recordClientMessage(
      session.id,
      'client-message-1',
      'req_duplicate',
    );

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.requestRef).toBe('req_first');
    expect(duplicate.id).toBe(first.id);
  });

  it('records ticket handoff provider references with auditable request linkage', async () => {
    const repository = new InMemoryChatRepository();
    const session = await repository.createSession({ csrfTokenHash: 'csrf-hash' });

    const ticket = await repository.recordTicketHandoff({
      sessionId: session.id,
      requestRef: 'req_ticket',
      provider: 'null-ticket-provider',
      providerReference: 'ticket_local_123',
      status: 'pending',
      payload: { intakeFields: ['email'] },
    });

    expect(ticket).toMatchObject({
      sessionId: session.id,
      requestRef: 'req_ticket',
      provider: 'null-ticket-provider',
      providerReference: 'ticket_local_123',
      status: 'pending',
      payload: { intakeFields: ['email'] },
    });
    expect(repository.ticketHandoffs).toEqual([ticket]);
  });

  it('fails closed when persisted JSON is corrupt or not an object', () => {
    expect(() => parseJsonObjectForRepository('not json', 'AuditEvent.payload')).toThrow(
      ChatRepositoryError,
    );
    expect(() => parseJsonObjectForRepository('[]', 'AuditEvent.payload')).toThrow(
      ChatRepositoryError,
    );
  });
});
