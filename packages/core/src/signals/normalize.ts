import { servingModeSchema, type SignalBundle } from "@loanslam/contracts";

// STRICT_MODE_INVARIANT (signal side): like the planner, the signal extractor
// asks OpenAI for a strict structured object, which cannot express optional
// fields, enums-or-null, or array constraints the canonical signalBundleSchema
// uses. normalizeOpenAiParsedSignalBundle reverses that padding — coercing the
// loose arrays/numbers and mapping an out-of-enum serving mode to null — before
// signalBundleSchema.parse in the extractor. This mirrors planners/openaiPlanner.

export function normalizeOpenAiParsedSignalBundle(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }

  const cast = parsed as {
    primaryIntent?: string;
    secondaryIntents?: unknown;
    safetySignals?: unknown;
    retrievalQueries?: unknown;
    routeHints?: unknown;
    uncertainty?: number;
    recommendedServingMode?: unknown;
    negatedOrCorrected?: boolean;
    parserNotes?: unknown;
  };

  const recommendedServingMode = servingModeSchema.safeParse(
    cast.recommendedServingMode,
  );

  return {
    ...cast,
    secondaryIntents: normalizeStringArray(cast.secondaryIntents),
    safetySignals: normalizeStringArray(cast.safetySignals),
    retrievalQueries: normalizeStringArray(cast.retrievalQueries),
    routeHints: normalizeStringArray(cast.routeHints),
    parserNotes: normalizeStringArray(cast.parserNotes),
    uncertainty: clampUncertainty(cast.uncertainty),
    negatedOrCorrected: Boolean(cast.negatedOrCorrected),
    recommendedServingMode: recommendedServingMode.success
      ? recommendedServingMode.data
      : null,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter((entry) => entry.length > 0);
}

function clampUncertainty(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

// Live on every serving turn via openaiSignalExtractor.extractSignals; static
// dead-code analysis can misreport it as unused. Do not delete.
export function parseSignalBundle(parsed: unknown): SignalBundle {
  const normalized = normalizeOpenAiParsedSignalBundle(parsed);
  return normalized as SignalBundle;
}
