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
  "at",
  "be",
  "by",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "get",
  "got",
  "have",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "the",
  "this",
  "to",
  "what",
  "whats",
  "when",
  "where",
  "will",
  "with",
  "you",
  "your",
]);

export interface RetrieveMatchesOptions {
  limit?: number;
}

export function normalizeSearchTerms(text: string): string[] {
  const terms = text
    .toLowerCase()
    .replace(/\bcan't\b/g, "cant")
    .replace(/\bwon't\b/g, "wont")
    .replace(/['’]s\b/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizeTerm)
    .filter((term) => !stopTerms.has(term));

  return [...new Set(terms)];
}

export function retrieveMatches(
  query: string,
  items: readonly CorpusItem[],
  options: RetrieveMatchesOptions = {},
): RetrievedMatch[] {
  const queryTerms = normalizeSearchTerms(query);

  if (queryTerms.length === 0) {
    return [];
  }

  const matches = items.flatMap((item) => {
    const termWeights = buildItemTermWeights(item);
    const matchedTerms = queryTerms.filter((term) => termWeights.has(term));
    const score = matchedTerms.reduce(
      (total, term) => total + (termWeights.get(term) ?? 0),
      0,
    );

    if (score === 0) {
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

function singularizeTerm(term: string): string {
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
