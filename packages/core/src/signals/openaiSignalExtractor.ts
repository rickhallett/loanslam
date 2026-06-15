import type {
  SignalBundle,
  SignalExtractor,
  SignalInput,
} from "@loanslam/contracts";
import { signalBundleSchema } from "@loanslam/contracts";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { OpenAiSignalExtractorConfig } from "./config";
import {
  buildSignalExtractorPrompt,
  parseSignalBundle,
} from "./prompt";

export interface OpenAiSignalExtractorRequest {
  model: string;
  instructions: string;
  input: string;
  text: {
    format: unknown;
  };
  metadata: {
    provider: "openai";
    promptVersion: string;
    signalSchemaVersion: string;
  };
  store: false;
}

export interface OpenAiSignalExtractorClient {
  responses: {
    parse(request: OpenAiSignalExtractorRequest): Promise<{
      output_parsed: unknown;
    }>;
  };
}

export interface OpenAiSignalExtractorOptions {
  config: OpenAiSignalExtractorConfig;
  client?: OpenAiSignalExtractorClient;
}

export class OpenAiSignalExtractor implements SignalExtractor {
  readonly metadata;

  private readonly client: OpenAiSignalExtractorClient;
  private readonly config: OpenAiSignalExtractorConfig;

  constructor(options: OpenAiSignalExtractorOptions) {
    this.config = options.config;
    this.client =
      options.client ??
      (new OpenAI({ apiKey: options.config.apiKey }) as OpenAiSignalExtractorClient);
    this.metadata = {
      provider: this.config.provider,
      model: this.config.model,
      promptVersion: this.config.promptVersion,
      schemaVersion: "phase0-signals-schema-v1",
    };
  }

  async extractSignals(input: SignalInput): Promise<SignalBundle> {
    const prompt = buildSignalExtractorPrompt(input);
    const response = await this.client.responses.parse({
      model: this.config.model,
      instructions: prompt.system,
      input: prompt.user,
      text: {
        format: zodTextFormat(signalBundleSchema, "signal_bundle"),
      },
      metadata: {
        provider: this.config.provider,
        promptVersion: this.config.promptVersion,
        signalSchemaVersion: "phase0-signals-schema-v1",
      },
      store: false,
    });

    return signalBundleSchema.parse(parseSignalBundle(response.output_parsed));
  }
}
