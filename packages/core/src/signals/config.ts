export const defaultOpenAiSignalExtractorModel = "gpt-5.4-nano";
export const defaultOpenAiSignalExtractorPromptVersion = "phase0-signals-v1";

export interface OpenAiSignalExtractorConfig {
  provider: "openai";
  apiKey: string;
  model: string;
  promptVersion: string;
}

export type SignalExtractorEnv = Record<string, string | undefined>;

export function loadOpenAiSignalExtractorConfig(
  env: SignalExtractorEnv = process.env,
): OpenAiSignalExtractorConfig | null {
  const apiKey = env.OPENAI_SIGNAL_EXTRACTOR_API_KEY?.trim() ??
    env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return {
    provider: "openai",
    apiKey,
    model: env.OPENAI_SIGNAL_EXTRACTOR_MODEL?.trim() || defaultOpenAiSignalExtractorModel,
    promptVersion:
      env.OPENAI_SIGNAL_EXTRACTOR_PROMPT_VERSION?.trim() ||
      defaultOpenAiSignalExtractorPromptVersion,
  };
}
