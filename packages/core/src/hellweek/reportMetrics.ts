import type {
  HellWeekRuntimeStat,
  HellWeekRuntimeSummary,
  HellWeekScenarioEvidence,
} from "./types";

export function buildRuntimeSummary(
  evidence: readonly HellWeekScenarioEvidence[],
): HellWeekRuntimeSummary {
  const turnCount = evidence.reduce((sum, item) => sum + item.turns.length, 0);

  return {
    scenarioWallTimeMs: runtimeStat(
      evidence.map((item) => item.durationMs),
      evidence.length,
    ),
    signalLatencyMs: runtimeStat(
      evidence.flatMap((item) =>
        item.turns.flatMap((turn) =>
          typeof turn.signalLatencyMs === "number"
            ? [turn.signalLatencyMs]
            : [],
        ),
      ),
      turnCount,
    ),
    plannerLatencyMs: runtimeStat(
      evidence.flatMap((item) =>
        item.turns.flatMap((turn) =>
          typeof turn.plannerLatencyMs === "number"
            ? [turn.plannerLatencyMs]
            : [],
        ),
      ),
      turnCount,
    ),
    signalErrors: countSignalErrors(evidence),
  };
}

export function countSignalErrors(
  evidence: readonly HellWeekScenarioEvidence[],
): number {
  return evidence.reduce(
    (sum, item) => sum + item.turns.filter((turn) => turn.signalError).length,
    0,
  );
}

function runtimeStat(
  values: readonly number[],
  expectedCount: number,
): HellWeekRuntimeStat {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  const totalMs = sorted.reduce((sum, value) => sum + value, 0);

  return {
    count: sorted.length,
    missing: Math.max(0, expectedCount - sorted.length),
    totalMs,
    averageMs: sorted.length === 0 ? null : totalMs / sorted.length,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted.at(-1) ?? null,
  };
}

function percentile(
  sortedValues: readonly number[],
  point: number,
): number | null {
  if (sortedValues.length === 0) {
    return null;
  }

  const index = Math.ceil(sortedValues.length * point) - 1;
  return (
    sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))] ?? null
  );
}
