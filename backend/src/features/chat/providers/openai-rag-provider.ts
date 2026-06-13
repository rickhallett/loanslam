import OpenAI from 'openai';

import type { GroundingCitation, RetrievalResult } from '@loanslam/contracts';

import type { AppEnv } from '../../../config/env.js';
import type { RagInput, RagProvider } from './rag-provider.js';

export class OpenAIRagProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIRagProviderConfigurationError';
  }
}

export interface OpenAIRagProviderOptions {
  apiKey?: string | undefined;
  vectorStoreId?: string | undefined;
  scoreThreshold: number;
  client?: OpenAI | undefined;
}

export class OpenAIRagProvider implements RagProvider {
  private readonly client: OpenAI | null;

  constructor(private readonly options: OpenAIRagProviderOptions) {
    this.client =
      options.client ?? (options.apiKey ? new OpenAI({ apiKey: options.apiKey }) : null);
  }

  static fromEnv(env: AppEnv): OpenAIRagProvider {
    return new OpenAIRagProvider({
      apiKey: env.OPENAI_API_KEY,
      vectorStoreId: env.OPENAI_VECTOR_STORE_ID,
      scoreThreshold: env.OPENAI_RAG_SCORE_THRESHOLD,
    });
  }

  async retrieve(input: RagInput): Promise<RetrievalResult> {
    const client = this.requireClient();
    const vectorStoreId = this.requireVectorStoreId();
    const page = await client.vectorStores.search(vectorStoreId, {
      query: input.message,
      max_num_results: 5,
      ranking_options: {
        ranker: 'auto',
        score_threshold: this.options.scoreThreshold,
      },
    });
    const results = page.data ?? [];
    const citations = results
      .filter((result) => result.score >= this.options.scoreThreshold)
      .map((result): GroundingCitation => {
        const attributes = result.attributes ?? {};
        const title = getStringAttribute(attributes, 'title') ?? result.filename;
        const sourceId =
          getStringAttribute(attributes, 'sourceId') ??
          getStringAttribute(attributes, 'id') ??
          result.file_id;
        const excerpt = result.content.find((content) => content.type === 'text')?.text;
        const url = getStringAttribute(attributes, 'url');
        const citation: GroundingCitation = {
          sourceId,
          title,
          score: result.score,
        };

        if (excerpt) {
          citation.excerpt = excerpt;
        }

        if (url) {
          citation.url = url;
        }

        return citation;
      });
    const topScore = citations[0]?.score;
    const result: RetrievalResult = {
      answerable: citations.length > 0,
      grounded: citations.length > 0,
      citations,
      reasonCode: citations.length > 0 ? 'grounded_retrieval' : 'ungrounded_retrieval',
    };

    if (topScore !== undefined) {
      result.score = topScore;
    }

    if (citations.length > 0) {
      result.context = citations
        .map((item) => [item.title, item.excerpt].filter(Boolean).join(': '))
        .join('\n\n');
    }

    return result;
  }

  private requireClient(): OpenAI {
    if (!this.client) {
      throw new OpenAIRagProviderConfigurationError('OPENAI_API_KEY is required');
    }

    return this.client;
  }

  private requireVectorStoreId(): string {
    if (!this.options.vectorStoreId) {
      throw new OpenAIRagProviderConfigurationError('OPENAI_VECTOR_STORE_ID is required');
    }

    return this.options.vectorStoreId;
  }
}

function getStringAttribute(
  attributes: Record<string, string | number | boolean>,
  key: string,
): string | undefined {
  const value = attributes[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
