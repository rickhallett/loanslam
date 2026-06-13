import { z } from 'zod';

/**
 * Uniform transport envelope. `success` describes the HTTP/transport outcome
 * only — a fallback, handoff, or refusal is a *successful* call whose business
 * outcome lives inside `responseObject`. This mirrors the reference repo's
 * `ServiceResponse` and backs the brief's "frontend renders state, backend owns
 * decisions" principle.
 */
export interface ServiceResponse<T> {
  success: boolean;
  message: string;
  responseObject: T | null;
  statusCode: number;
}

/** Build a Zod schema for a ServiceResponse wrapping `inner`. */
export const serviceResponseSchema = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    success: z.boolean(),
    message: z.string(),
    responseObject: inner.nullable(),
    statusCode: z.number().int(),
  });
