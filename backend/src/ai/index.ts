import type { AppConfig } from '../config/env.js';
import type { Logger } from '../config/logger.js';
import type { ModelAdapter } from '../ports/model.port.js';
import { DeterministicModelAdapter } from './deterministic-model.adapter.js';
import { OpenAiModelAdapter } from './openai-model.adapter.js';
import { getOpenAI } from './openai-client.js';

export { DeterministicModelAdapter, createDeterministicModelAdapter } from './deterministic-model.adapter.js';
export { OpenAiModelAdapter, createOpenAiModelAdapter } from './openai-model.adapter.js';
export type { ChatCompletionClient } from './openai-model.adapter.js';
export { getOpenAI, modelName } from './openai-client.js';

/**
 * Composition entry point for the model boundary. Returns the model-backed
 * adapter when AI is enabled (and an API key is present, per config), otherwise
 * the zero-network deterministic adapter. The deterministic adapter is also the
 * fallback the model adapter delegates to, so the pipeline always has a safe
 * path.
 */
export function createModelAdapter(config: AppConfig, logger: Logger): ModelAdapter {
  if (config.ai.enabled) {
    return new OpenAiModelAdapter(
      getOpenAI() as unknown as import('./openai-model.adapter.js').ChatCompletionClient,
      config.ai.model,
      new DeterministicModelAdapter(config),
      logger,
    );
  }
  return new DeterministicModelAdapter(config);
}
