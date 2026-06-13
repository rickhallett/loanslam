import { z } from 'zod';

/**
 * `serving_mode` is the KB's per-item disposition and the spine of the
 * answerable-vs-route gate (see README + product brief §12):
 *  - answer                    safe public/general info; carries answer_text
 *  - handoff_account_specific  needs the customer's real account data -> team
 *  - route_vulnerability       distress/difficulty signal -> human
 *  - excluded                  public but must not be served (e.g. APR) -> safe route
 */
export const servingModeSchema = z.enum([
  'answer',
  'handoff_account_specific',
  'route_vulnerability',
  'excluded',
]);
export type ServingMode = z.infer<typeof servingModeSchema>;

export const kbLinkSchema = z.object({
  label: z.string(),
  href: z.string(),
});
export type KbLink = z.infer<typeof kbLinkSchema>;

/** One approved knowledge-base item (mirrors loanslam-synthetic-kb.json). */
export const kbItemSchema = z.object({
  id: z.string(),
  section: z.string(),
  intent: z.string().nullable().optional(),
  question: z.string(),
  question_variants: z.array(z.string()).default([]),
  serving_mode: servingModeSchema,
  answer_text: z.string().nullable().default(null),
  links: z.array(kbLinkSchema).default([]),
  route_reason: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  source_type: z.string().optional(),
  status: z.string().optional(),
});
export type KbItem = z.infer<typeof kbItemSchema>;

/**
 * A single retrieval hit with its match score. The retrieval adapter MUST
 * return scored hits (not bare text) so the grounding gate has something to act
 * on — see architecture.md "grounding-adapter contract".
 */
export const retrievalHitSchema = z.object({
  itemId: z.string(),
  question: z.string(),
  servingMode: servingModeSchema,
  score: z.number().min(0).max(1),
  answerText: z.string().nullable(),
  links: z.array(kbLinkSchema).default([]),
  routeReason: z.string().nullable().default(null),
});
export type RetrievalHit = z.infer<typeof retrievalHitSchema>;

/**
 * The grounding signal the router decides on. `grounded` means: a hit cleared
 * the score threshold AND its serving_mode permits an answer. Anything else
 * routes safely.
 */
export const groundingSignalSchema = z.object({
  grounded: z.boolean(),
  topScore: z.number().min(0).max(1),
  /** serving_mode of the top hit, or null when nothing matched at all. */
  topServingMode: servingModeSchema.nullable(),
  hits: z.array(retrievalHitSchema),
});
export type GroundingSignal = z.infer<typeof groundingSignalSchema>;

/** Citation surfaced to the audit trail (and optionally the customer copy). */
export const citationSchema = z.object({
  itemId: z.string(),
  question: z.string(),
  score: z.number().min(0).max(1),
});
export type Citation = z.infer<typeof citationSchema>;
