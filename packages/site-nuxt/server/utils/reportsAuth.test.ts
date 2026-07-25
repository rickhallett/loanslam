import { describe, expect, it } from "vitest";

import {
  createReportsSessionToken,
  reportsAccessKeyMatches,
  reportsAuthRequiredForHostname,
  reportsPasswordMatches,
  reportsSessionTtlSeconds,
  reportsSessionValid,
  safeReportsNext,
} from "./reportsAuth";

const config = {
  password: "open-sesame",
  sessionSecret: "test-session-secret",
  accessKey: undefined,
  disabled: false,
  ttlSeconds: 60,
};

describe("reports auth", () => {
  it("creates short-lived signed session tokens", () => {
    const token = createReportsSessionToken({ now: 1_000, config });

    expect(reportsSessionValid({ token, now: 1_000, config })).toBe(true);
    expect(reportsSessionValid({ token, now: 62_000, config })).toBe(false);
    expect(
      reportsSessionValid({
        token,
        now: 1_000,
        config: { ...config, sessionSecret: "wrong-secret" },
      }),
    ).toBe(false);
  });

  it("compares the configured password", () => {
    expect(reportsPasswordMatches("open-sesame", config)).toBe(true);
    expect(reportsPasswordMatches("wrong", config)).toBe(false);
  });

  it("compares the configured access key", () => {
    expect(
      reportsAccessKeyMatches("stakeholder-demo", {
        ...config,
        accessKey: "stakeholder-demo",
      }),
    ).toBe(true);
    expect(
      reportsAccessKeyMatches("wrong", {
        ...config,
        accessKey: "stakeholder-demo",
      }),
    ).toBe(false);
  });

  it("only bypasses password auth on localhost when auth is unconfigured", () => {
    const unconfigured = {
      password: undefined,
      sessionSecret: undefined,
      accessKey: undefined,
      disabled: false,
      ttlSeconds: 60,
    };

    expect(reportsAuthRequiredForHostname("localhost", unconfigured)).toBe(
      false,
    );
    expect(reportsAuthRequiredForHostname("app.localhost", unconfigured)).toBe(
      false,
    );
    expect(reportsAuthRequiredForHostname("127.0.0.1", unconfigured)).toBe(
      false,
    );
    expect(reportsAuthRequiredForHostname("[::1]", unconfigured)).toBe(false);
    expect(reportsAuthRequiredForHostname("example.com", unconfigured)).toBe(
      true,
    );
    expect(reportsAuthRequiredForHostname("localhost", config)).toBe(true);
    expect(
      reportsAuthRequiredForHostname("example.com", {
        ...unconfigured,
        disabled: true,
      }),
    ).toBe(false);
  });

  it("keeps redirects inside the reports area", () => {
    expect(safeReportsNext("/reports/full.html")).toBe("/reports/full.html");
    expect(safeReportsNext("/reports/login")).toBe("/reports/");
    expect(safeReportsNext("https://example.com/reports")).toBe("/reports/");
    expect(safeReportsNext("//example.com/reports")).toBe("/reports/");
  });

  it("defaults session lifetime to two hours", () => {
    expect(reportsSessionTtlSeconds(undefined)).toBe(7200);
    expect(reportsSessionTtlSeconds("15")).toBe(15);
    expect(reportsSessionTtlSeconds("-1")).toBe(7200);
  });
});
