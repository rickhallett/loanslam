import type {
  Sts2Profile,
  Sts2RunReport,
  Sts2Trajectory,
  Sts2Usage,
  Sts2UsageReceipt,
} from "@loanslam/contracts";
import { sts2RunReportSchema } from "@loanslam/contracts";

// Rates snapshot embedded in every usage receipt so cost evidence is
// self-describing. Estimates only — billing exports settle disputes. Rates
// mirror scripts/throwaway/openai-model-family-probe.ts (checked against
// OpenAI pricing docs 2026-06-15).
const sts2RateTable: Record<
  string,
  { inputPerMTok: number; cachedInputPerMTok: number; outputPerMTok: number }
> = {
  "gpt-5.5": { inputPerMTok: 5, cachedInputPerMTok: 0.5, outputPerMTok: 30 },
  "gpt-5.4": {
    inputPerMTok: 2.5,
    cachedInputPerMTok: 0.25,
    outputPerMTok: 15,
  },
  "gpt-5.4-mini": {
    inputPerMTok: 0.75,
    cachedInputPerMTok: 0.075,
    outputPerMTok: 4.5,
  },
  "gpt-5.4-nano": {
    inputPerMTok: 0.2,
    cachedInputPerMTok: 0.02,
    outputPerMTok: 1.25,
  },
};

const sts2RateSource =
  "OpenAI pricing docs via scripts/throwaway/openai-model-family-probe.ts (2026-06-15); estimate only, settle against billing exports";

export function buildSts2UsageReceipt(input: {
  customerModel: string;
  trajectories: readonly Sts2Trajectory[];
}): Sts2UsageReceipt {
  const rates = sts2RateTable[input.customerModel];

  if (rates === undefined) {
    throw new Error(
      `No recorded rates for customer model "${input.customerModel}"; add them to the sts2 rate table before running.`,
    );
  }

  let calls = 0;
  const totals: Sts2Usage = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
  };

  for (const trajectory of input.trajectories) {
    for (const turn of trajectory.turns) {
      calls += 1;
      totals.inputTokens += turn.customerUsage.inputTokens;
      totals.cachedInputTokens += turn.customerUsage.cachedInputTokens;
      totals.outputTokens += turn.customerUsage.outputTokens;
    }
  }

  const uncachedInput = Math.max(
    0,
    totals.inputTokens - totals.cachedInputTokens,
  );
  const estimatedCostUsd =
    (uncachedInput / 1_000_000) * rates.inputPerMTok +
    (totals.cachedInputTokens / 1_000_000) * rates.cachedInputPerMTok +
    (totals.outputTokens / 1_000_000) * rates.outputPerMTok;

  return {
    customerModel: input.customerModel,
    calls,
    totals,
    estimatedCostUsd: roundUsd(estimatedCostUsd),
    rates: {
      model: input.customerModel,
      ...rates,
      source: sts2RateSource,
    },
  };
}

export interface BuildSts2RunReportInput {
  runId: string;
  seed: string;
  profile: Sts2Profile;
  customerModel: string;
  plannerModel: string;
  generatedAt: Date;
  trajectories: readonly Sts2Trajectory[];
}

export function buildSts2RunReport(
  input: BuildSts2RunReportInput,
): Sts2RunReport {
  return sts2RunReportSchema.parse({
    schemaVersion: 1,
    runId: input.runId,
    seed: input.seed,
    profile: input.profile,
    customerModel: input.customerModel,
    plannerModel: input.plannerModel,
    generatedAt: input.generatedAt.toISOString(),
    // Judge verdicts arrive with arc-002; until a judge pass runs the run is
    // explicitly ungraded rather than optimistically scored.
    verdict: "ungraded",
    trajectories: input.trajectories.map((trajectory) => ({
      scenarioPath: trajectory.scenarioPath,
      personaStyle: trajectory.initialization.persona.style,
      intent: trajectory.initialization.persona.goal.intent,
      languageNoise: trajectory.initialization.languageNoise,
      riskMarker: trajectory.initialization.riskMarker,
      turnCount: trajectory.turns.length,
      endReason: trajectory.endReason,
      finalActions: trajectory.turns.map((turn) => turn.finalAction),
      safetyFlagCounts: countSafetyFlags(trajectory),
    })),
    usage: buildSts2UsageReceipt({
      customerModel: input.customerModel,
      trajectories: input.trajectories,
    }),
    replay: {
      regenerateCommand: `just sts2 -- --seed ${input.seed} --profile ${input.profile} --customer-model ${input.customerModel}`,
      regradeCommand: `just sts2 -- --regrade artifacts/phase0/sts2-${input.profile}-${input.runId}`,
    },
  });
}

