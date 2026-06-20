import { describe, expect, it } from "vitest";

import {
  findTypeScriptSourcePolicyViolations,
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
});
