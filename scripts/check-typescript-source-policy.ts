#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import ts from "typescript";

const sourceExtensions = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];
const typeScriptSourceExtensions = [".ts", ".tsx", ".mts", ".cts"];
const forbiddenJavaScriptExtension = /\.(?:js|jsx|mjs|cjs)$/;

const secretManifestPath = "secrets/manifest.json";

// OpenAI-only provider mandate (CLAUDE.md / AGENTS.md): non-OpenAI inference
// provider SDKs must never be imported in project source. Patterns match
// package boundaries and avoid unrelated names like `anthropic-tokenizer`.
const forbiddenNonOpenAIProviderSpecifiers = [
  {
    provider: "Anthropic",
    pattern:
      /^(?:@anthropic-ai(?:\/|$)|anthropic(?:\/|$)|@ai-sdk\/anthropic(?:\/|$))/,
  },
  {
    provider: "Google Gemini/Vertex",
    pattern:
      /^(?:@google\/genai(?:\/|$)|@google\/generative-ai(?:\/|$)|@google-cloud\/vertexai(?:\/|$)|google-generative-ai(?:\/|$)|@ai-sdk\/google(?:\/|$)|@ai-sdk\/google-vertex(?:\/|$))/,
  },
  {
    provider: "AWS Bedrock",
    pattern:
      /^(?:@aws-sdk\/client-bedrock(?:\/|$)|@aws-sdk\/client-bedrock-runtime(?:\/|$)|@ai-sdk\/amazon-bedrock(?:\/|$))/,
  },
  {
    provider: "OpenRouter",
    pattern: /^(?:openrouter(?:\/|$)|@openrouter(?:\/|$))/,
  },
  {
    provider: "Groq",
    pattern: /^(?:groq-sdk(?:\/|$)|@ai-sdk\/groq(?:\/|$))/,
  },
  {
    provider: "Mistral",
    pattern: /^(?:@mistralai\/mistralai(?:\/|$)|@ai-sdk\/mistral(?:\/|$))/,
  },
  {
    provider: "Cohere",
    pattern: /^(?:cohere-ai(?:\/|$)|@ai-sdk\/cohere(?:\/|$))/,
  },
];

const providerEnvKeys = new Set([
  "ANTHROPIC_API_KEY",
  "AWS_BEARER_TOKEN_BEDROCK",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "OPENROUTER_API_KEY",
]);

const documentedNonInferenceProviderEnvKeys = new Set([
  "CLAUDE_CODE_OAUTH_TOKEN",
]);

export type SourcePolicyViolationKind =
  | "project-js-extension"
  | "non-openai-provider-import"
  | "non-openai-provider-env-key"
  | "undocumented-provider-env-exception";

export type SourcePolicyViolation = {
  kind: SourcePolicyViolationKind;
  filePath: string;
  line: number;
  column: number;
  specifier: string;
};

export function isForbiddenProjectJavaScriptSpecifier(
  specifier: string,
): boolean {
  if (!isProjectSpecifier(specifier)) {
    return false;
  }

  return forbiddenJavaScriptExtension.test(stripQueryAndHash(specifier));
}

export function isForbiddenAnthropicProviderSpecifier(
  specifier: string,
): boolean {
  return (
    forbiddenNonOpenAIProviderForSpecifier(specifier)?.provider === "Anthropic"
  );
}

export function isForbiddenNonOpenAIProviderSpecifier(
  specifier: string,
): boolean {
  return forbiddenNonOpenAIProviderForSpecifier(specifier) !== null;
}

export function findTypeScriptSourcePolicyViolations(
  filePath: string,
  sourceText: string,
): SourcePolicyViolation[] {
  return findSourcePolicyViolations(filePath, sourceText);
}

