import type { CorpusItem, RetrievedMatch } from "@loanslam/contracts";

const fieldWeights = {
  question: 6,
  questionVariants: 5,
  tags: 4,
  routeReason: 3,
  answerText: 1,
} as const;

const stopTerms = new Set([
  "a",
  "about",
  "after",
  "am",
  "an",
  "and",
  "are",
  "as",
  "ask",
  "asking",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "could",
  "did",
  "didnt",
  "do",
  "does",
  "dont",
  "else",
  "for",
  "from",
  "general",
  "generally",
  "get",
  "got",
  "have",
  "help",
  "how",
  "i",
  "id",
  "if",
  "ill",
  "im",
  "in",
  "is",
  "it",
  "ive",
  "just",
  "know",
  "like",
  "loan",
  "loanslam",
  "me",
  "meant",
  "message",
  "my",
  "need",
  "next",
  "no",
  "not",
  "of",
  "on",
  "or",
  "pass",
  "please",
  "really",
  "say",
  "still",
  "team",
  "that",
  "the",
  "this",
  "to",
  "understand",
  "use",
  "want",
  "was",
  "what",
  "whats",
  "when",
  "where",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

const safetyCueTerms = new Set([
  "afford",
  "arrear",
  "bereavement",
  "bills",
  "complaint",
  "debt",
  "difficulty",
  "distress",
  "gambling",
  "hardship",
  "ill",
  "iva",
  "lost",
  "mental",
  "redundancy",
  "rent",
  "struggling",
  "suicide",
  "vulnerable",
  "worried",
]);

const activeSafetyCueTerms = new Set([
  "afford",
  "arrear",
  "bills",
  "difficulty",
  "distress",
  "gambling",
  "hardship",
  "lost",
  "mental",
  "redundancy",
  "rent",
  "struggling",
  "suicide",
  "vulnerable",
  "worried",
]);

const adviceCueTerms = new Set([
  "advice",
  "advise",
  "decide",
  "prioritise",
  "prioritize",
  "should",
]);

const excludedAdviceTerms = new Set(["advice", "advise", "debt", "iva"]);

export interface RetrieveMatchesOptions {
  limit?: number;
}

export function normalizeSearchTerms(text: string): string[] {
  const terms = text
    .toLowerCase()
    .replace(/\bcan't\b/g, "cant")
    .replace(/\bcannot\b/g, "cant")
    .replace(/\bwon't\b/g, "wont")
    .replace(/['’]s\b/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeTerm)
    .filter((term) => !stopTerms.has(term));

  return [...new Set(terms)];
}

export function retrieveMatches(
  query: string,
  items: readonly CorpusItem[],
  options: RetrieveMatchesOptions = {},
): RetrievedMatch[] {
  const queryTerms = normalizeSearchTerms(query);
  const queryHasSafetyCue = queryTerms.some((term) => safetyCueTerms.has(term));
  const queryLooksLikeAdviceRequest = queryTerms.some((term) =>
    adviceCueTerms.has(term),
  );
  const queryLooksLikeActiveSafetyEvent =
    activeInsolvencyEventPattern.test(query) ||
    activePaymentHardshipPattern.test(query) ||
    queryTerms.some((term) => activeSafetyCueTerms.has(term));
  const queryLooksLikeApplicationStart =
    applicationStartIntentPattern.test(query);
  const queryHasAccountStateCue = accountStateCuePattern.test(query);

  if (queryTerms.length === 0) {
    return [];
  }

  const matches = items.flatMap((item) => {
    const termWeights = buildItemTermWeights(item);
    const matchedTerms = queryTerms.filter((term) => termWeights.has(term));
    const lexicalScore = matchedTerms.reduce(
      (total, term) => total + (termWeights.get(term) ?? 0),
      0,
    );
    const safetyBoost =
      queryHasSafetyCue &&
      (!queryLooksLikeAdviceRequest || queryLooksLikeActiveSafetyEvent) &&
      item.serving_mode === "route_vulnerability" &&
      matchedTerms.some((term) => safetyCueTerms.has(term))
        ? 20
        : 0;
    const excludedAdviceBoost =
      queryLooksLikeAdviceRequest &&
      !queryLooksLikeActiveSafetyEvent &&
      item.serving_mode === "excluded" &&
      matchedTerms.some((term) => excludedAdviceTerms.has(term))
        ? 20
        : 0;
    const applicationStartBoost =
      queryLooksLikeApplicationStart &&
      !queryHasAccountStateCue &&
      item.id === "how-do-i-apply"
        ? 12
        : 0;
    const accountStatusPenalty =
      queryLooksLikeApplicationStart &&
      !queryHasAccountStateCue &&
      item.intent === "application-status"
        ? 10
        : 0;
    const score =
      lexicalScore +
      safetyBoost +
      excludedAdviceBoost +
      applicationStartBoost -
      accountStatusPenalty;

    if (score <= 0) {
      return [];
    }

    return [
      {
        itemId: item.id,
        score,
        servingMode: item.serving_mode,
        matchedTerms,
        item,
      },
    ];
  });

  return matches
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.itemId.localeCompare(right.itemId);
    })
    .slice(0, options.limit ?? matches.length);
}

const activeInsolvencyEventPattern =
  /\b(i\s*(am|'m)|i\s+have|i've|already|currently)\b.{0,80}\b(setting\s+up|going\s+into|entered|entering|started|starting)\b.{0,80}\b(iva|debt\s+management|insolvency)\b/i;

const activePaymentHardshipPattern =
  /\b(can't|cannot|cant|unable\s+to|not\s+able\s+to|struggling\s+to)\s+pay\b/i;

const applicationStartIntentPattern =
  /\b(where|how)\b.{0,80}\b(start|begin|apply|application|quote)\b|\b(start|begin)\b.{0,80}\b(application|apply|quote)\b|\bapply\s+online\b|\bget\s+a\s+quote\b/i;

const accountStateCuePattern =
  /\b(status|update|approved|approval|balance|settlement|payment\s+date|repayment\s+date|decision|processed|processing|completed|signed|agreement|open\s+banking|heard\s+back|news|funds|existing\s+(loan|account)|my\s+account)\b/i;

function buildItemTermWeights(item: CorpusItem): Map<string, number> {
  const termWeights = new Map<string, number>();

  addTerms(termWeights, item.question, fieldWeights.question);
  addTerms(
    termWeights,
    (item.question_variants ?? []).join(" "),
    fieldWeights.questionVariants,
  );
  addTerms(termWeights, (item.tags ?? []).join(" "), fieldWeights.tags);
  addTerms(termWeights, item.route_reason ?? "", fieldWeights.routeReason);
  addTerms(termWeights, item.answer_text ?? "", fieldWeights.answerText);

  return termWeights;
}

function addTerms(
  termWeights: Map<string, number>,
  text: string,
  weight: number,
): void {
  for (const term of normalizeSearchTerms(text)) {
    termWeights.set(term, (termWeights.get(term) ?? 0) + weight);
  }
}

function normalizeTerm(term: string): string {
  if (term === "applying") {
    return "apply";
  }

  if (term === "job") {
    return "employment";
  }

  if (["complain", "complaining", "complained"].includes(term)) {
    return "complaint";
  }

  if (term.length > 4 && term.endsWith("ies")) {
    return `${term.slice(0, -3)}y`;
  }

  if (
    term.length > 3 &&
    term.endsWith("s") &&
    !term.endsWith("ss") &&
    !term.endsWith("us") &&
    !term.endsWith("is")
  ) {
    return term.slice(0, -1);
  }

  return term;
}
