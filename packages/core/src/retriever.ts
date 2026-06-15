import type {
  CorpusItem,
  RetrievedMatch,
  SafetyFlag,
  ServingMode,
  SignalBundle,
} from "@loanslam/contracts";

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

export interface RetrieveMatchesOptions {
  limit?: number;
  signalBundle?: SignalBundle;
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
  const queryTerms = normalizeSearchTerms(
    [
      query,
      ...(options.signalBundle?.retrievalQueries ?? []),
      ...(options.signalBundle?.routeHints ?? []),
    ].join(" "),
  );
  const signalServingMode = signalServingModeEvidence(options.signalBundle);

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

    if (
      !hasRequiredPolicyRouteEvidence(
        item,
        signalServingMode,
        options.signalBundle,
      )
    ) {
      return [];
    }

    const signalBoost =
      signalServingMode === item.serving_mode && matchedTerms.length > 0
        ? 50
        : 0;
    const score = lexicalScore + signalBoost;

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

function hasRequiredPolicyRouteEvidence(
  item: CorpusItem,
  signalServingMode: ServingMode | null,
  signalBundle: SignalBundle | undefined,
): boolean {
  if (
    signalServingMode &&
    !signalAllowsServingMode(item.serving_mode, signalServingMode, signalBundle)
  ) {
    return false;
  }

  return true;
}

function signalServingModeEvidence(
  signalBundle: SignalBundle | undefined,
): ServingMode | null {
  return signalBundle?.recommendedServingMode ?? null;
}

function signalAllowsServingMode(
  itemServingMode: ServingMode,
  signalServingMode: ServingMode,
  signalBundle: SignalBundle | undefined,
): boolean {
  if (itemServingMode === "answer") {
    return true;
  }

  if (signalServingMode === "answer") {
    return false;
  }

  if (itemServingMode !== signalServingMode) {
    return false;
  }

  if (itemServingMode === "route_vulnerability") {
    return (
      signalServingMode === "route_vulnerability" &&
      hasActiveVulnerabilitySignal(signalBundle)
    );
  }

  return true;
}

const vulnerabilitySignalFlags = [
  "vulnerability",
  "distress",
  "hardship",
  "complaint",
  "legal_threat",
  "accessibility_need",
] as const satisfies readonly SafetyFlag[];

function hasAnySignalFlag(
  signalBundle: SignalBundle | undefined,
  flags: readonly SafetyFlag[],
): boolean {
  return Boolean(
    signalBundle?.safetySignals.some((flag) => flags.includes(flag)),
  );
}

function hasActiveVulnerabilitySignal(
  signalBundle: SignalBundle | undefined,
): boolean {
  if (!signalBundle || signalBundle.negatedOrCorrected) {
    return false;
  }

  return (
    hasAnySignalFlag(signalBundle, vulnerabilitySignalFlags) ||
    signalBundle.primaryIntent === "vulnerability" ||
    signalBundle.primaryIntent === "complaint" ||
    signalBundle.primaryIntent === "legal" ||
    signalBundle.primaryIntent === "language_barrier"
  );
}

function normalizeTerm(term: string): string {
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
