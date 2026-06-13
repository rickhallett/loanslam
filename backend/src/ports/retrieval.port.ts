import type { GroundingSignal } from '@loanslam/contracts';

/**
 * Retrieval boundary. MUST return a scored grounding signal (not bare text) so
 * the router can decide answerable-vs-handoff — architecture.md
 * "grounding-adapter contract".
 */
export interface RetrievalAdapter {
  /** Retrieve the best-matching approved KB items for a query, with scores. */
  retrieve(query: string, opts?: RetrieveOptions): Promise<GroundingSignal>;
}

export interface RetrieveOptions {
  /** Max hits to return (default small, e.g. 3). */
  topK?: number;
}
