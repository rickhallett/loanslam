import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import {
  classifierResultSchema,
  vulnerabilityResultSchema,
  type ClassifierResult,
  type VulnerabilityResult,
} from '@loanslam/contracts';

import type { AppEnv } from '../../../config/env.js';
import type {
  ClassifierInput,
  GeneratedAnswer,
  GenerateAnswerInput,
  ModelProvider,
  VulnerabilityInput,
} from './model-provider.js';

const answerResultSchema = z
  .object({
    text: z.string().min(1),
    reasonCode: z.string().min(1),
  })
  .strict();

type AnswerResult = z.infer<typeof answerResultSchema>;

export class OpenAIModelProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIModelProviderConfigurationError';
  }
}

export interface OpenAIModelProviderOptions {
  apiKey?: string | undefined;
  model: string;
  client?: OpenAI | undefined;
}

export class OpenAIModelProvider implements ModelProvider {
  private readonly client: OpenAI | null;

  constructor(private readonly options: OpenAIModelProviderOptions) {
    this.client =
      options.client ?? (options.apiKey ? new OpenAI({ apiKey: options.apiKey }) : null);
  }

  static fromEnv(env: AppEnv): OpenAIModelProvider {
    return new OpenAIModelProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
    });
  }

  classifyVulnerability(input: VulnerabilityInput): Promise<VulnerabilityResult> {
    return this.parseStructured(
      vulnerabilityResultSchema,
      'loanslam_vulnerability_result',
      [
        'Classify whether this anonymous Loanslam support chat message indicates vulnerability.',
        'Route to a human when the customer appears vulnerable, asks for urgent help, or when uncertain.',
        'Return conservative JSON only.',
      ].join(' '),
      input,
    );
  }

  classifyAction(input: ClassifierInput): Promise<ClassifierResult> {
    return this.parseStructured(
      classifierResultSchema,
      'loanslam_classifier_result',
      [
        'Choose the safest backend action for a Loanslam support chat.',
        'Answer only general, grounded support questions.',
        'Use request_handoff_intake for account-specific, change-making, or customer-specific requests.',
        'Use safe_fallback for unsupported or ungrounded requests.',
        `Allowed actions: ${input.allowedActions.join(', ')}.`,
      ].join(' '),
      input,
    );
  }

  generateAnswer(input: GenerateAnswerInput): Promise<GeneratedAnswer> {
    return this.parseStructured(
      answerResultSchema,
      'loanslam_grounded_answer',
      [
        'Write a concise Loanslam support answer using only the supplied retrieval context and citations.',
        'Do not invent policy, eligibility, affordability, or account-specific facts.',
        'If the context is insufficient, return a safe_fallback reason code.',
      ].join(' '),
      input,
    );
  }

  private async parseStructured<T extends z.ZodType>(
    schema: T,
    name: string,
    instructions: string,
    input: unknown,
  ): Promise<z.infer<T>> {
    const client = this.requireClient();
    const response = await client.responses.parse({
      model: this.options.model,
      instructions,
      input: JSON.stringify(input),
      text: {
        format: zodTextFormat(schema, name),
      },
    });

    if (!response.output_parsed) {
      throw new Error('OpenAI structured response was empty');
    }

    return response.output_parsed;
  }

  private requireClient(): OpenAI {
    if (!this.client) {
      throw new OpenAIModelProviderConfigurationError('OPENAI_API_KEY is required');
    }

    return this.client;
  }
}

export type { AnswerResult };
