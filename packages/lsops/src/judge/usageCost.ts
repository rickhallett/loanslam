export interface TokenPrice {
  input: number;
  cachedInput: number;
  output: number;
}

export const PRICES_PER_1M: Record<string, TokenPrice> = {
  "gpt-5.5": { input: 5, cachedInput: 0.5, output: 30 },
  "gpt-5.4": { input: 2.5, cachedInput: 0.25, output: 15 },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, cachedInput: 0.02, output: 1.25 },
};

export function estimateUsageCostUsd(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}): number | null {
  const price = PRICES_PER_1M[input.model];
  if (!price) return null;
  const cached = input.cachedInputTokens ?? 0;
  const uncached = Math.max(0, input.inputTokens - cached);
  return (
    (uncached * price.input +
      cached * price.cachedInput +
      input.outputTokens * price.output) /
    1_000_000
  );
}
