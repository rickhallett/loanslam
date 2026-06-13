import { z } from 'zod';

import { groundingCitationSchema } from './provider.js';

export const conversationStateSchema = z.enum([
  'active',
  'collecting',
  'awaiting_handoff_intake',
  'handoff_pending',
  'safe_fallback',
]);

export type ConversationState = z.infer<typeof conversationStateSchema>;

export const chatMessageRoleSchema = z.enum(['user', 'assistant']);

export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;

export const chatMessageSchema = z
  .object({
    id: z.string().min(1),
    role: chatMessageRoleSchema,
    text: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    citations: z.array(groundingCitationSchema).optional(),
    reasonCode: z.string().min(1).optional(),
  })
  .strict();

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const intakeFieldNameSchema = z.enum([
  'name',
  'dob',
  'address',
  'phone',
  'email',
  'situationalContext',
]);

export type IntakeFieldName = z.infer<typeof intakeFieldNameSchema>;

export const intakeFieldInputTypeSchema = z.enum(['text', 'date', 'tel', 'email', 'textarea']);

export type IntakeFieldInputType = z.infer<typeof intakeFieldInputTypeSchema>;

export const intakeFieldSchema = z
  .object({
    name: intakeFieldNameSchema,
    label: z.string().min(1),
    inputType: intakeFieldInputTypeSchema,
    required: z.boolean(),
  })
  .strict();

export type IntakeField = z.infer<typeof intakeFieldSchema>;

export const handoffIntakeFormSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    submitLabel: z.string().min(1),
    fields: z.array(intakeFieldSchema).min(1),
  })
  .strict()
  .superRefine((form, context) => {
    const fieldNames = new Set<IntakeFieldName>();

    for (const [index, field] of form.fields.entries()) {
      if (fieldNames.has(field.name)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate intake field: ${field.name}`,
          path: ['fields', index, 'name'],
        });
      }

      fieldNames.add(field.name);
    }
  });

export type HandoffIntakeForm = z.infer<typeof handoffIntakeFormSchema>;

const intakeAnswersSchema = z
  .object({
    name: z.string().trim().min(1),
    dob: z.string().trim().min(1),
    address: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    email: z.string().trim().email(),
    situationalContext: z.string().trim().min(1),
  })
  .strict();

export const intakeSubmitRequestSchema = z
  .object({
    clientRequestId: z.string().min(1),
    intake: intakeAnswersSchema,
  })
  .strict();

export type IntakeSubmitRequest = z.infer<typeof intakeSubmitRequestSchema>;

export const sendMessageRequestSchema = z
  .object({
    clientMessageId: z.string().min(1),
    text: z.string().trim().min(1).max(4000),
  })
  .strict();

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const resetRequestSchema = z
  .object({
    clientRequestId: z.string().min(1),
    reason: z.enum(['user_requested', 'session_expired']).optional(),
  })
  .strict();

export type ResetRequest = z.infer<typeof resetRequestSchema>;

export const chatAuditSchema = z
  .object({
    events: z.array(z.string().min(1)),
    reasonCodes: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type ChatAudit = z.infer<typeof chatAuditSchema>;

const chatResponseBaseSchema = z
  .object({
    conversationRef: z.string().min(1),
    requestRef: z.string().min(1),
    correlationRef: z.string().min(1),
    csrfToken: z.string().min(1),
    messages: z.array(chatMessageSchema),
    audit: chatAuditSchema,
  })
  .strict();

const chatResponseWithoutFormSchema = chatResponseBaseSchema
  .extend({
    state: z.enum(['active', 'collecting', 'handoff_pending', 'safe_fallback']),
    form: z.never().optional(),
  })
  .strict();

const chatResponseWithFormSchema = chatResponseBaseSchema
  .extend({
    state: z.literal('awaiting_handoff_intake'),
    form: handoffIntakeFormSchema,
  })
  .strict();

export const chatResponseSchema = z.discriminatedUnion('state', [
  chatResponseWithoutFormSchema,
  chatResponseWithFormSchema,
]);

export type ChatResponse = z.infer<typeof chatResponseSchema>;

export const createSessionResponseSchema = chatResponseSchema;

export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;
