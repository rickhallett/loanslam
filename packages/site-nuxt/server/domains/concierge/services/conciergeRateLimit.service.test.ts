import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { conciergeRateLimitExceeded } from "./conciergeRateLimit.service";

describe("concierge rate limit service", () => {
  it("allows the default session budget before rejecting the next request", () => {
    const ip = `session-test-${randomUUID()}`;

    for (let index = 0; index < 40; index += 1) {
      expect(conciergeRateLimitExceeded("sessions", ip)).toBe(false);
    }

    expect(conciergeRateLimitExceeded("sessions", ip)).toBe(true);
  });
});
