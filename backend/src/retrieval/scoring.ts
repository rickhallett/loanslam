import type { KbItem } from '@loanslam/contracts';

/**
 * Pure lexical scoring for the retrieval adapter. No I/O, no model calls — just
 * deterministic token-overlap maths so the grounding gate has a stable,
 * testable score to act on (architecture.md "grounding-adapter contract").
 *
 * The scorer is intentionally simple: it must rank a near-verbatim question or
 * variant highly and an unrelated query near zero. It is NOT a semantic model;
 * it never invents facts, it only measures word overlap against approved items.
 */

/**
 * A small, deliberately conservative stopword set. We strip only high-frequency
 * function words that carry no retrieval signal. Domain words ("loan", "pay",
 * "balance") are never stopped — they are exactly what discriminates items.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'do',
  'does',
  'for',
  'from',
  'have',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'what',
  'when',
  'will',
  'with',
  'you',
  'your',
]);

/**
 * Lowercase, strip punctuation, split on whitespace, drop stopwords and empties.
 * Apostrophes are removed (not split on) so "what's" -> "whats" and "can't" ->
 * "cant" stay as single discriminating tokens rather than fragmenting.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

/**
 * Field assist weights. The best question/variant overlap is the primary signal
 * and on its own can reach 1.0 (a verbatim question/variant must score high).
 * Tags and intent add a capped bonus that lifts partial-overlap queries but can
 * never, alone, push an unrelated query over the grounding threshold.
 */
const ASSIST_TAGS = 0.25;
const ASSIST_INTENT = 0.25;

function toTokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/** All distinct tokens an item contributes (question + variants + tags + intent). */
function itemTokens(item: KbItem): Set<string> {
  const set = new Set<string>(tokenize(item.question));
  for (const v of item.question_variants) for (const t of tokenize(v)) set.add(t);
  for (const t of tokenize(item.tags.join(' '))) set.add(t);
  if (item.intent) for (const t of tokenize(item.intent.replace(/-/g, ' '))) set.add(t);
  return set;
}

/**
 * Inverse document frequency over the KB. Rare, discriminating terms (e.g.
 * "apr", "settlement") get a high weight; common ones ("pay", "loan", "get")
 * approach 1. This is what stops an incidental overlap on a frequent word from
 * tying with a near-verbatim topic match — the precision fix that keeps a rate
 * question off the vulnerability route. Smoothed so every weight is >= 1 and an
 * out-of-corpus token gets the maximum weight.
 */
export type IdfMap = ReadonlyMap<string, number>;

export function buildIdf(items: readonly KbItem[]): Map<string, number> {
  const n = items.length;
  const df = new Map<string, number>();
  for (const item of items) {
    for (const token of itemTokens(item)) df.set(token, (df.get(token) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [token, count] of df) idf.set(token, Math.log((n + 1) / (count + 1)) + 1);
  return idf;
}

/** Weight of a token: its IDF, or the out-of-corpus default (highest) when unknown. */
function weightOf(token: string, idf: IdfMap | null, defaultWeight: number): number {
  if (idf === null) return 1;
  return idf.get(token) ?? defaultWeight;
}

/**
 * IDF-weighted overlap of the query against a field: the summed weight of query
 * tokens that appear in the field, over the summed weight of all query tokens.
 * With `idf === null` every weight is 1, i.e. the plain token-fraction overlap
 * (used when a caller scores without corpus context, e.g. unit tests). Returns 0
 * for an empty query.
 */
function overlap(
  queryTokens: ReadonlySet<string>,
  fieldTokens: ReadonlySet<string>,
  idf: IdfMap | null,
  defaultWeight: number,
): number {
  if (queryTokens.size === 0) return 0;
  let matched = 0;
  let total = 0;
  for (const token of queryTokens) {
    const w = weightOf(token, idf, defaultWeight);
    total += w;
    if (fieldTokens.has(token)) matched += w;
  }
  return total === 0 ? 0 : matched / total;
}

/**
 * Weighted F1 of query-precision (how much of the query the field covers) and
 * field-recall (how much of the field the query covers). Recall is the guard
 * against thin-query mis-grounding: a single common word fully covers the query
 * (precision 1) but barely covers a long item (low recall), so its F1 stays low
 * and cannot reach the grounding threshold. A near-verbatim question/variant
 * covers both directions and scores ~1.
 */
function fieldScore(
  queryTokens: ReadonlySet<string>,
  fieldTokens: ReadonlySet<string>,
  idf: IdfMap | null,
  defaultWeight: number,
): number {
  if (queryTokens.size === 0 || fieldTokens.size === 0) return 0;
  let matched = 0;
  let queryTotal = 0;
  for (const token of queryTokens) {
    const w = weightOf(token, idf, defaultWeight);
    queryTotal += w;
    if (fieldTokens.has(token)) matched += w;
  }
  if (matched === 0) return 0;
  let fieldTotal = 0;
  for (const token of fieldTokens) fieldTotal += weightOf(token, idf, defaultWeight);
  const precision = queryTotal === 0 ? 0 : matched / queryTotal;
  const recall = fieldTotal === 0 ? 0 : matched / fieldTotal;
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

/**
 * Score one KB item against pre-tokenized query tokens. Returns a value in
 * [0, 1]. The question and the BEST-matching variant carry full weight; tags and
 * intent contribute a smaller assist. The result is the weighted combination
 * normalised by the maximum achievable weight, so a verbatim question or variant
 * scores ~1 and an unrelated query scores ~0.
 */
export function scoreItem(
  queryTokens: readonly string[],
  item: KbItem,
  idf: IdfMap | null = null,
): number {
  const querySet = new Set(queryTokens);
  if (querySet.size === 0) return 0;

  // Out-of-corpus tokens get the maximum observed weight (they are maximally
  // rare). This keeps gibberish queries from scoring via a lone common word.
  let defaultWeight = 1;
  if (idf !== null) for (const w of idf.values()) if (w > defaultWeight) defaultWeight = w;

  // Question/variants use F1 (precision AND recall) so a thin query that covers
  // only a fraction of the item cannot score as a full match.
  const questionScore = fieldScore(querySet, toTokenSet(item.question), idf, defaultWeight);

  let bestVariantScore = 0;
  for (const variant of item.question_variants) {
    const variantScore = fieldScore(querySet, toTokenSet(variant), idf, defaultWeight);
    if (variantScore > bestVariantScore) bestVariantScore = variantScore;
  }

  const tagsScore = overlap(querySet, toTokenSet(item.tags.join(' ')), idf, defaultWeight);
  const intentScore = item.intent
    ? overlap(querySet, toTokenSet(item.intent.replace(/-/g, ' ')), idf, defaultWeight)
    : 0;

  // The strongest of question/variant carries the primary weight so that a near
  // verbatim variant scores as high as a verbatim question — we don't penalise
  // the customer for paraphrasing.
  const bestPrimary = Math.max(questionScore, bestVariantScore);

  // Primary overlap is the floor of the score (a verbatim match scores ~1).
  // Tags/intent only add a fractional assist proportional to how well the
  // primary already matched, so they can't manufacture grounding on their own.
  const assist = (tagsScore * ASSIST_TAGS + intentScore * ASSIST_INTENT) * bestPrimary;
  const score = bestPrimary + assist * (1 - bestPrimary);

  // Clamp defensively; the maths above already keeps this in range.
  return Math.max(0, Math.min(1, score));
}