export function findSourcePolicyViolations(
  filePath: string,
  sourceText: string,
): SourcePolicyViolation[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(filePath),
  );
  const violations: SourcePolicyViolation[] = [];

  function recordSpecifier(specifierNode: ts.StringLiteralLike): void {
    const kind = forbiddenSpecifierKind(filePath, specifierNode.text);
    if (!kind) {
      return;
    }

    const position = sourceFile.getLineAndCharacterOfPosition(
      specifierNode.getStart(sourceFile),
    );

    violations.push({
      kind,
      filePath,
      line: position.line + 1,
      column: position.character + 1,
      specifier: specifierNode.text,
    });
  }

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      isStringLiteralLike(node.moduleSpecifier)
    ) {
      recordSpecifier(node.moduleSpecifier);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      isStringLiteralLike(node.arguments[0])
    ) {
      recordSpecifier(node.arguments[0]);
    }

    if (
      ts.isCallExpression(node) &&
      isRequireCall(node) &&
      node.arguments[0] &&
      isStringLiteralLike(node.arguments[0])
    ) {
      recordSpecifier(node.arguments[0]);
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      isStringLiteralLike(node.argument.literal)
    ) {
      recordSpecifier(node.argument.literal);
    }

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      isStringLiteralLike(node.moduleReference.expression)
    ) {
      recordSpecifier(node.moduleReference.expression);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

export function findProviderEnvManifestViolations(
  filePath: string,
  sourceText: string,
): SourcePolicyViolation[] {
  const manifest = parseSecretManifest(sourceText);
  const variables = manifest.variables ?? {};
  const violations: SourcePolicyViolation[] = [];

  for (const [envKey, meta] of Object.entries(variables)) {
    if (providerEnvKeys.has(envKey)) {
      const policy = meta.providerPolicy;
      const required = stringArray(meta.required);
      const targets = stringArray(meta.targets);
      const reason =
        typeof policy?.reason === "string" ? policy.reason.trim() : "";

      if (
        policy?.allowlisted !== true ||
        reason.length === 0 ||
        required.length > 0 ||
        targets.length > 0
      ) {
        violations.push(manifestViolation(filePath, sourceText, envKey, {
          kind: "non-openai-provider-env-key",
          specifier: envKey,
        }));
      }

      continue;
    }

    if (documentedNonInferenceProviderEnvKeys.has(envKey)) {
      const policy = meta.providerPolicy;
      const reason =
        typeof policy?.reason === "string" ? policy.reason.trim() : "";
      if (policy?.nonInference !== true || reason.length === 0) {
        violations.push(manifestViolation(filePath, sourceText, envKey, {
          kind: "undocumented-provider-env-exception",
          specifier: envKey,
        }));
      }
    }
  }

  return violations;
}

const violationReasons: Record<SourcePolicyViolationKind, string> = {
  "project-js-extension":
    "project-local JavaScript import specifier (use an extensionless TypeScript source specifier)",
  "non-openai-provider-import":
    "forbidden non-OpenAI inference provider import (this repo is OpenAI-only; see CLAUDE.md / AGENTS.md)",
  "non-openai-provider-env-key":
    "non-OpenAI inference provider env key must be explicitly allowlisted and must not be required or deployed",
  "undocumented-provider-env-exception":
    "provider-adjacent non-inference env key must be documented with providerPolicy.nonInference",
};

export function formatViolations(violations: SourcePolicyViolation[]): string {
  const lines = [
    "Source policy failed.",
    "- Local/project imports must use extensionless TypeScript source specifiers.",
    "- Non-OpenAI inference provider SDKs must never be imported.",
    "- Non-OpenAI inference provider env keys must stay allowlisted, unused, and undeployed.",
  ];

  for (const violation of violations) {
    lines.push(
      `- ${violation.filePath}:${violation.line}:${violation.column} imports "${violation.specifier}" -> ${violationReasons[violation.kind]}`,
    );
  }

  return lines.join("\n");
}

export function listSourceFiles(): string[] {
  const output = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ...sourceExtensions.map((extension) => `*${extension}`),
    ],
    { encoding: "utf8" },
  );

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((filePath) => !filePath.endsWith(".d.ts.map"))
    .sort();
}

