import type { AppConfig } from '../config/env.js';
import type { Logger } from '../config/logger.js';
import type { Repositories } from '../ports/repository.port.js';
import { createMemoryRepositories } from './memory/index.js';
import { createPrismaRepositories } from './prisma/index.js';

/**
 * Persistence entry point. Selects the implementation behind the `Repositories`
 * seam from `config.persistence`:
 *   - 'memory'    (default): file-backed in-memory store, zero-friction demo.
 *   - 'sqlserver':           Prisma/SQL Server, the production target.
 *
 * Async because the Prisma path loads its client via dynamic import; the memory
 * path resolves immediately.
 */
export async function createRepositories(
  config: AppConfig,
  logger: Logger,
): Promise<Repositories> {
  switch (config.persistence) {
    case 'sqlserver':
      return createPrismaRepositories(config, logger);
    case 'memory':
    default:
      return createMemoryRepositories(config, logger);
  }
}

export { createMemoryRepositories } from './memory/index.js';
export { createPrismaRepositories } from './prisma/index.js';
