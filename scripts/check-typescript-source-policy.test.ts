import { describe, expect, it } from "vitest";

import {
  findProviderEnvManifestViolations,
  findSourcePolicyViolations,
  findTypeScriptSourcePolicyViolations,
  isForbiddenAnthropicProviderSpecifier,
  isForbiddenNonOpenAIProviderSpecifier,
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
        kind: "non-openai-provider-import",
        filePath: "fixture.ts",
        line: 1,
        column: 23,
        specifier: "@anthropic-ai/sdk",
      },
    ]);
  });

  it("flags non-OpenAI provider imports in JavaScript source", () => {
    const violations = findSourcePolicyViolations(
      "fixture.mjs",
      `
        import { GoogleGenAI } from "@google/genai";
        const Anthropic = require("@anthropic-ai/sdk");
      `,
    );

    expect(violations.map((violation) => violation.specifier)).toEqual([
      "@google/genai",
      "@anthropic-ai/sdk",
    ]);
    expect(violations.map((violation) => violation.kind)).toEqual([
      "non-openai-provider-import",
      "non-openai-provider-import",
    ]);
  });

  it("does not apply TypeScript extensionless-import policy to JavaScript source", () => {
    const violations = findSourcePolicyViolations(
      "scripts/example.mjs",
      `import helper from "./helper.js";`,
    );

    expect(violations).toEqual([]);
  });

  it("rejects common non-OpenAI inference provider package specifiers", () => {
    expect(isForbiddenNonOpenAIProviderSpecifier("@google/genai")).toBe(true);
    expect(
      isForbiddenNonOpenAIProviderSpecifier(
        "@aws-sdk/client-bedrock-runtime",
      ),
    ).toBe(true);
    expect(isForbiddenNonOpenAIProviderSpecifier("groq-sdk")).toBe(true);
    expect(isForbiddenNonOpenAIProviderSpecifier("@mistralai/mistralai")).toBe(
      true,
    );
    expect(isForbiddenNonOpenAIProviderSpecifier("openai")).toBe(false);
    expect(
      isForbiddenNonOpenAIProviderSpecifier("@google-cloud/storage"),
    ).toBe(false);
  });

  it("requires non-OpenAI provider env keys to be allowlisted and undeployed", () => {
    const violations = findProviderEnvManifestViolations(
      "secrets/manifest.json",
      JSON.stringify(
        {
          variables: {
            ANTHROPIC_API_KEY: {
              required: ["production"],
              targets: ["railway"],
              providerPolicy: {
                allowlisted: true,
                reason: "Temporary provider migration test.",
              },
            },
          },
        },
        null,
        2,
      ),
    );

    expect(violations).toEqual([
      expect.objectContaining({
        kind: "non-openai-provider-env-key",
        specifier: "ANTHROPIC_API_KEY",
      }),
    ]);
  });

  it("allows explicitly documented legacy provider env keys with no runtime use", () => {
    const violations = findProviderEnvManifestViolations(
      "secrets/manifest.json",
      JSON.stringify({
        variables: {
          GEMINI_API_KEY: {
            required: [],
            targets: [],
            providerPolicy: {
              allowlisted: true,
              reason: "Legacy encrypted carryover only; not project runtime.",
            },
          },
        },
      }),
    );

    expect(violations).toEqual([]);
  });

  it("requires provider-adjacent non-inference exceptions to be documented", () => {
    expect(
      findProviderEnvManifestViolations(
        "secrets/manifest.json",
        JSON.stringify({
          variables: {
            CLAUDE_CODE_OAUTH_TOKEN: {
              required: [],
              targets: [],
            },
          },
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        kind: "undocumented-provider-env-exception",
        specifier: "CLAUDE_CODE_OAUTH_TOKEN",
      }),
    ]);

    expect(
      findProviderEnvManifestViolations(
        "secrets/manifest.json",
        JSON.stringify({
          variables: {
            CLAUDE_CODE_OAUTH_TOKEN: {
              required: [],
              targets: [],
              providerPolicy: {
                nonInference: true,
                reason: "Agent CLI credential; not project runtime inference.",
              },
            },
          },
        }),
      ),
    ).toEqual([]);
  });
});