export function renderSts2SummaryMarkdown(report: Sts2RunReport): string {
  const endReasonCounts = countBy(
    report.trajectories,
    (trajectory) => trajectory.endReason,
  );
  const styleCounts = countBy(
    report.trajectories,
    (trajectory) => trajectory.personaStyle,
  );
  const intentCounts = countBy(
    report.trajectories,
    (trajectory) => trajectory.intent,
  );
  const totalTurns = report.trajectories.reduce(
    (sum, trajectory) => sum + trajectory.turnCount,
    0,
  );

  return [
    `# STS v2 run ${report.runId}`,
    "",
    `- Seed: \`${report.seed}\``,
    `- Profile: ${report.profile}`,
    `- Customer model: ${report.customerModel}`,
    `- Planner model: ${report.plannerModel}`,
    `- Generated at: ${report.generatedAt}`,
    `- Verdict: ${report.verdict}`,
    "",
    "## Trajectories",
    "",
    `- Count: ${report.trajectories.length}`,
    `- Total engine turns: ${totalTurns}`,
    `- End reasons: ${formatCounts(endReasonCounts)}`,
    `- Persona styles: ${formatCounts(styleCounts)}`,
    `- Intents: ${formatCounts(intentCounts)}`,
    "",
    "## Customer-model usage receipt",
    "",
    `- Calls: ${report.usage.calls}`,
    `- Input tokens: ${report.usage.totals.inputTokens} (cached ${report.usage.totals.cachedInputTokens})`,
    `- Output tokens: ${report.usage.totals.outputTokens}`,
    `- Estimated cost: $${report.usage.estimatedCostUsd.toFixed(4)} (${report.usage.rates.source})`,
    "",
    "## Replay",
    "",
    "Turn content is generated live and is not bit-for-bit reproducible;",
    "comparability is at the initialization-distribution and regrade levels.",
    "",
    `- Regenerate (same initializations, fresh trajectories): \`${report.replay.regenerateCommand}\``,
    `- Regrade (same transcripts, fresh report/judging): \`${report.replay.regradeCommand}\``,
  ].join("\n");
}

export function renderSts2ReportHtml(report: Sts2RunReport): string {
  const rows = report.trajectories
    .map(
      (trajectory) =>
        `<tr><td>${escapeHtml(trajectory.scenarioPath)}</td><td>${escapeHtml(
          trajectory.personaStyle,
        )}</td><td>${escapeHtml(trajectory.intent)}</td><td>${escapeHtml(
          trajectory.languageNoise,
        )}</td><td>${escapeHtml(trajectory.riskMarker)}</td><td>${
          trajectory.turnCount
        }</td><td>${escapeHtml(trajectory.endReason)}</td></tr>`,
    )
    .join("\n");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>STS v2 run ${escapeHtml(report.runId)}</title>`,
    "<style>",
    "body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a202c; }",
    "table { border-collapse: collapse; width: 100%; margin-top: 1rem; }",
    "th, td { border: 1px solid #cbd5e0; padding: 0.4rem 0.6rem; text-align: left; font-size: 0.9rem; }",
    "th { background: #edf2f7; }",
    "code { background: #edf2f7; padding: 0.1rem 0.3rem; }",
    "</style>",
    "</head>",
    "<body>",
    `<h1>STS v2 run ${escapeHtml(report.runId)}</h1>`,
    `<p>Seed <code>${escapeHtml(report.seed)}</code>, profile ${escapeHtml(
      report.profile,
    )}, customer model ${escapeHtml(
      report.customerModel,
    )}, planner ${escapeHtml(report.plannerModel)}, verdict <strong>${escapeHtml(
      report.verdict,
    )}</strong>.</p>`,
    `<p>Customer usage: ${report.usage.calls} calls, ${
      report.usage.totals.inputTokens
    } input tokens (${
      report.usage.totals.cachedInputTokens
    } cached), ${report.usage.totals.outputTokens} output tokens, estimated $${report.usage.estimatedCostUsd.toFixed(
      4,
    )}.</p>`,
    "<table>",
    "<thead><tr><th>Trajectory</th><th>Style</th><th>Intent</th><th>Noise</th><th>Risk</th><th>Turns</th><th>End</th></tr></thead>",
    "<tbody>",
    rows,
    "</tbody>",
    "</table>",
    "</body>",
    "</html>",
  ].join("\n");
}

function countSafetyFlags(
  trajectory: Sts2Trajectory,
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const turn of trajectory.turns) {
    for (const flag of turn.safetyFlags) {
      counts[flag] = (counts[flag] ?? 0) + 1;
    }
  }

  return counts;
}

function countBy<T>(
  values: readonly T[],
  keyOf: (value: T) => string,
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const value of values) {
    const key = keyOf(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  if (entries.length === 0) {
    return "none";
  }

  return entries.map(([key, count]) => `${key} ${count}`).join(", ");
}

function roundUsd(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
