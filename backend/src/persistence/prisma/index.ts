import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type { Repositories } from '../../ports/repository.port.js';
import {
  loadPrismaClient,
  PrismaSessionStore,
  PrismaTranscriptStore,
  PrismaAuditStore,
  PrismaIdempotencyStore,
} from './prisma-store.js';

/**
 * Build the Prisma / SQL Server repositories — the production target.
 *
 * Requires `npm run prisma:generate` and a SQL Server `DATABASE_URL`. The
 * generated client is loaded through a dynamic-import boundary, so this module
 * still compiles in a fresh checkout where the client has not been generated.
 */
export async function createPrismaRepositories(
  config: AppConfig,
  logger: Logger,
): Promise<Repositories> {
  logger.info('persistence: using Prisma/SQL Server store');
  const db = await loadPrismaClient(config.databaseUrl);
  return {
    sessions: new PrismaSessionStore(db),
    transcripts: new PrismaTranscriptStore(db),
    audit: new PrismaAuditStore(db),
    idempotency: new PrismaIdempotencyStore(db),
  };
}
