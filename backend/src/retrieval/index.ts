import type { KbItem } from '@loanslam/contracts';
import type { RetrievalAdapter } from '../ports/retrieval.port.js';
import { createLexicalRetrievalAdapter } from './lexical-retrieval.adapter.js';

export { LexicalRetrievalAdapter, createLexicalRetrievalAdapter } from './lexical-retrieval.adapter.js';
export { scoreItem, tokenize } from './scoring.js';

/**
 * Composition entry point for the retrieval module. Builds the production
 * lexical adapter; callers inject the loaded KB and grounding threshold from
 * config so the seam stays substitutable in tests.
 */
export function createRetrievalAdapter(kb: KbItem[], threshold: number): RetrievalAdapter {
  return createLexicalRetrievalAdapter(kb, threshold);
}
