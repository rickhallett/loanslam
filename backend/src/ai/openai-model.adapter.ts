import { z } from 'zod';
import type { IntakeFieldName } from '@loanslam/contracts';
import type {
  ClassificationInput,
  ClassificationResult,
  ExtractInput,
  ExtractResult,
  ModelAdapter,
  PhraseInput,
  ProposedAction,
  VulnerabilityInput,
  VulnerabilityVerdict,
} from '../ports/model.port.js';
import type { Logger } from '../config/logger.js';
import { logger as defaultLogger } from '../config/logger.js';
import { looksLikeCredential } from '../domain/credentials.js';
import { DeterministicModelAdapter } from './deterministic-model.adapter.js';
import { getOpenAI, modelName } from './openai-client.js';
import {
  buildClassificationPrompt,
  buildExtractPrompt,
  buildPhrasePrompt,
  buildVulnerabilityPrompt,
  type ChatMessage,
} from './prompts.js';

/**
 * The fail-closed vulnerability verdict. ANY error, timeout, or invalid model
 * output for the vulnerability check yields this: treat the turn as a possible
 * vulnerability and route to a human (brief §16, architecture.md "vulnerability
 * gate fails closed"). This is the safety-critical default.
 */
const FAILCLOSED_VERDICT: VulnerabilityVerdict = {
  vulnerable: true,
  category: 'uncertain',
  confidence: 0,
  source: 'failclosed',
};

/** Per-call timeout for model requests. */
const MODEL_TIMEOUT_MS = 8_000;

/**
 * The minimal slice of the OpenAI SDK this adapter uses. Declaring it
 * structurally keeps the adapter testable: a fake only needs this shape, not the
 * full SDK type surface.
 */
export interface ChatCompletionClient {
  chat: {
    completions: {
      create(
        params: {
          model: string;
          messages: ChatMessage[];
          temperature?: number;
          response_format?: { type: 'json_object' };
        },
        options?: { signal?: AbortSignal },
      ): Promise<{ choices: Array<{ message: { content: string | null } }> }>;
    };
  };
}

// ── Model-output validators ──────────────────────────────────────────────────
// We never trust raw model JSON: validate it against a schema before use.

const vulnerabilitySchema = z.object({
  vulnerable: z.boolean(),
  category: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const PROPOSED_ACTIONS = [
  'answer',
  'clarify',
  'handoff_account_specific',
  'change_request',
  'excluded_topic',
  'fallback',
  'refusal',
] as const satisfies readonly ProposedAction[];

const classificationSchema = z.object({
  action: z.enum(PROPOSED_ACTIONS),
  customerGoal: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const extractionSchema = z.object({
  slots: z.record(z.string(), z.string()).default({}),
  signals: z.object({
    correction: z.boolean(),
    refusal: z.boolean(),
    offTopic: z.boolean(),
    question: z.boolean(),
  }),
  confidence: z.number().min(0).max(1),
});

/**
 * Sanitise model-returned slots: keep only keys the journey requested, drop
 * empties, and drop anything credential-shaped. Defence in depth over the typed
 * key restriction — the model output is never trusted raw (brief §16).
 */
function sanitiseSlots(
  raw: Record<string, string>,
  requested: IntakeFieldName[],
): Partial<Record<IntakeFieldName, string>> {
  const allowed = new Set<string>(requested);
  const out: Partial<Record<IntakeFieldName, string>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key)) continue;
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    if (looksLikeCredential(trimmed)) continue;
    out[key as IntakeFieldName] = trimmed;
  }
  return out;
}

function parseJson(content: string | null): unknown {
  if (content === null) throw new Error('empty model content');
  // Tolerate accidental code fences without trusting the content otherwise.
  const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(trimmed);
}

export class OpenAiModelAdapter implements ModelAdapter {
  private readonly client: ChatCompletionClient;
  private readonly model: string;
  private readonly fallback: DeterministicModelAdapter;
  private readonly logger: Logger;

  constructor(
    client: ChatCompletionClient = getOpenAI() as unknown as ChatCompletionClient,
    model: string = modelName,
    fallback: DeterministicModelAdapter = new DeterministicModelAdapter(),
    logger: Logger = defaultLogger,
  ) {
    this.client = client;
    this.model = model;
    this.fallback = fallback;
    this.logger = logger;
  }

  async detectVulnerability(input: VulnerabilityInput): Promise<VulnerabilityVerdict> {
    try {
      const content = await this.call(buildVulnerabilityPrompt(input), true);
      const verdict = vulnerabilitySchema.parse(parseJson(content));
      return { ...verdict, source: 'model' };
    } catch (err) {
      // FAIL CLOSED: any error/timeout/parse/validation failure routes to safety.
      this.logger.warn({ err }, 'vulnerability check failed; failing closed');
      return { ...FAILCLOSED_VERDICT };
    }
  }

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    try {
      const content = await this.call(buildClassificationPrompt(input), true);
      const parsed = classificationSchema.parse(parseJson(content));
      return { ...parsed, source: 'model' };
    } catch (err) {
      // Classification is not safety-critical: degrade to the deterministic
      // rule-based classifier rather than failing the turn.
      this.logger.warn({ err }, 'classification failed; using deterministic fallback');
      return this.fallback.classify(input);
    }
  }

  async phraseAnswer(input: PhraseInput): Promise<string | null> {
    try {
      const content = await this.call(buildPhrasePrompt(input), false);
      const text = content?.trim();
      if (!text) return null;
      return text;
    } catch (err) {
      // Returning null makes the caller route to safe fallback copy.
      this.logger.warn({ err }, 'phrasing failed; routing to fallback');
      return null;
    }
  }

  async extract(input: ExtractInput): Promise<ExtractResult> {
    try {
      const content = await this.call(buildExtractPrompt(input), true);
      const parsed = extractionSchema.parse(parseJson(content));
      return {
        slots: sanitiseSlots(parsed.slots, input.requestedSlots),
        signals: parsed.signals,
        confidence: parsed.confidence,
        source: 'model',
      };
    } catch (err) {
      // Extraction is not safety-critical: degrade to the deterministic extractor
      // rather than failing the turn.
      this.logger.warn({ err }, 'extraction failed; using deterministic fallback');
      return this.fallback.extract(input);
    }
  }

  /** One model call with an AbortController timeout. Returns the message text. */
  private async call(messages: ChatMessage[], json: boolean): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          messages,
          temperature: 0,
          ...(json ? { response_format: { type: 'json_object' as const } } : {}),
        },
        { signal: controller.signal },
      );
      return completion.choices[0]?.message.content ?? null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Factory mirroring the manual-composition convention. */
export function createOpenAiModelAdapter(
  client: ChatCompletionClient = getOpenAI() as unknown as ChatCompletionClient,
  model: string = modelName,
  fallback: DeterministicModelAdapter = new DeterministicModelAdapter(),
  logger: Logger = defaultLogger,
): OpenAiModelAdapter {
  return new OpenAiModelAdapter(client, model, fallback, logger);
}
