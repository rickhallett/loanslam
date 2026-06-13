import { z } from 'zod';

export const groundingCitationSchema = z
  .object({
    sourceId: z.string().min(1),
    title: z.string().min(1),
    excerpt: z.string().min(1).optional(),
    url: z.string().url().optional(),
    score: z.number().min(0).max(1).optional(),
  })
  .strict();

export type GroundingCitation = z.infer<typeof groundingCitationSchema>;

export const vulnerabilityResultSchema = z
  .object({
    isVulnerable: z.boolean(),
    routeToHuman: z.boolean(),
    confidence: z.number().min(0).max(1),
    signals: z.array(z.string().min(1)),
    reasonCode: z.string().min(1).optional(),
  })
  .strict();

export type VulnerabilityResult = z.infer<typeof vulnerabilityResultSchema>;

export const classifierActionSchema = z.enum([
  'answer',
  'collect',
  'request_handoff_intake',
  'create_ticket',
  'safe_fallback',
  'refuse',
  'escalate',
]);

export type ClassifierAction = z.infer<typeof classifierActionSchema>;

export const classifierResultSchema = z
  .object({
    action: classifierActionSchema,
    confidence: z.number().min(0).max(1),
    reasonCode: z.string().min(1),
    requiresGrounding: z.boolean(),
  })
  .strict();

export type ClassifierResult = z.infer<typeof classifierResultSchema>;

export const retrievalResultSchema = z
  .object({
    answerable: z.boolean(),
    grounded: z.boolean(),
    citations: z.array(groundingCitationSchema),
    context: z.string().min(1).optional(),
    score: z.number().min(0).max(1).optional(),
    reasonCode: z.string().min(1).optional(),
  })
  .strict();

export type RetrievalResult = z.infer<typeof retrievalResultSchema>;

export const ticketResultSchema = z
  .object({
    provider: z.string().min(1),
    providerReference: z.string().min(1),
    status: z.enum(['pending', 'submitted', 'failed']),
    reasonCode: z.string().min(1).optional(),
  })
  .strict();

export type TicketResult = z.infer<typeof ticketResultSchema>;
