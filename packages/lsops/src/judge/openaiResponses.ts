import OpenAI from "openai";

export interface JsonResponseRequest {
  model: string;
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  apiKey?: string;
}

export async function createOpenAIJsonResponse<T>(
  request: JsonResponseRequest,
): Promise<T> {
  const client = new OpenAI({
    apiKey: request.apiKey ?? process.env.OPENAI_API_KEY,
  });
  const response = await client.responses.create({
    model: request.model,
    instructions: request.instructions,
    input: [{ role: "user", content: request.input }],
    text: {
      format: {
        type: "json_schema",
        name: request.schemaName,
        schema: request.schema,
        strict: true,
      },
    },
  });
  return JSON.parse(response.output_text) as T;
}
