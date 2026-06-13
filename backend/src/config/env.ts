import { resolve } from 'node:path';

import { config } from 'dotenv';
import { z } from 'zod';

config({ path: resolve(import.meta.dirname, '../../../.env') });
config({ path: resolve(import.meta.dirname, '../../.env') });

const optionalNonEmptyString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const localSessionSecret = 'local-dev-session-secret-change-me';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4010),
    DATABASE_URL: optionalNonEmptyString,
    WIDGET_ORIGIN: z.string().url().default('http://localhost:5173'),
    API_BASE_URL: z.string().url().default('http://localhost:4010'),
    SESSION_COOKIE_NAME: z.string().min(1).default('loanslam_sid'),
    SESSION_SECRET: z.string().min(16).default(localSessionSecret),
    CSRF_COOKIE_NAME: z.string().min(1).default('loanslam_csrf'),
    OPENAI_API_KEY: optionalNonEmptyString,
    OPENAI_MODEL: z.string().min(1).default('gpt-5.5'),
    OPENAI_VECTOR_STORE_ID: optionalNonEmptyString,
    OPENAI_VECTOR_STORE_NAME: z.string().min(1).default('loanslam-support-kb'),
    OPENAI_RAG_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.45),
    TICKET_WEBHOOK_URL: optionalNonEmptyString,
    TICKET_WEBHOOK_SECRET: optionalNonEmptyString,
    ALLOW_FAKE_PROVIDERS: booleanString,
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.SESSION_SECRET === localSessionSecret) {
      context.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'SESSION_SECRET must be set to a private value in production',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse(process.env);
