import { describe, expect, it } from 'vitest';

import { envSchema } from './env.js';

describe('envSchema', () => {
  it('rejects the public local session secret in production', () => {
    const parsed = envSchema.safeParse({
      NODE_ENV: 'production',
      SESSION_SECRET: 'local-dev-session-secret-change-me',
    });

    expect(parsed.success).toBe(false);
  });
});
