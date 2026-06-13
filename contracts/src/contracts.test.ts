import { describe, expect, it } from 'vitest';
import {
  auditEventSchema,
  chatTurnResponseSchema,
  kbItemSchema,
  messageRequestSchema,
  reasonCodeSchema,
  replySchema,
  serviceResponseSchema,
  servingModeSchema,
} from './index.js';
import { z } from 'zod';

describe('ServiceResponse envelope', () => {
  it('wraps an inner schema and allows a null responseObject', () => {
    const schema = serviceResponseSchema(z.object({ ok: z.boolean() }));
    expect(schema.parse({ success: true, message: 'OK', responseObject: { ok: true }, statusCode: 200 }).success).toBe(true);
    expect(schema.parse({ success: false, message: 'bad', responseObject: null, statusCode: 400 }).responseObject).toBeNull();
  });
});

describe('reply discriminated union', () => {
  it('requires at least one citation on an answer reply', () => {
    expect(() =>
      replySchema.parse({ mode: 'answer', text: 'hi', citations: [], links: [] }),
    ).toThrow();
    const ok = replySchema.parse({
      mode: 'answer',
      text: 'You can borrow £1,000 to £5,000.',
      citations: [{ itemId: 'how-much-can-i-borrow', question: 'How much can I borrow?', score: 1 }],
      links: [],
    });
    expect(ok.mode).toBe('answer');
  });

  it('parses an intake_request reply carrying a form config', () => {
    const reply = replySchema.parse({
      mode: 'intake_request',
      text: 'I need a few details.',
      form: {
        formId: 'account-handoff',
        title: 'Pass to our team',
        description: 'We never ask for bank or card details here.',
        fields: [{ name: 'full_name', label: 'Full name', type: 'text', required: true }],
        submitLabel: 'Send',
      },
    });
    expect(reply.mode).toBe('intake_request');
  });

  it('rejects an unknown reply mode', () => {
    expect(() => replySchema.parse({ mode: 'nope', text: 'x' })).toThrow();
  });
});

describe('KB + serving mode', () => {
  it('accepts the four serving modes and rejects others', () => {
    for (const m of ['answer', 'handoff_account_specific', 'route_vulnerability', 'excluded']) {
      expect(servingModeSchema.parse(m)).toBe(m);
    }
    expect(() => servingModeSchema.parse('made_up')).toThrow();
  });

  it('parses a minimal KB item with defaults', () => {
    const item = kbItemSchema.parse({
      id: 'x',
      section: 's',
      question: 'q?',
      serving_mode: 'answer',
    });
    expect(item.question_variants).toEqual([]);
    expect(item.answer_text).toBeNull();
  });
});

describe('request + audit schemas', () => {
  it('enforces message length bounds', () => {
    expect(() => messageRequestSchema.parse({ clientMessageId: 'a', text: '' })).toThrow();
    expect(messageRequestSchema.parse({ clientMessageId: 'a', text: 'hello' }).text).toBe('hello');
  });

  it('validates an audit event shape', () => {
    const ev = auditEventSchema.parse({
      id: 'evt_1',
      conversationRef: 'conv_1',
      requestRef: 'req_1',
      type: 'routing_decision',
      ts: '2026-06-13T00:00:00.000Z',
      policyVersion: 'poc',
    });
    expect(ev.reasonCode).toBeNull();
    expect(ev.payload).toEqual({});
  });

  it('accepts the slot-collection reason codes (journey modelling)', () => {
    for (const code of [
      'slot_asked',
      'slot_filled',
      'slot_corrected',
      'slot_refused',
      'collection_confirmed',
      'budget_exhausted',
    ]) {
      expect(reasonCodeSchema.parse(code)).toBe(code);
    }
  });

  it('accepts the extraction and collection-step audit event types', () => {
    for (const type of ['extraction', 'collection_step']) {
      const ev = auditEventSchema.parse({
        id: 'evt_1',
        conversationRef: 'conv_1',
        requestRef: 'req_1',
        type,
        ts: '2026-06-13T00:00:00.000Z',
        policyVersion: 'poc',
      });
      expect(ev.type).toBe(type);
    }
  });

  it('round-trips a chat turn response', () => {
    const parsed = chatTurnResponseSchema.parse({
      conversationRef: 'conv_1',
      requestRef: 'req_1',
      state: { phase: 'anonymous_active', vulnerabilityFlagged: false, awaitingForm: false, goalSummary: null },
      reply: { mode: 'clarify', text: 'How can I help?' },
    });
    expect(parsed.reply.mode).toBe('clarify');
  });
});
