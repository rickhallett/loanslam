import { describe, expect, it } from 'vitest';

import {
  chatMessageSchema,
  chatResponseSchema,
  classifierResultSchema,
  handoffIntakeFormSchema,
  intakeSubmitRequestSchema,
  retrievalResultSchema,
  sendMessageRequestSchema,
  serviceResponseSchema,
  ticketResultSchema,
  vulnerabilityResultSchema,
} from './index.js';

const createdAt = '2026-06-13T12:00:00.000Z';

const message = {
  id: 'msg_123',
  role: 'assistant',
  text: 'We can help with that.',
  createdAt,
};

const audit = {
  events: ['audit_inbound_123', 'audit_outbound_123'],
  reasonCodes: ['grounded_answer'],
};

const form = {
  id: 'handoff-intake',
  title: 'Support handoff',
  submitLabel: 'Send details',
  fields: [
    { name: 'name', label: 'Name', inputType: 'text', required: true },
    { name: 'dob', label: 'Date of birth', inputType: 'date', required: true },
    { name: 'address', label: 'Address', inputType: 'textarea', required: true },
    { name: 'phone', label: 'Phone', inputType: 'tel', required: true },
    { name: 'email', label: 'Email', inputType: 'email', required: true },
    {
      name: 'situationalContext',
      label: 'How can the support team help?',
      inputType: 'textarea',
      required: true,
    },
  ],
};

const activeResponse = {
  conversationRef: 'conv_123',
  requestRef: 'req_123',
  correlationRef: 'corr_123',
  csrfToken: 'csrf_123',
  state: 'active',
  messages: [message],
  audit,
};

describe('chat contract schemas', () => {
  it('rejects invalid message payloads and raw session ids', () => {
    expect(
      chatMessageSchema.safeParse({
        ...message,
        role: 'system',
      }).success,
    ).toBe(false);

    expect(
      sendMessageRequestSchema.safeParse({
        clientMessageId: 'client_123',
        text: '   ',
      }).success,
    ).toBe(false);

    expect(
      sendMessageRequestSchema.safeParse({
        clientMessageId: 'client_123',
        text: 'What happens next?',
        sessionId: 'raw-session-id',
      }).success,
    ).toBe(false);
  });

  it('accepts only approved handoff intake form fields', () => {
    expect(handoffIntakeFormSchema.safeParse(form).success).toBe(true);

    expect(
      handoffIntakeFormSchema.safeParse({
        ...form,
        fields: [
          ...form.fields,
          { name: 'sortCode', label: 'Sort code', inputType: 'text', required: true },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires intake submissions to match the rendered required field set', () => {
    expect(
      intakeSubmitRequestSchema.safeParse({
        clientRequestId: 'client_req_123',
        intake: {
          name: 'Alex Customer',
          dob: '1990-01-31',
          address: '1 High Street, London',
          phone: '+447700900123',
          email: 'alex@example.com',
          situationalContext: 'I need someone to look at my application.',
        },
      }).success,
    ).toBe(true);

    expect(
      intakeSubmitRequestSchema.safeParse({
        clientRequestId: 'client_req_123',
        intake: {
          name: 'Alex Customer',
          situationalContext: 'I need someone to look at my application.',
        },
      }).success,
    ).toBe(false);
  });

  it('uses state to discriminate whether a response must carry a form', () => {
    expect(chatResponseSchema.safeParse(activeResponse).success).toBe(true);

    expect(
      chatResponseSchema.safeParse({
        ...activeResponse,
        form,
      }).success,
    ).toBe(false);

    expect(
      chatResponseSchema.safeParse({
        ...activeResponse,
        state: 'awaiting_handoff_intake',
        form,
      }).success,
    ).toBe(true);

    expect(
      chatResponseSchema.safeParse({
        ...activeResponse,
        state: 'awaiting_handoff_intake',
      }).success,
    ).toBe(false);
  });

  it('preserves status code and response object through ServiceResponse', () => {
    const schema = serviceResponseSchema(chatResponseSchema);

    const parsed = schema.parse({
      success: true,
      message: 'Session created',
      statusCode: 201,
      responseObject: activeResponse,
    });

    expect(parsed.statusCode).toBe(201);
    expect(parsed.responseObject.conversationRef).toBe('conv_123');
  });
});

describe('provider contract schemas', () => {
  it('validates provider results used by chat routing', () => {
    expect(
      vulnerabilityResultSchema.safeParse({
        isVulnerable: true,
        routeToHuman: true,
        confidence: 0.91,
        signals: ['financial_difficulty'],
        reasonCode: 'vulnerability_financial_difficulty',
      }).success,
    ).toBe(true);

    expect(
      classifierResultSchema.safeParse({
        action: 'answer',
        confidence: 0.84,
        reasonCode: 'general_process_question',
        requiresGrounding: true,
      }).success,
    ).toBe(true);

    expect(
      retrievalResultSchema.safeParse({
        answerable: true,
        grounded: true,
        citations: [
          {
            sourceId: 'kb_1',
            title: 'Loan process FAQ',
            excerpt: 'Customers can ask general process questions.',
            score: 0.76,
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      ticketResultSchema.safeParse({
        provider: 'null-ticket-provider',
        providerReference: 'ticket_123',
        status: 'pending',
      }).success,
    ).toBe(true);

    expect(
      classifierResultSchema.safeParse({
        action: 'refund_customer',
        confidence: 0.84,
        reasonCode: 'unsupported_action',
        requiresGrounding: true,
      }).success,
    ).toBe(false);

    expect(
      vulnerabilityResultSchema.safeParse({
        isVulnerable: false,
        routeToHuman: false,
        confidence: 1.2,
        signals: [],
      }).success,
    ).toBe(false);

    expect(
      retrievalResultSchema.safeParse({
        answerable: true,
        grounded: true,
        citations: [
          {
            sourceId: 'kb_1',
            title: 'Loan process FAQ',
            url: 'not-a-url',
          },
        ],
      }).success,
    ).toBe(false);
  });
});