export function checkFiles(filePaths: string[]): SourcePolicyViolation[] {
  return filePaths.flatMap((filePath) =>
    findSourcePolicyViolations(filePath, readFileSync(filePath, "utf8")),
  );
}

export function main(): void {
  const filePaths = listSourceFiles();
  const violations = [
    ...checkFiles(filePaths),
    ...checkSecretManifest(secretManifestPath),
  ];

  if (violations.length > 0) {
    console.error(formatViolations(violations));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Source policy passed: scanned ${filePaths.length} source files and ${secretManifestPath}; no project-local JavaScript import specifiers, forbidden provider imports, or unapproved provider env keys found.`,
  );
}

function forbiddenSpecifierKind(
  filePath: string,
  specifier: string,
): SourcePolicyViolationKind | null {
  if (
    isTypeScriptSourcePath(filePath) &&
    isForbiddenProjectJavaScriptSpecifier(specifier)
  ) {
    return "project-js-extension";
  }

  if (isForbiddenNonOpenAIProviderSpecifier(specifier)) {
    return "non-openai-provider-import";
  }

  return null;
}

function isProjectSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("@loanslam/")
  );
}

function stripQueryAndHash(specifier: string): string {
  return specifier.split(/[?#]/, 1)[0] ?? specifier;
}

function isStringLiteralLike(node: ts.Node): node is ts.StringLiteralLike {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function isRequireCall(node: ts.CallExpression): boolean {
  return ts.isIdentifier(node.expression) && node.expression.text === "require";
}

function scriptKindForPath(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }

  if (filePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }

  if (
    filePath.endsWith(".js") ||
    filePath.endsWith(".mjs") ||
    filePath.endsWith(".cjs")
  ) {
    return ts.ScriptKind.JS;
  }

  return ts.ScriptKind.TS;
}

function isTypeScriptSourcePath(filePath: string): boolean {
  return typeScriptSourceExtensions.some((extension) =>
    filePath.endsWith(extension),
  );
}

function forbiddenNonOpenAIProviderForSpecifier(
  specifier: string,
): { provider: string } | null {
  const normalizedSpecifier = stripQueryAndHash(specifier);
  return (
    forbiddenNonOpenAIProviderSpecifiers.find(({ pattern }) =>
      pattern.test(normalizedSpecifier),
    ) ?? null
  );
}

function checkSecretManifest(filePath: string): SourcePolicyViolation[] {
  if (!existsSync(filePath)) {
    return [];
  }

  return findProviderEnvManifestViolations(
    filePath,
    readFileSync(filePath, "utf8"),
  );
}

type SecretManifest = {
  variables?: Record<string, SecretManifestVariable>;
};

type SecretManifestVariable = {
  required?: unknown;
  targets?: unknown;
  providerPolicy?: {
    allowlisted?: unknown;
    nonInference?: unknown;
    reason?: unknown;
  };
};

function parseSecretManifest(sourceText: string): SecretManifest {
  const parsed = JSON.parse(sourceText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return parsed as SecretManifest;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function manifestViolation(
  filePath: string,
  sourceText: string,
  envKey: string,
  detail: Pick<SourcePolicyViolation, "kind" | "specifier">,
): SourcePolicyViolation {
  const position = lineAndColumnForEnvKey(sourceText, envKey);
  return {
    ...detail,
    filePath,
    line: position.line,
    column: position.column,
  };
}

function lineAndColumnForEnvKey(
  sourceText: string,
  envKey: string,
): { line: number; column: number } {
  const index = sourceText.indexOf(JSON.stringify(envKey));
  if (index < 0) {
    return { line: 1, column: 1 };
  }

  const prefix = sourceText.slice(0, index);
  const lines = prefix.split(/\r?\n/);
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
