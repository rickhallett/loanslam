import type {
  TurnPlan,
  TurnPlanner,
  TurnPlannerInput,
} from "@loanslam/contracts";
import {
  intakeFieldSchema,
  safetyFlagSchema,
  servingModeSchema,
  turnActionSchema,
  turnPlanSchema,
  uiPrimitiveSchema,
  type UiPrimitive,
} from "@loanslam/contracts";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { OpenAiPlannerConfig } from "./config";
import { buildTurnPlannerPrompt } from "./prompt";

export interface OpenAiPlannerRequest {
  model: string;
  instructions: string;
  input: string;
  text: {
    format: unknown;
  };
  metadata: {
    provider: "openai";
    promptVersion: string;
    policyVersion: string;
  };
  store: false;
}

export interface OpenAiPlannerClient {
  responses: {
    parse(request: OpenAiPlannerRequest): Promise<{
      output_parsed: unknown;
    }>;
  };
}

export interface OpenAiTurnPlannerOptions {
  config: OpenAiPlannerConfig;
  client?: OpenAiPlannerClient;
}

export class OpenAiTurnPlanner implements TurnPlanner {
  readonly metadata;

  private readonly client: OpenAiPlannerClient;
  private readonly config: OpenAiPlannerConfig;

  constructor(options: OpenAiTurnPlannerOptions) {
    this.config = options.config;
    this.client =
      options.client ??
      (new OpenAI({ apiKey: options.config.apiKey }) as OpenAiPlannerClient);
    this.metadata = {
      provider: this.config.provider,
      model: this.config.model,
      promptVersion: this.config.promptVersion,
    };
  }

  async planTurn(input: TurnPlannerInput): Promise<TurnPlan> {
    const prompt = buildTurnPlannerPrompt(input);
    const response = await this.client.responses.parse({
      model: this.config.model,
      instructions: prompt.system,
      input: prompt.user,
      text: {
        format: zodTextFormat(openAiTurnPlanOutputSchema, "turn_plan"),
      },
      metadata: {
        provider: this.config.provider,
        promptVersion: this.config.promptVersion,
        policyVersion: input.policyVersion,
      },
      store: false,
    });

    return turnPlanSchema.parse(
      normalizeOpenAiParsedTurnPlan(response.output_parsed),
    );
  }
}

// --- OpenAI strict structured-output mirror --------------------------------
// STRICT_MODE_INVARIANT: OpenAI strict structured output (zodTextFormat) forbids
// the constructs the canonical turnPlanSchema relies on — optional fields,
// string formats (.url()), min/max constraints, and discriminated unions. So we
// hand the model a LENIENT MIRROR of the schema below: every field required,
// plain strings, `nullable()` instead of `optional()`, and a single flat UI
// object carrying every primitive's fields at once. normalizeOpenAiParsedTurnPlan
// then reverses that padding (drops null link fields, picks the per-primitive UI
// shape, folds collectedFacts back into a record) before turnPlanSchema.parse.
// This layer is load-bearing: without it turnPlanSchema.parse throws on
// essentially every live turn.
const openAiStringSchema = z.string();

const openAiApprovedLinkSchema = z.object({
  label: openAiStringSchema,
  url: openAiStringSchema.nullable(),
  href: openAiStringSchema.nullable(),
});

const openAiUiPlanSchema = z.object({
  primitive: uiPrimitiveSchema,
  message: openAiStringSchema,
  links: z.array(openAiApprovedLinkSchema),
  questions: z.array(openAiStringSchema),
  choices: z.array(
    z.object({
      id: openAiStringSchema,
      label: openAiStringSchema,
    }),
  ),
  fields: z.array(intakeFieldSchema),
  reference: z.string().trim().nullable(),
});

const openAiGroundingDecisionSchema = z.object({
  citedItemIds: z.array(openAiStringSchema),
  servingMode: servingModeSchema,
  confidence: z.enum(["supported", "partial", "unsupported"]),
  notes: openAiStringSchema.nullable(),
});

