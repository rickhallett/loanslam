export const OPENAI_ADJUDICATION_LADDER = [
  "gpt-5.4-nano",
  "gpt-5.4-mini",
  "gpt-5.4",
  "gpt-5.5",
] as const;

export type OpenAIAdjudicationModel =
  (typeof OPENAI_ADJUDICATION_LADDER)[number];

export function escalationTarget(model: string): OpenAIAdjudicationModel {
  const index = OPENAI_ADJUDICATION_LADDER.indexOf(
    model as OpenAIAdjudicationModel,
  );
  return (
    OPENAI_ADJUDICATION_LADDER[
      Math.min(index + 1, OPENAI_ADJUDICATION_LADDER.length - 1)
    ] ?? "gpt-5.5"
  );
}
