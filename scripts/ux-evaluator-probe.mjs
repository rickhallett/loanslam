#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const DEFAULT_MODELS = ["gpt-5.4-nano", "gpt-5.4-mini"];

// Standard OpenAI API prices per 1M tokens, checked against
// https://developers.openai.com/api/docs/pricing on 2026-06-14.
const PRICES_PER_1M = {
  "gpt-5.5": { input: 5, cachedInput: 0.5, output: 30 },
  "gpt-5.4-nano": { input: 0.2, cachedInput: 0.02, output: 1.25 },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.4": { input: 2.5, cachedInput: 0.25, output: 15 },
};

const findingCategories = [
  "next_step_not_actionable",
  "requested_fields_not_communicated",
  "confusion_not_resolved",
  "handoff_reason_not_explained",
  "premature_handoff_for_general_apply",
  "unjustified_personal_data_request",
  "other_ux_issue",
];

const uxEvaluationSchema = z.object({
  passed: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
  rubric: z.object({
    nextStepClear: z.boolean(),
    requestedFieldsCommunicated: z.boolean(),
    confusionResolved: z.boolean(),
    handoffJustified: z.boolean(),
    noPrematurePiiCollection: z.boolean(),
  }),
  findings: z.array(
    z.object({
      category: z.enum(findingCategories),
      severity: z.enum(["low", "medium", "high"]),
      turnIndexes: z.array(z.number().int().nonnegative()),
      evidence: z.string(),
      suggestedFix: z.string(),
    }),
  ),
});

const cases = [
  {
    id: "screenshot-opaque-handoff",
    title: "Observed vague handoff intake after user confusion",
    expectedCategories: [
      "requested_fields_not_communicated",
      "confusion_not_resolved",
      "premature_handoff_for_general_apply",
    ],
    transcript: [
      turn({
        userMessage: "hello",
        assistantMessage: "Hi! How can I help you today with your loan?",
        finalAction: "ask_clarifying_question",
        selectedServingMode: null,
      }),
      turn({
        turnIndex: 1,
        userMessage: "i would like ot take aout a loan",
        assistantMessage:
          "I cannot handle that directly in chat. I can collect a few contact details and pass this to the LoanSlam team.",
        finalAction: "request_handoff_intake",
        selectedServingMode: "handoff_account_specific",
        safetyFlags: ["account_specific_request", "change_request"],
        requestedFields: standardHandoffFields(),
        ui: intakeFormUi(),
      }),
      turn({
        turnIndex: 2,
        userMessage: "sorry?",
        assistantMessage:
          "No problem--if you'd like to take out a loan, I'll pass your details to the LoanSlam team so they can help you next.",
        finalAction: "request_handoff_intake",
        selectedServingMode: "handoff_account_specific",
        safetyFlags: ["account_specific_request", "change_request"],
        requestedFields: standardHandoffFields(),
        ui: intakeFormUi(),
      }),
      turn({
        turnIndex: 3,
        userMessage: "what details?",
        assistantMessage:
          "To help you take out a loan, I'll pass your details to the LoanSlam team. What's your full name?",
        finalAction: "request_handoff_intake",
        selectedServingMode: "handoff_account_specific",
        safetyFlags: ["account_specific_request", "change_request"],
        requestedFields: standardHandoffFields(),
        ui: intakeFormUi("What's your full name?"),
      }),
    ],
  },
  {
    id: "clear-handoff-field-disclosure",
    title: "Account-specific handoff with clear field list",
    expectedCategories: [],
    transcript: [
      turn({
        userMessage: "What is my settlement figure today?",
        assistantMessage:
          "I can't check your personal settlement figure in this chat. I can pass this to the LoanSlam team. They'll need your full name, date of birth, address, phone number, email, and a short summary of what you need. Let's start with your full name.",
        finalAction: "request_handoff_intake",
        selectedServingMode: "handoff_account_specific",
        safetyFlags: ["account_specific_request"],
        requestedFields: standardHandoffFields(),
        ui: intakeFormUi(),
      }),
    ],
  },
  {
    id: "general-apply-answer",
    title: "General application request answered without PII",
    expectedCategories: [],
    transcript: [
      turn({
        userMessage: "I would like to take out a loan",
        assistantMessage:
          "You can apply online in a few minutes using the LoanSlam application form. The first two pages give you a personalised quote with no impact on your credit score.",
        finalAction: "answer",
        selectedServingMode: "answer",
        retrievedItemIds: ["how-do-i-apply"],
      }),
    ],
  },
  {
    id: "opaque-one-turn-details",
    title: "Handoff starts with vague details request",
    expectedCategories: [
      "next_step_not_actionable",
      "requested_fields_not_communicated",
    ],
    transcript: [
      turn({
        userMessage: "Can you check whether my application was approved?",
        assistantMessage:
          "I can't check that directly in chat, but I can collect a few details and pass this to the LoanSlam team.",
        finalAction: "request_handoff_intake",
        selectedServingMode: "handoff_account_specific",
        safetyFlags: ["account_specific_request"],
        requestedFields: standardHandoffFields(),
        ui: intakeFormUi(),
      }),
    ],
  },
  {
    id: "confusion-recovered",
    title: "User confusion is resolved with clear next step",
    expectedCategories: [],
    transcript: [
      turn({
        userMessage: "I got a message from you and I don't understand it",
        assistantMessage:
          "What part would you like help with: applying, an existing loan, a payment, or something else?",
        finalAction: "ask_clarifying_question",
        selectedServingMode: null,
      }),
      turn({
        turnIndex: 1,
        userMessage: "sorry?",
        assistantMessage:
          "No problem. Tell me in your own words what the message was about, or paste the non-sensitive wording here. Please do not share card, bank, or password details.",
        finalAction: "ask_clarifying_question",
        selectedServingMode: null,
      }),
    ],
  },
];

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(helpText());
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY && !args.dryRun) {
  console.error("OPENAI_API_KEY is required unless --dry-run is set.");
  process.exit(1);
}

