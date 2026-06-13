import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type { Repositories } from '../../ports/repository.port.js';
import {
  ensureDataDir,
  FileSessionStore,
  FileTranscriptStore,
  FileAuditStore,
  FileIdempotencyStore,
} from './file-store.js';

/**
 * Build the file-backed memory repositories — the zero-friction demo default.
 * Creates `config.dataDir` if missing, then loads any existing files so the
 * audit/transcript/session state survives a restart.
 */
export function createMemoryRepositories(config: AppConfig, logger: Logger): Repositories {
  const dir = ensureDataDir(config.dataDir);
  logger.info({ dataDir: dir }, 'persistence: using file-backed memory store');
  return {
    sessions: new FileSessionStore(dir, logger),
    transcripts: new FileTranscriptStore(dir, logger),
    audit: new FileAuditStore(dir, logger),
    idempotency: new FileIdempotencyStore(dir, logger),
  };
}
