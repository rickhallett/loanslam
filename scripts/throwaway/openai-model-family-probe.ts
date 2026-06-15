#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

type Route =
  | "answer_public"
  | "handoff_account_specific"
  | "route_vulnerability"
  | "excluded"
  | "unclear";

type Confidence = "low" | "medium" | "high";

type SafetyFlag =
  | "none"
  | "hardship"
  | "payment_difficulty"
  | "vulnerability"
  | "complaint"
  | "legal_threat"
  | "accessibility_need"
  | "account_specific";

type PayloadStyle =
  | "instructions_text_input"
  | "message_array_system_user"
  | "instructions_message_array";

interface Scenario {
  id: string;
  payloadStyle: PayloadStyle;
  customerMessage: string;
  expectedRoute: Route;
  expectedNeedsHuman: boolean;
  requiredAnySafetyFlags: SafetyFlag[];
  forbiddenSafetyFlags: SafetyFlag[];
}

interface Args {
  outDir: string;
  modelRegex: string;
  excludeRegex: string;
  models: string[];
  limit: number | null;
  listOnly: boolean;
  runsPerModel: number;
  scenarioId: string | null;
}

interface Price {
  inputPerMTok: number;
  cachedInputPerMTok: number | null;
  outputPerMTok: number;
  source: string;
}

interface UsageShape {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
}

const stamp = new Date()
  .toISOString()
  .replaceAll(":", "-")
  .replace(/\..+/, "Z");

const defaultOutDir = path.join(
  "artifacts",
  "phase0",
  `openai-model-family-probe-${stamp}`,
);

const args = parseArgs(process.argv.slice(2));

loadDotEnvFile(".env.local");
loadDotEnvFile(".env");

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    "OPENAI_API_KEY is missing from the environment or .env files.",
  );
}

const client = new OpenAI({ apiKey });

const classificationSchema = z.object({
  route: z.enum([
    "answer_public",
    "handoff_account_specific",
    "route_vulnerability",
    "excluded",
    "unclear",
  ]),
  confidence: z.enum(["low", "medium", "high"]),
  needsHuman: z.boolean(),
  safetyFlags: z.array(
    z.enum([
      "none",
      "hardship",
      "payment_difficulty",
      "vulnerability",
      "complaint",
      "legal_threat",
      "accessibility_need",
      "account_specific",
    ]),
  ),
  evidenceQuote: z.string(),
  reason: z.string(),
});

const scenarios: Scenario[] = [
  {
    id: "public-apply",
    payloadStyle: "instructions_text_input",
    customerMessage: "Where can I apply for a personal loan?",
    expectedRoute: "answer_public",
    expectedNeedsHuman: false,
    requiredAnySafetyFlags: [],
    forbiddenSafetyFlags: [
      "hardship",
      "payment_difficulty",
      "vulnerability",
      "complaint",
      "legal_threat",
      "accessibility_need",
    ],
  },
  {
    id: "account-balance-negated-hardship",
    payloadStyle: "message_array_system_user",
    customerMessage:
      "Can you give me my balance reference? This is not a hardship thing.",
    expectedRoute: "handoff_account_specific",
    expectedNeedsHuman: true,
    requiredAnySafetyFlags: [],
    forbiddenSafetyFlags: ["hardship", "payment_difficulty", "vulnerability"],
  },
  {
    id: "fresh-payment-hardship",
    payloadStyle: "instructions_message_array",
    customerMessage:
      "I can't make this payment because I am in financial difficulty.",
    expectedRoute: "route_vulnerability",
    expectedNeedsHuman: true,
    requiredAnySafetyFlags: ["hardship", "payment_difficulty", "vulnerability"],
    forbiddenSafetyFlags: [],
  },
];

const instructions = [
  "You classify one LoanSlam customer message for routing.",
  "Return only the structured fields requested by the schema.",
  "Routes:",
  "- answer_public: public product or process FAQ that can be answered from approved public information.",
  "- handoff_account_specific: account-specific requests, identity-specific balances, applications, tickets, or references.",
  "- route_vulnerability: hardship, payment difficulty, vulnerability, accessibility, legal, distress, or complaint signals needing a person.",
  "- excluded: request is outside LoanSlam lending support or asks for financial/legal advice.",
  "- unclear: not enough information to route.",
  "Negated safety language is not active vulnerability evidence. For example, 'not a hardship thing' must not set hardship or vulnerability.",
  "Use safetyFlags ['none'] only when no other flag applies.",
  "Keep evidenceQuote under 20 words and reason under 25 words.",
].join("\n");

