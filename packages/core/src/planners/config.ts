export const defaultOpenAiPlannerModel = "gpt-5.5";
export const defaultOpenAiPlannerPromptVersion = "phase0-turnplanner-v1";

export interface OpenAiPlannerConfig {
  provider: "openai";
  apiKey: string;
  model: string;
  promptVersion: string;
}

export type PlannerEnv = Record<string, string | undefined>;

export class PlannerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerConfigurationError";
  }
}

export function loadOpenAiPlannerConfig(
  env: PlannerEnv = process.env,
): OpenAiPlannerConfig {
  const apiKey = env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new PlannerConfigurationError(
      "OPENAI_API_KEY is required to run the real OpenAI TurnPlanner. Set OPENAI_API_KEY before running planner-backed simulation or model comparison.",
    );
  }

  return {
    provider: "openai",
    apiKey,
    model: env.OPENAI_MODEL?.trim() || defaultOpenAiPlannerModel,
    promptVersion:
      env.OPENAI_PLANNER_PROMPT_VERSION?.trim() ||
      defaultOpenAiPlannerPromptVersion,
  };
}
