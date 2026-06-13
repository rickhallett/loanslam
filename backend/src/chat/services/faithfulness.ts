/**
 * Faithfulness gate for model-phrased answers. A grounded `answer` may only
 * rephrase APPROVED text for tone — it must never introduce a fact the approved
 * text does not contain (brief §11, §16: do not invent amounts, dates, rates,
 * SLAs, policy). We cannot prove semantic faithfulness cheaply, but we CAN
 * cheaply catch the highest-risk injections: a fabricated currency amount,
 * percentage/rate, link, or multi-digit figure. Any such "fact token" present in
 * the phrasing but absent from the approved text means the phrasing is unsafe,
 * and the caller routes to fallback rather than emit an unverified regulated
 * fact.
 *
 * Single-digit numbers are deliberately NOT treated as fact tokens, so a faithful
 * paraphrase like "twice" -> "2 times" is not falsely rejected. Multi-digit
 * figures (24, 1,000, 93.8, percentages) and currency/links ARE checked.
 */

function factTokens(text: string): Set<string> {
  const t = text.toLowerCase();
  const set = new Set<string>();

  // Currency amounts: £1,000 -> cur:1000
  for (const m of t.match(/£\s?\d[\d,]*(?:\.\d+)?/g) ?? []) {
    set.add('cur:' + m.replace(/[£,\s]/g, ''));
  }
  // Percentages / rates: 22.0% -> pct:22.0%
  for (const m of t.match(/\d+(?:\.\d+)?\s?%/g) ?? []) {
    set.add('pct:' + m.replace(/\s/g, ''));
  }
  // Links: strip trailing punctuation.
  for (const m of t.match(/https?:\/\/[^\s)]+|www\.[^\s)]+/g) ?? []) {
    set.add('url:' + m.replace(/[).,;]+$/, ''));
  }
  // Multi-digit figures (>= 2 significant digits): 24, 1000, 93.8.
  for (const m of t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
    const digits = m.replace(/[,\s]/g, '');
    if (digits.replace(/\D/g, '').length >= 2) set.add('num:' + digits);
  }
  return set;
}

/**
 * True if `phrased` introduces no currency, percentage, link, or multi-digit
 * figure absent from `approved`, and is not implausibly longer than the approved
 * text. A false result means: do not serve this as a grounded answer.
 */
export function isFaithful(approved: string, phrased: string): boolean {
  // A rambling answer many times longer than the source is suspicious on its own.
  if (phrased.length > approved.length * 3 + 240) return false;

  const approvedFacts = factTokens(approved);
  for (const token of factTokens(phrased)) {
    if (!approvedFacts.has(token)) return false;
  }
  return true;
}
