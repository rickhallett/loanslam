import { describe, expect, it } from "vitest";

import { JsonClient } from "./JsonClient";

describe("JsonClient", () => {
  it("normalizes base URLs and parses JSON responses", async () => {
    const client = new JsonClient({
      baseUrl: "https://example.test/",
      fetchImpl: async (input) =>
        new Response(JSON.stringify({ input }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    });

    const response = await client.request<{ input: string }>("path", {
      method: "POST",
      body: { ok: true },
    });
    expect(response.status).toBe(201);
    expect(response.json?.input).toBe("https://example.test/path");
  });

  it("keeps non-JSON error bodies as text and redacts configured values", async () => {
    const client = new JsonClient({
      baseUrl: "https://example.test",
      redactedValues: ["secret-value"],
      fetchImpl: async () =>
        new Response("bad secret-value", {
          status: 500,
          headers: { "content-type": "text/plain" },
        }),
    });

    const response = await client.request("/fail");
    expect(response.ok).toBe(false);
    expect(response.json).toBeNull();
    expect(response.text).toBe("bad [REDACTED]");
  });
});
