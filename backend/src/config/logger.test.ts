import { describe, expect, it } from 'vitest';

import { createLogger } from './logger.js';

describe('logger', () => {
  it('redacts credentials from top-level fields and error messages', () => {
    const lines: string[] = [];
    const testLogger = createLogger({
      write(line: string) {
        lines.push(line);
      },
    });

    testLogger.error({
      DATABASE_URL:
        'sqlserver://localhost:1434;database=loanslam;user=sa;password=LocalDev!Passw0rd;trustServerCertificate=true',
      OPENAI_API_KEY: 'sk-secret',
      TICKET_WEBHOOK_SECRET: 'webhook-secret',
      error: {
        message: 'Login failed for sqlserver://localhost:1434;user=sa;password=LocalDev!Passw0rd',
      },
    });

    const output = lines.join('\n');

    expect(output).toContain('[redacted]');
    expect(output).not.toContain('LocalDev!Passw0rd');
    expect(output).not.toContain('sk-secret');
    expect(output).not.toContain('webhook-secret');
  });
});