async function main(): Promise<void> {
  mkdirSync(args.outDir, { recursive: true });

  const liveModelIds = await listLiveModelIds();
  const familyModelIds = selectFamilyModelIds(liveModelIds);
  const selectedModels = selectModels(familyModelIds);
  const selectedScenarios = selectScenarioSequence(
    args.runsPerModel,
    args.scenarioId,
  );

  const modelListPayload = {
    generatedAt: new Date().toISOString(),
    modelRegex: args.modelRegex,
    excludeRegex: args.excludeRegex,
    liveModelIds,
    familyModelIds,
    selectedModels,
    selectedScenarioIds: selectedScenarios.map((scenario) => scenario.id),
  };

  writeJson("live-models.json", modelListPayload);

  if (args.listOnly) {
    console.log(
      `Wrote live model list to ${path.join(args.outDir, "live-models.json")}`,
    );
    console.log(`Matched ${familyModelIds.length} GPT-5/GPT-4 family models.`);
    console.log(familyModelIds.join("\n"));
    return;
  }

  if (selectedModels.length === 0) {
    throw new Error("No selected models. Use --models or relax --model-regex.");
  }

  const runs: Array<Record<string, unknown>> = [];

  for (const model of selectedModels) {
    for (const [index, scenario] of selectedScenarios.entries()) {
      const run = await probeModel(model, scenario, index + 1);
      runs.push(run);
      const checks = isRecord(run.checks) ? run.checks : {};
      const status = run.ok ? (checks.passed ? "pass" : "fail") : "error";
      console.log(
        `${status} ${model} ${scenario.id} ${run.latencyMs}ms $${formatMoney(
          numberOrNull(run.estimatedCostUsd),
        )}`,
      );
    }
  }

  const latencySummaries = buildLatencySummaryByModel(selectedModels, runs);
  const resultPayload = {
    generatedAt: new Date().toISOString(),
    requestShape: "Responses API responses.parse with zodTextFormat",
    runsPerModel: args.runsPerModel,
    selectedScenarioIds: selectedScenarios.map((scenario) => scenario.id),
    scenarios,
    selectedModels,
    latencySummaries,
    runs,
  };

  writeJson("results.json", resultPayload);
  writeFileSync(path.join(args.outDir, "summary.csv"), buildCsv(runs));
  writeFileSync(
    path.join(args.outDir, "latency-summary.csv"),
    buildLatencySummaryCsv(latencySummaries),
  );
  writeFileSync(
    path.join(args.outDir, "summary.md"),
    buildMarkdownSummary(selectedModels, selectedScenarios, runs),
  );

  console.log(`\nWrote results to ${args.outDir}`);
}

async function listLiveModelIds(): Promise<string[]> {
  const models = await client.models.list();
  return models.data
    .map((model) => model.id)
    .sort((a, b) => a.localeCompare(b));
}

function selectFamilyModelIds(modelIds: string[]): string[] {
  const include = new RegExp(args.modelRegex);
  const exclude = new RegExp(args.excludeRegex, "i");

  return modelIds.filter((id) => include.test(id) && !exclude.test(id));
}

function selectModels(familyModelIds: string[]): string[] {
  const selected = args.models.length > 0 ? args.models : familyModelIds;
  const filtered = selected.filter((id) => familyModelIds.includes(id));

  if (args.models.length > 0) {
    const missing = args.models.filter((id) => !familyModelIds.includes(id));

    if (missing.length > 0) {
      console.warn(
        `Skipping models not in live matched list: ${missing.join(", ")}`,
      );
    }
  }

  return args.limit === null ? filtered : filtered.slice(0, args.limit);
}

function expandScenarios(runsPerModel: number): Scenario[] {
  const selected = [];

  for (let index = 0; index < runsPerModel; index += 1) {
    selected.push(scenarios[index % scenarios.length]);
  }

  return selected;
}