const openAiTurnPlanOutputSchema = z.object({
  action: turnActionSchema,
  customerMessage: openAiStringSchema,
  ui: openAiUiPlanSchema,
  reasonCode: openAiStringSchema,
  collectedFacts: z.array(
    z.object({
      key: openAiStringSchema,
      value: openAiStringSchema,
    }),
  ),
  requestedFields: z.array(intakeFieldSchema),
  grounding: openAiGroundingDecisionSchema.nullable(),
  safetyFlags: z.array(safetyFlagSchema),
  traceSummary: openAiStringSchema,
});

function normalizeOpenAiParsedTurnPlan(parsed: unknown): unknown {
  if (!isRecord(parsed)) {
    return parsed;
  }

  return {
    ...parsed,
    ui: normalizeUiPlan(parsed.ui),
    grounding: normalizeGrounding(parsed.grounding),
    collectedFacts: normalizeCollectedFacts(parsed.collectedFacts),
  };
}

function normalizeCollectedFacts(collectedFacts: unknown): unknown {
  if (!Array.isArray(collectedFacts)) {
    return collectedFacts;
  }

  const facts: Record<string, string> = {};

  for (const fact of collectedFacts) {
    if (!isRecord(fact)) {
      continue;
    }

    const key = String(fact.key ?? "");

    if (!key) {
      continue;
    }

    facts[key] = String(fact.value ?? "");
  }

  return facts;
}

// One canonicalizer per UI primitive: each strips the strict-mode mirror down to
// exactly the fields the canonical uiPlanSchema keeps for that primitive. Most
// are plain field-keeps; clarifying_prompt and handoff_confirmation carry real
// repair logic (questions fallback, null-reference omission) kept explicit here.
const uiPlanCanonicalizers: Record<
  UiPrimitive,
  (ui: Record<string, unknown>) => unknown
> = {
  message: (ui) => ({
    primitive: "message",
    message: ui.message,
    links: normalizeLinks(ui.links),
  }),
  clarifying_prompt: (ui) => ({
    primitive: "clarifying_prompt",
    message: ui.message,
    questions:
      Array.isArray(ui.questions) && ui.questions.length > 0
        ? ui.questions
        : [String(ui.message ?? "")],
  }),
  choice_list: (ui) => ({
    primitive: "choice_list",
    message: ui.message,
    choices: Array.isArray(ui.choices) ? ui.choices.slice(0, 6) : ui.choices,
  }),
  intake_form: (ui) => ({
    primitive: "intake_form",
    message: ui.message,
    fields: ui.fields,
  }),
  handoff_confirmation: (ui) => ({
    primitive: "handoff_confirmation",
    message: ui.message,
    ...(ui.reference === null ? {} : { reference: ui.reference }),
  }),
  safe_fallback: (ui) => ({
    primitive: "safe_fallback",
    message: ui.message,
    links: normalizeLinks(ui.links),
  }),
};

function normalizeUiPlan(ui: unknown): unknown {
  if (!isRecord(ui)) {
    return ui;
  }

  const primitive = ui.primitive;
  const canonicalizer =
    typeof primitive === "string" && primitive in uiPlanCanonicalizers
      ? uiPlanCanonicalizers[primitive as UiPrimitive]
      : undefined;

  return canonicalizer ? canonicalizer(ui) : ui;
}

function normalizeLinks(links: unknown): unknown {
  return Array.isArray(links) ? links.map(normalizeLink) : links;
}

function normalizeGrounding(grounding: unknown): unknown {
  if (!isRecord(grounding)) {
    return grounding;
  }

  const { notes, ...rest } = grounding;
  return notes === null ? rest : grounding;
}

function normalizeLink(link: unknown): unknown {
  if (!isRecord(link)) {
    return link;
  }

  return Object.fromEntries(
    Object.entries(link).filter(
      ([key, value]) => !(value === null && (key === "url" || key === "href")),
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
