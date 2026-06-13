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

const nonEmptyStringSchema = z.string().trim().min(1);

const openAiApprovedLinkSchema = z.object({
  label: nonEmptyStringSchema,
  url: z.string().url().nullable(),
  href: z.string().url().nullable(),
});

const openAiMessageUiSchema = z.object({
  primitive: z.literal("message"),
  message: nonEmptyStringSchema,
  links: z.array(openAiApprovedLinkSchema),
});

const openAiClarifyingPromptUiSchema = z.object({
  primitive: z.literal("clarifying_prompt"),
  message: nonEmptyStringSchema,
  questions: z.array(nonEmptyStringSchema).min(1),
});

const openAiChoiceListUiSchema = z.object({
  primitive: z.literal("choice_list"),
  message: nonEmptyStringSchema,
  choices: z
    .array(
      z.object({
        id: nonEmptyStringSchema,
        label: nonEmptyStringSchema,
      }),
    )
    .min(1)
    .max(6),
});

const openAiIntakeFormUiSchema = z.object({
  primitive: z.literal("intake_form"),
  message: nonEmptyStringSchema,
  fields: z.array(intakeFieldSchema).min(1),
});

const openAiHandoffConfirmationUiSchema = z.object({
  primitive: z.literal("handoff_confirmation"),
  message: nonEmptyStringSchema,
  reference: z.string().trim().nullable(),
});

const openAiSafeFallbackUiSchema = z.object({
  primitive: z.literal("safe_fallback"),
  message: nonEmptyStringSchema,
  links: z.array(openAiApprovedLinkSchema),
});

const openAiUiPlanSchema = z.discriminatedUnion("primitive", [
  openAiMessageUiSchema,
  openAiClarifyingPromptUiSchema,
  openAiChoiceListUiSchema,
  openAiIntakeFormUiSchema,
  openAiHandoffConfirmationUiSchema,
  openAiSafeFallbackUiSchema,
]);

const openAiGroundingDecisionSchema = z.object({
  citedItemIds: z.array(nonEmptyStringSchema),
  servingMode: servingModeSchema,
  confidence: z.enum(["supported", "partial", "unsupported"]),
  notes: z.string().trim().nullable(),
});

const openAiTurnPlanOutputSchema = z.object({
  action: turnActionSchema,
  customerMessage: nonEmptyStringSchema,
  ui: openAiUiPlanSchema,
  reasonCode: nonEmptyStringSchema,
  collectedFacts: z.record(z.string(), z.string()),
  requestedFields: z.array(intakeFieldSchema),
  grounding: openAiGroundingDecisionSchema.nullable(),
  safetyFlags: z.array(safetyFlagSchema),
  traceSummary: nonEmptyStringSchema,
});

function normalizeOpenAiParsedTurnPlan(parsed: unknown): unknown {
  if (!isRecord(parsed)) {
    return parsed;
  }

  return {
    ...parsed,
    ui: normalizeUiPlan(parsed.ui),
    grounding: normalizeGrounding(parsed.grounding),
  };
}

function normalizeUiPlan(ui: unknown): unknown {
  if (!isRecord(ui)) {
    return ui;
  }

  const links = Array.isArray(ui.links)
    ? ui.links.map(normalizeLink)
    : ui.links;
  const reference = ui.reference === null ? undefined : ui.reference;

  return {
    ...ui,
    ...(links === undefined ? {} : { links }),
    ...(reference === undefined ? { reference: undefined } : { reference }),
  };
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