function selectScenarioSequence(
  runsPerModel: number,
  scenarioId: string | null,
): Scenario[] {
  if (scenarioId === null) {
    return expandScenarios(runsPerModel);
  }

  const scenario = scenarios.find((candidate) => candidate.id === scenarioId);

  if (!scenario) {
    throw new Error(
      `Unknown --scenario-id ${scenarioId}. Available scenarios: ${scenarios
        .map((candidate) => candidate.id)
        .join(", ")}`,
    );
  }

  return Array.from({ length: runsPerModel }, () => scenario);
}

async function probeModel(
  model: string,
  scenario: Scenario,
  runIndex: number,
): Promise<Record<string, unknown>> {
  const startedAt = new Date();
  const started = performance.now();

  try {
    const response = await client.responses.parse({
      model,
      ...buildRequestInput(scenario),
      text: {
        format: zodTextFormat(
          classificationSchema,
          "loanslam_policy_route_probe",
        ),
      },
      store: false,
      max_output_tokens: 1200,
    });

    const endedAt = new Date();
    const latencyMs = Math.round(performance.now() - started);
    const parsed = classificationSchema.parse(response.output_parsed);
    const outputText = extractOutputText(response, parsed);
    const usage = response.usage as UsageShape | undefined;
    const estimatedCostUsd = estimateCost(model, usage);
    const checks = checkScenario(parsed, scenario);

    return {
      ok: true,
      model,
      runIndex,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      scenarioId: scenario.id,
      payloadStyle: scenario.payloadStyle,
      latencyMs,
      answerLength: outputText.length,
      estimatedCostUsd,
      usage,
      parsed,
      checks,
    };
  } catch (error) {
    const endedAt = new Date();
    const latencyMs = Math.round(performance.now() - started);

    return {
      ok: false,
      model,
      runIndex,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      scenarioId: scenario.id,
      payloadStyle: scenario.payloadStyle,
      latencyMs,
      answerLength: 0,
      estimatedCostUsd: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildRequestInput(
  scenario: Scenario,
):
  | { instructions: string; input: string }
  | { input: Array<{ role: "system" | "user"; content: string }> }
  | { instructions: string; input: Array<{ role: "user"; content: string }> } {
  const userPayload = JSON.stringify(
    {
      productBoundary: "LoanSlam UK loan lead/customer support.",
      currentCustomerMessage: scenario.customerMessage,
      expectedOutputPurpose:
        "Probe routing reliability, not production customer wording.",
    },
    null,
    2,
  );

  if (scenario.payloadStyle === "instructions_text_input") {
    return {
      instructions,
      input: userPayload,
    };
  }

  if (scenario.payloadStyle === "message_array_system_user") {
    return {
      input: [
        { role: "system", content: instructions },
        { role: "user", content: userPayload },
      ],
    };
  }

  return {
    instructions,
    input: [{ role: "user", content: userPayload }],
  };
}

function checkScenario(
  parsed: z.infer<typeof classificationSchema>,
  scenario: Scenario,
): Record<string, unknown> {
  const safetyFlags = new Set(parsed.safetyFlags);
  const hasRequiredSafety =
    scenario.requiredAnySafetyFlags.length === 0 ||
    scenario.requiredAnySafetyFlags.some((flag) => safetyFlags.has(flag));
  const forbiddenSafetyFlagsPresent = scenario.forbiddenSafetyFlags.filter(
    (flag) => safetyFlags.has(flag),
  );
  const routeMatches = parsed.route === scenario.expectedRoute;
  const needsHumanMatches = parsed.needsHuman === scenario.expectedNeedsHuman;
  const passed =
    routeMatches &&
    needsHumanMatches &&
    hasRequiredSafety &&
    forbiddenSafetyFlagsPresent.length === 0;

  return {
    passed,
    routeMatches,
    needsHumanMatches,
    hasRequiredSafety,
    forbiddenSafetyFlagsPresent,
  };
}

function extractOutputText(
  response: unknown,
  parsed: z.infer<typeof classificationSchema>,
): string {
  if (isRecord(response) && typeof response.output_text === "string") {
    return response.output_text;
  }

  return JSON.stringify(parsed);
}

function estimateCost(
  model: string,
  usage: UsageShape | undefined,
): number | null {
  const price = priceForModel(model);

  if (!price || !usage) {
    return null;
  }

  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0;
  const uncachedInputTokens = Math.max(0, inputTokens - cachedTokens);
  const cachedInputRate = price.cachedInputPerMTok ?? price.inputPerMTok;
  const inputCost =
    (uncachedInputTokens / 1_000_000) * price.inputPerMTok +
    (cachedTokens / 1_000_000) * cachedInputRate;
  const outputCost = (outputTokens / 1_000_000) * price.outputPerMTok;

  return inputCost + outputCost;
}

function priceForModel(model: string): Price | null {
  const exact = priceTable[model];

  if (exact) {
    return exact;
  }

  const prefix = Object.keys(priceTable)
    .sort((a, b) => b.length - a.length)
    .find((key) => model === key || model.startsWith(`${key}-`));

  if (prefix) {
    return priceTable[prefix];
  }

  if (model.startsWith("gpt-5.")) {
    return {
      ...priceTable["gpt-5"],
      source:
        "Inferred GPT-5 family fallback; refresh against billing export before finance decisions",
    };
  }

  return null;
}

const priceTable: Record<string, Price> = {
  "gpt-5.5-pro": {
    inputPerMTok: 30,
    cachedInputPerMTok: null,
    outputPerMTok: 180,
    source: "OpenAI pricing docs, standard short-context",
  },
  "gpt-5.5": {
    inputPerMTok: 5,
    cachedInputPerMTok: 0.5,
    outputPerMTok: 30,
    source: "OpenAI pricing docs, standard short-context",
  },
  "gpt-5.4-pro": {
    inputPerMTok: 30,
    cachedInputPerMTok: null,
    outputPerMTok: 180,
    source: "OpenAI pricing docs, standard short-context",
  },
  "gpt-5.4-mini": {
    inputPerMTok: 0.75,
    cachedInputPerMTok: 0.075,
    outputPerMTok: 4.5,
    source: "OpenAI pricing docs, standard short-context",
  },
  "gpt-5.4-nano": {
    inputPerMTok: 0.2,
    cachedInputPerMTok: 0.02,
    outputPerMTok: 1.25,
    source: "OpenAI pricing docs, standard short-context",
  },
  "gpt-5.4": {
    inputPerMTok: 2.5,
    cachedInputPerMTok: 0.25,
    outputPerMTok: 15,
    source: "OpenAI pricing docs, standard short-context",
  },
  "gpt-5-mini": {
    inputPerMTok: 0.25,
    cachedInputPerMTok: 0.025,
    outputPerMTok: 2,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
  "gpt-5-nano": {
    inputPerMTok: 0.05,
    cachedInputPerMTok: 0.005,
    outputPerMTok: 0.4,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
  "gpt-5-chat-latest": {
    inputPerMTok: 1.25,
    cachedInputPerMTok: 0.125,
    outputPerMTok: 10,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
  "gpt-5": {
    inputPerMTok: 1.25,
    cachedInputPerMTok: 0.125,
    outputPerMTok: 10,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
  "gpt-4.1-mini": {
    inputPerMTok: 0.4,
    cachedInputPerMTok: 0.1,
    outputPerMTok: 1.6,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
  "gpt-4.1-nano": {
    inputPerMTok: 0.1,
    cachedInputPerMTok: 0.025,
    outputPerMTok: 0.4,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
  "gpt-4.1": {
    inputPerMTok: 2,
    cachedInputPerMTok: 0.5,
    outputPerMTok: 8,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
  "gpt-4o-mini": {
    inputPerMTok: 0.15,
    cachedInputPerMTok: 0.075,
    outputPerMTok: 0.6,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
  "gpt-4o": {
    inputPerMTok: 2.5,
    cachedInputPerMTok: 1.25,
    outputPerMTok: 10,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
  "gpt-4-turbo": {
    inputPerMTok: 10,
    cachedInputPerMTok: null,
    outputPerMTok: 30,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
  "gpt-4": {
    inputPerMTok: 30,
    cachedInputPerMTok: null,
    outputPerMTok: 60,
    source:
      "Seeded from known OpenAI API rates; refresh before billing decisions",
  },
};

function buildCsv(runs: Array<Record<string, unknown>>): string {
  const medianByModel = buildLatencyMedianByModel(runs);
  const rows = [
    [
      "model",
      "runIndex",
      "scenario",
      "payloadStyle",
      "startedAt",
      "endedAt",
      "ok",
      "passed",
      "latencyMs",
      "modelLatencyMedianMs",
      "latencyDeltaFromMedianMs",
      "answerLength",
      "estimatedCostUsd",
      "inputTokens",
      "outputTokens",
      "route",
      "confidence",
      "needsHuman",
      "safetyFlags",
      "error",
    ],
  ];

  for (const run of runs) {
    const parsed = isRecord(run.parsed) ? run.parsed : {};
    const checks = isRecord(run.checks) ? run.checks : {};
    const usage = isRecord(run.usage) ? run.usage : {};
    const model = String(run.model ?? "");
    const latencyMs = numberOrNull(run.latencyMs);
    const medianLatency = medianByModel.get(model) ?? null;
    const latencyDelta =
      latencyMs !== null && medianLatency !== null
        ? latencyMs - medianLatency
        : null;

    rows.push([
      model,
      String(run.runIndex ?? ""),
      String(run.scenarioId ?? ""),
      String(run.payloadStyle ?? ""),
      String(run.startedAt ?? ""),
      String(run.endedAt ?? ""),
      String(run.ok ?? ""),
      String(checks.passed ?? ""),
      String(run.latencyMs ?? ""),
      formatNumber(medianLatency),
      formatNumber(latencyDelta),
      String(run.answerLength ?? ""),
      run.estimatedCostUsd === null || run.estimatedCostUsd === undefined
        ? ""
        : String(run.estimatedCostUsd),
      String(usage.input_tokens ?? ""),
      String(usage.output_tokens ?? ""),
      String(parsed.route ?? ""),
      String(parsed.confidence ?? ""),
      String(parsed.needsHuman ?? ""),
      Array.isArray(parsed.safetyFlags) ? parsed.safetyFlags.join("|") : "",
      String(run.error ?? ""),
    ]);
  }

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function buildMarkdownSummary(
  selectedModels: string[],
  selectedScenarios: Scenario[],
  runs: Array<Record<string, unknown>>,
): string {
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  const medianByModel = buildLatencyMedianByModel(runs);

  for (const run of runs) {
    const model = String(run.model ?? "");
    grouped.set(model, [...(grouped.get(model) ?? []), run]);
  }

  const lines = [
    "# OpenAI model family probe",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Request shape: Responses API `responses.parse` with `zodTextFormat` structured output.",
    "",
    `Scenario sequence: ${selectedScenarios
      .map((scenario) => scenario.id)
      .join(", ")}`,
    "",
    "Latency summary uses every attempted call, including errored attempts when they have elapsed time.",
    "",
    "| Model | Runs | Passes | Errors | Mean ms | Median ms | Min ms | Max ms | Range ms | Stdev ms | CV | Avg answer chars | Estimated total cost USD |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];

  for (const model of selectedModels) {
    const modelRuns = grouped.get(model) ?? [];
    const okRuns = modelRuns.filter((run) => run.ok === true);
    const passes = modelRuns.filter(
      (run) => isRecord(run.checks) && run.checks.passed === true,
    ).length;
    const errors = modelRuns.length - okRuns.length;
    const latency = latencyStats(
      modelRuns.map((run) => numberOrNull(run.latencyMs)),
    );
    const avgAnswerLength = average(
      modelRuns.map((run) => numberOrNull(run.answerLength)),
    );
    const totalCost = sum(
      modelRuns.map((run) => numberOrNull(run.estimatedCostUsd)),
    );

    lines.push(
      `| ${model} | ${modelRuns.length} | ${passes} | ${errors} | ${formatNumber(
        latency.mean,
      )} | ${formatNumber(latency.median)} | ${formatNumber(
        latency.min,
      )} | ${formatNumber(latency.max)} | ${formatNumber(
        latency.range,
      )} | ${formatNumber(latency.sampleStdDev)} | ${formatPercent(
        latency.coefficientOfVariation,
      )} | ${formatNumber(avgAnswerLength)} | ${formatMoney(totalCost)} |`,
    );
  }

  lines.push("", "## Run detail", "");
  lines.push(
    "| Model | Run | Scenario | Payload | Status | Latency ms | Delta median ms | Cost USD | Route | Flags |",
  );
  lines.push("|---|---:|---|---|---|---:|---:|---:|---|---|");

  for (const run of runs) {
    const parsed = isRecord(run.parsed) ? run.parsed : {};
    const checks = isRecord(run.checks) ? run.checks : {};
    const model = String(run.model ?? "");
    const latencyMs = numberOrNull(run.latencyMs);
    const medianLatency = medianByModel.get(model) ?? null;
    const latencyDelta =
      latencyMs !== null && medianLatency !== null
        ? latencyMs - medianLatency
        : null;
    const status =
      run.ok === true ? (checks.passed === true ? "pass" : "fail") : "error";
    const flags = Array.isArray(parsed.safetyFlags)
      ? parsed.safetyFlags.join(", ")
      : "";

    lines.push(
      `| ${run.model} | ${run.runIndex} | ${run.scenarioId} | ${
        run.payloadStyle
      } | ${status} | ${run.latencyMs} | ${formatSignedNumber(
        latencyDelta,
      )} | ${formatMoney(numberOrNull(run.estimatedCostUsd))} | ${
        parsed.route ?? ""
      } | ${flags} |`,
    );
  }

  lines.push(
    "",
    "Pricing note: cost estimates use the local price table embedded in this throwaway script. GPT-5.4 and GPT-5.5 rates were checked against OpenAI pricing docs on 2026-06-15; older GPT-4/GPT-5 entries and GPT-5.x fallbacks are seeded estimates and should be refreshed against billing exports before finance decisions.",
    "",
  );

  return lines.join("\n");
}

function buildLatencySummaryByModel(
  selectedModels: string[],
  runs: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const grouped = new Map<string, Array<Record<string, unknown>>>();

  for (const run of runs) {
    const model = String(run.model ?? "");
    grouped.set(model, [...(grouped.get(model) ?? []), run]);
  }

  return selectedModels.map((model) => {
    const modelRuns = grouped.get(model) ?? [];
    const latency = latencyStats(
      modelRuns.map((run) => numberOrNull(run.latencyMs)),
    );
    const okRuns = modelRuns.filter((run) => run.ok === true);
    const passes = modelRuns.filter(
      (run) => isRecord(run.checks) && run.checks.passed === true,
    ).length;

    return {
      model,
      runs: modelRuns.length,
      passes,
      errors: modelRuns.length - okRuns.length,
      meanLatencyMs: latency.mean,
      medianLatencyMs: latency.median,
      minLatencyMs: latency.min,
      maxLatencyMs: latency.max,
      latencyRangeMs: latency.range,
      latencySampleStdDevMs: latency.sampleStdDev,
      latencyCoefficientOfVariationPct: latency.coefficientOfVariation,
    };
  });
}

function buildLatencySummaryCsv(
  summaries: Array<Record<string, unknown>>,
): string {
  const rows = [
    [
      "model",
      "runs",
      "passes",
      "errors",
      "meanLatencyMs",
      "medianLatencyMs",
      "minLatencyMs",
      "maxLatencyMs",
      "latencyRangeMs",
      "latencySampleStdDevMs",
      "latencyCoefficientOfVariationPct",
    ],
  ];

  for (const summary of summaries) {
    rows.push([
      String(summary.model ?? ""),
      String(summary.runs ?? ""),
      String(summary.passes ?? ""),
      String(summary.errors ?? ""),
      String(summary.meanLatencyMs ?? ""),
      String(summary.medianLatencyMs ?? ""),
      String(summary.minLatencyMs ?? ""),
      String(summary.maxLatencyMs ?? ""),
      String(summary.latencyRangeMs ?? ""),
      String(summary.latencySampleStdDevMs ?? ""),
      String(summary.latencyCoefficientOfVariationPct ?? ""),
    ]);
  }

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function buildLatencyMedianByModel(
  runs: Array<Record<string, unknown>>,
): Map<string, number> {
  const grouped = new Map<string, Array<number | null>>();

  for (const run of runs) {
    const model = String(run.model ?? "");
    grouped.set(model, [
      ...(grouped.get(model) ?? []),
      numberOrNull(run.latencyMs),
    ]);
  }

  return new Map(
    [...grouped.entries()].flatMap(([model, values]) => {
      const value = median(values);
      return value === null ? [] : [[model, value]];
    }),
  );
}

function latencyStats(values: Array<number | null>): {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  sampleStdDev: number | null;
  coefficientOfVariation: number | null;
} {
  const filtered = values
    .filter((value): value is number => value !== null)
    .toSorted((a, b) => a - b);

  if (filtered.length === 0) {
    return {
      count: 0,
      mean: null,
      median: null,
      min: null,
      max: null,
      range: null,
      sampleStdDev: null,
      coefficientOfVariation: null,
    };
  }

  const meanValue = average(filtered);
  const medianValue = median(filtered);
  const minValue = filtered[0];
  const maxValue = filtered[filtered.length - 1];
  const rangeValue = maxValue - minValue;
  const sampleStdDevValue =
    filtered.length > 1 && meanValue !== null
      ? Math.sqrt(
          sum(filtered.map((value) => (value - meanValue) ** 2))! /
            (filtered.length - 1),
        )
      : null;
  const coefficientOfVariationValue =
    sampleStdDevValue !== null && meanValue !== null && meanValue !== 0
      ? (sampleStdDevValue / meanValue) * 100
      : null;

  return {
    count: filtered.length,
    mean: meanValue,
    median: medianValue,
    min: minValue,
    max: maxValue,
    range: rangeValue,
    sampleStdDev: sampleStdDevValue,
    coefficientOfVariation: coefficientOfVariationValue,
  };
}

function median(values: Array<number | null>): number | null {
  const filtered = values
    .filter((value): value is number => value !== null)
    .toSorted((a, b) => a - b);

  if (filtered.length === 0) {
    return null;
  }

  const midpoint = Math.floor(filtered.length / 2);

  return filtered.length % 2 === 0
    ? (filtered[midpoint - 1] + filtered[midpoint]) / 2
    : filtered[midpoint];
}

function parseArgs(rawArgs: string[]): Args {
  return {
    outDir: readStringArg(rawArgs, "--out-dir") ?? defaultOutDir,
    modelRegex: readStringArg(rawArgs, "--model-regex") ?? "^gpt-(5|4)",
    excludeRegex:
      readStringArg(rawArgs, "--exclude-regex") ??
      "(audio|realtime|transcribe|tts|image|embedding|moderation|search|codex|pro|\\d{4}-\\d{2}-\\d{2}|^gpt-4-0613$)",
    models: splitCsv(readStringArg(rawArgs, "--models")),
    limit: readNumberArg(rawArgs, "--limit"),
    listOnly: rawArgs.includes("--list-only"),
    runsPerModel: readNumberArg(rawArgs, "--runs-per-model") ?? 3,
    scenarioId: readStringArg(rawArgs, "--scenario-id"),
  };
}

function readStringArg(rawArgs: string[], name: string): string | null {
  const index = rawArgs.indexOf(name);

  if (index === -1) {
    const prefix = `${name}=`;
    const inline = rawArgs.find((arg) => arg.startsWith(prefix));
    return inline ? inline.slice(prefix.length) : null;
  }

  return rawArgs[index + 1] ?? null;
}

function readNumberArg(rawArgs: string[], name: string): number | null {
  const value = readStringArg(rawArgs, name);

  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }

  return parsed;
}

function splitCsv(value: string | null): string[] {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function loadDotEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function writeJson(fileName: string, value: unknown): void {
  writeFileSync(
    path.join(args.outDir, fileName),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function average(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => value !== null);

  if (filtered.length === 0) {
    return null;
  }

  return sum(filtered) / filtered.length;
}

function sum(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => value !== null);

  if (filtered.length === 0) {
    return null;
  }

  return filtered.reduce((total, value) => total + value, 0);
}

function formatMoney(value: number | null): string {
  return value === null ? "" : value.toFixed(8);
}

function formatNumber(value: number | null): string {
  return value === null ? "" : String(Math.round(value));
}

function formatSignedNumber(value: number | null): string {
  if (value === null) {
    return "";
  }

  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function formatPercent(value: number | null): string {
  return value === null ? "" : `${value.toFixed(1)}%`;
}

function csvCell(value: unknown): string {
  const text = String(value);

  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

await main();
