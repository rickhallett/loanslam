import { describe, expect, it } from "vitest";

import { redactSecrets, redactedSubprocessFailure } from "./redaction";

describe("lsops redaction", () => {
  it("replaces known secret values", () => {
    expect(redactSecrets("token=abc123", ["abc123"])).toBe("token=[REDACTED]");
  });

  it("formats secret subprocess failures without stderr or values", () => {
    const error = redactedSubprocessFailure({
      provider: "vercel",
      key: "OPENAI_API_KEY",
      status: 1,
    });
    expect(error.message).toBe("vercel set OPENAI_API_KEY failed (exit 1)");
    expect(error.message).not.toContain("sk-");
  });
});
