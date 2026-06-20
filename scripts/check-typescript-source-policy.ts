#!/usr/bin/env tsx
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import ts from "typescript";

const sourceExtensions = [".ts", ".tsx", ".mts", ".cts"];
const forbiddenJavaScriptExtension = /\.(?:js|jsx|mjs|cjs)$/;

export type SourcePolicyViolation = {
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

export function findTypeScriptSourcePolicyViolations(
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
    if (!isForbiddenProjectJavaScriptSpecifier(specifierNode.text)) {
      return;
    }

    const position = sourceFile.getLineAndCharacterOfPosition(
      specifierNode.getStart(sourceFile),
    );

    violations.push({
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

export function formatViolations(violations: SourcePolicyViolation[]): string {
  const lines = [
    "TypeScript source policy failed: project-local JavaScript import specifiers are forbidden.",
    "Use extensionless TypeScript source specifiers for local/project imports.",
  ];

  for (const violation of violations) {
    lines.push(
      `- ${violation.filePath}:${violation.line}:${violation.column} imports "${violation.specifier}"`,
    );
  }

  return lines.join("\n");
}

export function listTypeScriptSourceFiles(): string[] {
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
    findTypeScriptSourcePolicyViolations(
      filePath,
      readFileSync(filePath, "utf8"),
    ),
  );
}

export function main(): void {
  const filePaths = listTypeScriptSourceFiles();
  const violations = checkFiles(filePaths);

  if (violations.length > 0) {
    console.error(formatViolations(violations));
    process.exitCode = 1;
    return;
  }

  console.log(
    `TypeScript source policy passed: scanned ${filePaths.length} source files; no project-local JavaScript import specifiers found.`,
  );
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

function scriptKindForPath(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }

  return ts.ScriptKind.TS;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
