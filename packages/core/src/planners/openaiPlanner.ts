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

function normalizeUiPlan(ui: unknown): unknown {
  if (!isRecord(ui)) {
    return ui;
  }

  const links = Array.isArray(ui.links)
    ? ui.links.map(normalizeLink)
    : ui.links;

  if (ui.primitive === "message") {
    return {
      primitive: ui.primitive,
      message: ui.message,
      links,
    };
  }

  if (ui.primitive === "clarifying_prompt") {
    return {
      primitive: ui.primitive,
      message: ui.message,
      questions: ui.questions,
    };
  }

  if (ui.primitive === "choice_list") {
    return {
      primitive: ui.primitive,
      message: ui.message,
      choices: ui.choices,
    };
  }

  if (ui.primitive === "intake_form") {
    return {
      primitive: ui.primitive,
      message: ui.message,
      fields: ui.fields,
    };
  }

  if (ui.primitive === "handoff_confirmation") {
    return {
      primitive: ui.primitive,
      message: ui.message,
      ...(ui.reference === null ? {} : { reference: ui.reference }),
    };
  }

  if (ui.primitive === "safe_fallback") {
    return {
      primitive: ui.primitive,
      message: ui.message,
      links,
    };
  }

  return ui;
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
