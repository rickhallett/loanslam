import OpenAI from "openai";

import {
  type ConciergePromptMessage,
  conciergeInstructions,
} from "./conciergePrompt.service";

let client: OpenAI | null = null;

export function conciergeModel(): string {
  return process.env.CONCIERGE_MODEL ?? "gpt-5.5";
}

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured for the concierge.");
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function createConciergeReply({
  input,
  onDelta,
}: {
  input: ConciergePromptMessage[];
  onDelta?: (delta: string) => void;
}): Promise<string> {
  // Reasoning effort stays low and the output budget generous: on a
  // reasoning model a small max_output_tokens can be consumed entirely by
  // deliberation (observed on "use javascript" pressure turns), which
  // surfaced as empty or mid-sentence replies in the panel.
  if (onDelta) {
    const stream = await getClient().responses.create({
      model: conciergeModel(),
      instructions: conciergeInstructions,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: 1200,
      stream: true,
    });
    let full = "";
    for await (const chunk of stream) {
      if (chunk.type === "response.output_text.delta") {
        full += chunk.delta;
        onDelta(chunk.delta);
      }
    }
    return full.trim();
  }

  const response = await getClient().responses.create({
    model: conciergeModel(),
    instructions: conciergeInstructions,
    input,
    reasoning: { effort: "low" },
    max_output_tokens: 1200,
  });
  return response.output_text.trim();
}