const selectedCases = cases.slice(0, args.maxCases ?? cases.length);
const selectedModels = args.models.length > 0 ? args.models : DEFAULT_MODELS;

if (args.dryRun) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        models: selectedModels,
        cases: selectedCases.map(({ id, title, expectedCategories }) => ({
          id,
          title,
          expectedCategories,
        })),
        plannedCalls: selectedModels.length * selectedCases.length * args.repeat,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const results = [];

for (const model of selectedModels) {
  for (let repeatIndex = 0; repeatIndex < args.repeat; repeatIndex += 1) {
    for (const evaluationCase of selectedCases) {
      results.push(
        await evaluateCase({
          client,
          model,
          evaluationCase,
          repeatIndex,
        }),
      );
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  models: selectedModels,
  caseCount: selectedCases.length,
  repeat: args.repeat,
  pricesPer1M: PRICES_PER_1M,
  summaries: summarize(results),
  results,
};

mkdirSync(dirname(args.output), { recursive: true });
writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(renderMarkdownSummary(report));
console.log("");
console.log(`JSON: ${args.output}`);

if (report.results.length > 0 && report.results.every((result) => result.error)) {
  console.error("ux-evaluator-probe: all evaluator calls failed");
  process.exitCode = 1;
}

async function evaluateCase({ client, model, evaluationCase, repeatIndex }) {
  const input = buildEvaluatorInput(evaluationCase);
  const startedAt = performance.now();
  let parsed;
  let usage;
  let error;

  try {
    const response = await client.responses.parse({
      model,
      instructions: evaluatorInstructions(),
      input,
      text: {
        format: zodTextFormat(uxEvaluationSchema, "ux_evaluation"),
      },
      max_output_tokens: 1200,
      store: false,
    });

    parsed = response.output_parsed;
    usage = response.usage;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const actualCategories = parsed?.findings?.map((finding) => finding.category) ?? [];
  const expectedCategories = evaluationCase.expectedCategories;

  return {
    model,
    caseId: evaluationCase.id,
    title: evaluationCase.title,
    repeatIndex,
    latencyMs,
    expectedCategories,
    actualCategories,
    matchedExpectedCategories: expectedCategories.filter((category) =>
      actualCategories.includes(category),
    ),
    unexpectedCategories: actualCategories.filter(
      (category) => !expectedCategories.includes(category),
    ),
    expectedRecall:
      expectedCategories.length === 0
        ? null
        : expectedCategories.filter((category) =>
            actualCategories.includes(category),
          ).length / expectedCategories.length,
    cleanCaseFalsePositive:
      expectedCategories.length === 0 && actualCategories.length > 0,
    passedExpectation: sameCategorySet(expectedCategories, actualCategories),
    output: parsed ?? null,
    usage: normalizeUsage(usage),
    estimatedCostUsd: estimateCostUsd(model, usage),
    error: error ?? null,
  };
}

function evaluatorInstructions() {
  return [
    "You are a UX evaluator for the LoanSlam Phase 0 lab harness.",
    "You are not the assistant and you are not choosing the next response.",
    "Judge whether the completed transcript was understandable and actionable for a normal customer.",
    "",
    "Use the internal trace fields as evidence, but judge the customer-visible assistant messages.",
    "A technically safe handoff can still fail UX if the user cannot tell what to do next.",
    "",
    "Rubric:",
    "- nextStepClear: true only when the latest assistant message tells the user what to do next in practical terms.",
    "- requestedFieldsCommunicated: true when requested intake fields are clearly communicated to the customer; field labels may be plain English, not exact enum keys.",
    "- confusionResolved: true when a confused user message such as 'sorry?' or 'what details?' is answered by reducing ambiguity.",
    "- handoffJustified: true when handoff/intake is explained by the customer's request or risk context.",
    "- noPrematurePiiCollection: true when personal data is not requested for a general FAQ/apply-online request without justification.",
    "",
    "Finding guidance:",
    "- Use requested_fields_not_communicated when requestedFields or ui.fields contain fields that the assistant message does not make understandable.",
    "- Use confusion_not_resolved when the user expresses confusion and the next assistant response stays vague or repeats prior copy.",
    "- Use premature_handoff_for_general_apply when a general request to apply or take out a loan is routed into personal handoff intake instead of a general answer or clarification.",
    "- Use next_step_not_actionable when the assistant asks for vague 'details' or says it can help without telling the customer what to provide or do.",
    "- Use handoff_reason_not_explained when handoff may be appropriate but the assistant does not explain why a person/team is needed.",
    "- Use unjustified_personal_data_request when the assistant asks for personal data that is not justified by the user's visible need.",
    "",
    "Return findings only for structural UX problems. Do not nitpick tone, warmth, punctuation, or minor phrasing.",
    "Every finding must cite one or more turnIndexes and brief evidence from the transcript.",
  ].join("\n");
}

function buildEvaluatorInput(evaluationCase) {
  return JSON.stringify(
    {
      task:
        "Evaluate the transcript for actionability, field disclosure, confusion recovery, and handoff justification.",
      caseId: evaluationCase.id,
      title: evaluationCase.title,
      transcript: evaluationCase.transcript,
    },
    null,
    2,
  );
}

function turn(overrides) {
  return {
    turnIndex: 0,
    userMessage: "Can I apply online?",
    assistantMessage: "You can apply online.",
    proposedAction: overrides.finalAction ?? "answer",
    finalAction: "answer",
    selectedServingMode: "answer",
    safetyFlags: [],
    requestedFields: [],
    collectedFacts: {},
    ui: {
      primitive: "message",
      message: overrides.assistantMessage ?? "You can apply online.",
      links: [],
    },
    retrievedItemIds: [],
    ...overrides,
  };
}

function standardHandoffFields() {
  return [
    "fullName",
    "dateOfBirth",
    "address",
    "phone",
    "email",
    "situationSummary",
  ];
}

function intakeFormUi(message = "I can collect a few contact details.") {
  return {
    primitive: "intake_form",
    message,
    fields: standardHandoffFields(),
  };
}

function normalizeUsage(usage) {
  if (!usage) {
    return {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }

  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;
  const cachedInputTokens =
    usage.input_tokens_details?.cached_tokens ??
    usage.prompt_tokens_details?.cached_tokens ??
    0;

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
  };
}

function estimateCostUsd(model, usage) {
  const price = PRICES_PER_1M[model];

  if (!price || !usage) {
    return null;
  }

  const normalized = normalizeUsage(usage);
  const uncachedInputTokens = Math.max(
    0,
    normalized.inputTokens - normalized.cachedInputTokens,
  );

  return roundUsd(
    (uncachedInputTokens * price.input +
      normalized.cachedInputTokens * price.cachedInput +
      normalized.outputTokens * price.output) /
      1_000_000,
  );
}

function summarize(results) {
  return selectedModels.map((model) => {
    const modelResults = results.filter((result) => result.model === model);
    const successful = modelResults.filter((result) => !result.error);
    const expectationPasses = successful.filter(
      (result) => result.passedExpectation,
    );
    const expectedFindingCases = successful.filter(
      (result) => result.expectedCategories.length > 0,
    );
    const cleanCases = successful.filter(
      (result) => result.expectedCategories.length === 0,
    );
    const usage = successful.map((result) => result.usage);

    return {
      model,
      calls: modelResults.length,
      errors: modelResults.length - successful.length,
      expectationPassRate:
        successful.length === 0
          ? 0
          : expectationPasses.length / successful.length,
      expectedFindingRecall:
        expectedFindingCases.length === 0
          ? 0
          : mean(
              expectedFindingCases.map((result) => result.expectedRecall ?? 0),
            ),
      cleanCaseFalsePositiveRate:
        cleanCases.length === 0
          ? 0
          : cleanCases.filter((result) => result.cleanCaseFalsePositive)
              .length / cleanCases.length,
      averageUnexpectedCategories: average(
        successful.map((result) => result.unexpectedCategories.length),
      ),
      averageLatencyMs: average(successful.map((result) => result.latencyMs)),
      p95LatencyMs: percentile(
        successful.map((result) => result.latencyMs),
        0.95,
      ),
      totalInputTokens: sum(usage.map((entry) => entry.inputTokens)),
      totalCachedInputTokens: sum(
        usage.map((entry) => entry.cachedInputTokens),
      ),
      totalOutputTokens: sum(usage.map((entry) => entry.outputTokens)),
      totalEstimatedCostUsd: roundUsd(
        sum(
          successful.map((result) =>
            typeof result.estimatedCostUsd === "number"
              ? result.estimatedCostUsd
              : 0,
          ),
        ),
      ),
    };
  });
}

function renderMarkdownSummary(report) {
  const lines = [
    "# UX Evaluator Probe",
    "",
    `Cases: ${report.caseCount}`,
    `Repeat: ${report.repeat}`,
    "",
    "## Summary",
    "",
    "| Model | Calls | Errors | Quality | Avg latency | P95 latency | Cost |",
    "|---|---:|---:|---:|---:|---:|---:|",
  ];

  for (const summary of report.summaries) {
    lines.push(
      `| ${[
        summary.model,
        summary.calls,
        summary.errors,
        `${percent(summary.expectationPassRate)} strict / ${percent(summary.expectedFindingRecall)} recall / ${percent(summary.cleanCaseFalsePositiveRate)} clean FP`,
        `${summary.averageLatencyMs}ms`,
        `${summary.p95LatencyMs}ms`,
        `$${summary.totalEstimatedCostUsd.toFixed(6)}`,
      ].join(" | ")} |`,
    );
  }

  lines.push("", "## Case Results", "");

  for (const result of report.results) {
    lines.push(
      `- ${result.model} ${result.caseId}: ${
        result.error
          ? `ERROR ${result.error}`
          : result.passedExpectation
            ? "matched"
            : `mismatch expected=${result.expectedCategories.join(",") || "none"} actual=${result.actualCategories.join(",") || "none"}`
      } (${result.latencyMs}ms, ${
        typeof result.estimatedCostUsd === "number"
          ? `$${result.estimatedCostUsd.toFixed(6)}`
          : "cost unknown"
      })`,
    );
  }

  return lines.join("\n");
}

function parseArgs(rawArgs) {
  const parsed = {
    models: [],
    maxCases: undefined,
    repeat: 1,
    output: join(
      "artifacts",
      "phase0",
      `ux-evaluator-probe-${Date.now()}.json`,
    ),
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    switch (arg) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--models":
        parsed.models = readValue(rawArgs, index, arg)
          .split(",")
          .map((model) => model.trim())
          .filter(Boolean);
        index += 1;
        break;
      case "--max-cases":
        parsed.maxCases = Number(readValue(rawArgs, index, arg));
        if (!Number.isInteger(parsed.maxCases) || parsed.maxCases < 1) {
          throw new Error("--max-cases must be a positive integer.");
        }
        index += 1;
        break;
      case "--repeat":
        parsed.repeat = Number(readValue(rawArgs, index, arg));
        if (!Number.isInteger(parsed.repeat) || parsed.repeat < 1) {
          throw new Error("--repeat must be a positive integer.");
        }
        index += 1;
        break;
      case "--output":
        parsed.output = readValue(rawArgs, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function readValue(args, index, name) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

function sameCategorySet(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  if (expectedSet.size !== actualSet.size) {
    return false;
  }

  return [...expectedSet].every((category) => actualSet.has(category));
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(sum(values) / values.length);
}

function mean(values) {
  if (values.length === 0) {
    return 0;
  }

  return sum(values) / values.length;
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[index] ?? 0;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function roundUsd(value) {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function helpText() {
  return [
    "UX evaluator model probe",
    "",
    "Usage:",
    "  node scripts/ux-evaluator-probe.mjs [options]",
    "",
    "Options:",
    "  --models <a,b>      Comma-separated model IDs. Default: gpt-5.4-nano,gpt-5.4-mini",
    "  --max-cases <n>     Run the first n built-in cases.",
    "  --repeat <n>        Repeat each case/model n times.",
    "  --output <path>     JSON output path. Default: artifacts/phase0/ux-evaluator-probe-<ts>.json",
    "  --dry-run           Print planned calls without using the API.",
  ].join("\n");
}
