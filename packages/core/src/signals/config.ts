export const defaultOpenAiSignalExtractorModel = "gpt-5.4-nano";
export const defaultOpenAiSignalExtractorPromptVersion = "phase0-signals-v2";

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
  const dedicatedApiKey = env.OPENAI_SIGNAL_EXTRACTOR_API_KEY?.trim();
  const enabled = isEnabled(env.OPENAI_SIGNAL_EXTRACTOR_ENABLED);
  const apiKey =
    dedicatedApiKey ?? (enabled ? env.OPENAI_API_KEY?.trim() : undefined);

  if (!apiKey) {
    return null;
  }

  return {
    provider: "openai",
    apiKey,
    model:
      env.OPENAI_SIGNAL_EXTRACTOR_MODEL?.trim() ||
      defaultOpenAiSignalExtractorModel,
    promptVersion:
      env.OPENAI_SIGNAL_EXTRACTOR_PROMPT_VERSION?.trim() ||
      defaultOpenAiSignalExtractorPromptVersion,
  };
}

function isEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}
