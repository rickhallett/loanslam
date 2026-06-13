import OpenAI from 'openai';
import { config } from '../config/env.js';

/**
 * OpenAI-compatible client. We inject `baseURL` so the same code drives
 * OpenAI, OpenRouter, or any compatible endpoint (architecture.md: model access
 * comes from config/env, never hardcoded). Instantiation is lazy and cached so
 * importing this module has no side effects and tests can avoid touching it.
 */
let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!cached) {
    cached = new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
    });
  }
  return cached;
}

/** The configured model name (e.g. 'gpt-4o-mini'). */
export const modelName: string = config.ai.model;
