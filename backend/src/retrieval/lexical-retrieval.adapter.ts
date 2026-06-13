import type {
  GroundingSignal,
  KbItem,
  RetrievalHit,
  ServingMode,
} from '@loanslam/contracts';
import type { RetrievalAdapter, RetrieveOptions } from '../ports/retrieval.port.js';
import { buildIdf, scoreItem, tokenize, type IdfMap } from './scoring.js';

const DEFAULT_TOP_K = 3;

/**
 * Lexical retrieval over the approved KB. Scores every item against the query
 * with the pure scorer, returns the top hits, and computes the grounding signal
 * the router decides on. It returns SCORED hits (not bare text) so the gate has
 * something to act on — architecture.md "grounding-adapter contract".
 *
 * Grounding is deliberately strict: an answer is only `grounded` when the top
 * hit clears the threshold AND its serving_mode is 'answer'. Account-specific,
 * vulnerability, and excluded items surface their serving_mode for the router
 * but never count as a groundable answer here.
 */
export class LexicalRetrievalAdapter implements RetrievalAdapter {
  private readonly idf: IdfMap;

  constructor(
    private readonly kb: KbItem[],
    private readonly threshold: number,
  ) {
    // IDF is computed once over the corpus so rare terms dominate scoring.
    this.idf = buildIdf(kb);
  }

  async retrieve(query: string, opts?: RetrieveOptions): Promise<GroundingSignal> {
    const topK = opts?.topK ?? DEFAULT_TOP_K;
    const queryTokens = tokenize(query);

    const scored: RetrievalHit[] = this.kb.map((item) => ({
      itemId: item.id,
      question: item.question,
      servingMode: item.serving_mode,
      score: scoreItem(queryTokens, item, this.idf),
      answerText: item.answer_text,
      links: item.links,
      routeReason: item.route_reason,
    }));

    // Sort by score descending. Stable enough for a deterministic top hit; ties
    // keep KB order, which is fine for this lexical pass.
    scored.sort((a, b) => b.score - a.score);

    const hits = topK > 0 ? scored.slice(0, topK) : [];

    const top = hits[0];
    // A top hit only counts if it actually matched something. An all-zero board
    // (gibberish / empty query) has no meaningful serving mode.
    const topScore = top !== undefined ? top.score : 0;
    const topServingMode: ServingMode | null =
      top !== undefined && top.score > 0 ? top.servingMode : null;

    const grounded = topScore >= this.threshold && topServingMode === 'answer';

    return { grounded, topScore, topServingMode, hits };
  }
}

/** Construct the production lexical adapter against a loaded KB. */
export function createLexicalRetrievalAdapter(
  kb: KbItem[],
  threshold: number,
): RetrievalAdapter {
  return new LexicalRetrievalAdapter(kb, threshold);
}
