import { describe, expect, it } from "vitest";

import {
  findTypeScriptSourcePolicyViolations,
  isForbiddenAnthropicProviderSpecifier,
  isForbiddenProjectJavaScriptSpecifier,
} from "./check-typescript-source-policy";

describe("TypeScript source policy", () => {
  it("rejects project-local JavaScript import specifiers", () => {
    expect(isForbiddenProjectJavaScriptSpecifier("./engine.js")).toBe(true);
    expect(isForbiddenProjectJavaScriptSpecifier("../policy.mjs")).toBe(true);
    expect(
      isForbiddenProjectJavaScriptSpecifier("@loanslam/core/foo.cjs"),
    ).toBe(true);
  });

  it("allows third-party package subpaths that publish .js exports", () => {
    expect(
      isForbiddenProjectJavaScriptSpecifier(
        "@modelcontextprotocol/sdk/server/mcp.js",
      ),
    ).toBe(false);
  });

  it("allows local non-JavaScript asset extensions", () => {
    expect(isForbiddenProjectJavaScriptSpecifier("./WidgetApp.vue")).toBe(
      false,
    );
    expect(isForbiddenProjectJavaScriptSpecifier("./fixture.json")).toBe(false);
  });

  it("finds static, dynamic, export, and import-type violations", () => {
    const violations = findTypeScriptSourcePolicyViolations(
      "fixture.ts",
      `
        import { a } from "./a.js";
        export { b } from "../b.mjs";
        const c = import("./c.cjs?raw");
        type D = import("@loanslam/core/d.js").D;
        import { external } from "@vendor/pkg/path.js";
      `,
    );

    expect(violations.map((violation) => violation.specifier)).toEqual([
      "./a.js",
      "../b.mjs",
      "./c.cjs?raw",
      "@loanslam/core/d.js",
    ]);
  });

  it("rejects Anthropic provider imports (OpenAI-only mandate)", () => {
    expect(isForbiddenAnthropicProviderSpecifier("@anthropic-ai/sdk")).toBe(
      true,
    );
    expect(
      isForbiddenAnthropicProviderSpecifier("@anthropic-ai/sdk/resources"),
    ).toBe(true);
    expect(isForbiddenAnthropicProviderSpecifier("anthropic")).toBe(true);
    expect(isForbiddenAnthropicProviderSpecifier("anthropic/client")).toBe(
      true,
    );
  });

  it("allows OpenAI and unrelated package names", () => {
    expect(isForbiddenAnthropicProviderSpecifier("openai")).toBe(false);
    expect(isForbiddenAnthropicProviderSpecifier("anthropic-tokenizer")).toBe(
      false,
    );
    expect(isForbiddenAnthropicProviderSpecifier("./anthropic-notes")).toBe(
      false,
    );
  });

  it("flags an Anthropic import with the anthropic-provider kind", () => {
    const violations = findTypeScriptSourcePolicyViolations(
      "fixture.ts",
      `import Anthropic from "@anthropic-ai/sdk";`,
    );

    expect(violations).toEqual([
      {
        kind: "anthropic-provider",
        filePath: "fixture.ts",
        line: 1,
        column: 23,
        specifier: "@anthropic-ai/sdk",
      },
    ]);
  });
});
