import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import {
  assertValidSessionDump,
  summarizeEvidence,
  type EvidenceSummary,
  type LabSessionDump,
  type ValidatedTurnResultLike,
} from "./evidence";

export const defaultLabApiBaseUrl = "http://127.0.0.1:8787";
export const allowedLabApiBaseUrls = [
  defaultLabApiBaseUrl,
  "http://127.0.0.1:5173",
];
export const defaultArtifactDir = "artifacts/phase0";

export interface LabApiClientOptions {
  baseUrl?: string;
  allowedBaseUrls?: string[];
}

export interface StartSessionResult {
  baseUrl: string;
  conversationRef: string;
  session: LabSessionDump;
  summary: EvidenceSummary;
}

export interface SendMessageInput extends LabApiClientOptions {
  conversationRef: string;
  message: string;
}

export interface SendMessageResult {
  baseUrl: string;
  conversationRef: string;
  result: ValidatedTurnResultLike;
  session: LabSessionDump;
  summary: EvidenceSummary;
}

export interface FetchSessionInput extends LabApiClientOptions {
  conversationRef: string;
}

export interface FetchSessionResult {
  baseUrl: string;
  conversationRef: string;
  session: LabSessionDump;
  summary: EvidenceSummary;
}

export interface DumpSessionInput extends LabApiClientOptions {
  conversationRef: string;
  outDir?: string;
  force?: boolean;
  repoRoot?: string;
  now?: () => Date;
}

export interface DumpSessionResult extends FetchSessionResult {
  artifactPath: string;
}

export class LabApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: unknown,
  ) {
    super(message);
    this.name = "LabApiError";
  }
}

export function assertAllowedBaseUrl({
  baseUrl = defaultLabApiBaseUrl,
  allowedBaseUrls = allowedLabApiBaseUrls,
}: LabApiClientOptions = {}): string {
  const parsed = new URL(baseUrl);
  const normalized = `${parsed.protocol}//${parsed.host}`;

  if (parsed.protocol !== "http:") {
    throw new Error("Lab API base URL must use http.");
  }

  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new Error("Lab API base URL must not include a path.");
  }

  if (!allowedBaseUrls.includes(normalized)) {
    throw new Error(
      `Lab API base URL is not allowed: ${normalized}. Use ${allowedBaseUrls.join(
        " or ",
      )}.`,
    );
  }

  return normalized;
}

export async function startSession(
  options: LabApiClientOptions = {},
): Promise<StartSessionResult> {
  const baseUrl = assertAllowedBaseUrl(options);
  const response = await requestJson(baseUrl, "/sessions", {
    method: "POST",
    body: {},
  });
  const conversationRef = readConversationRef(response);
  const session = assertValidSessionDump({
    conversationRef,
    state: readRecord(response, "state"),
    traces: [],
  });

  return {
    baseUrl,
    conversationRef,
    session,
    summary: summarizeEvidence({ session }),
  };
}

export async function sendSessionMessage(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const baseUrl = assertAllowedBaseUrl(input);
  const message = input.message.trim();

  if (!message) {
    throw new Error("Message must be a non-empty string.");
  }

  const result = (await requestJson(
    baseUrl,
    `/sessions/${encodeURIComponent(input.conversationRef)}/messages`,
    {
      method: "POST",
      body: { message },
    },
  )) as ValidatedTurnResultLike;
  const { session } = await fetchSession({
    baseUrl,
    allowedBaseUrls: [baseUrl],
    conversationRef: input.conversationRef,
  });

  return {
    baseUrl,
    conversationRef: input.conversationRef,
    result,
    session,
    summary: summarizeEvidence({ session, result }),
  };
}

export async function fetchSession(
  input: FetchSessionInput,
): Promise<FetchSessionResult> {
  const baseUrl = assertAllowedBaseUrl(input);
  const session = assertValidSessionDump(
    await requestJson(
      baseUrl,
      `/sessions/${encodeURIComponent(input.conversationRef)}`,
      { method: "GET" },
    ),
  );

  return {
    baseUrl,
    conversationRef: session.conversationRef,
    session,
    summary: summarizeEvidence({ session }),
  };
}

export async function resetSession(
  input: FetchSessionInput,
): Promise<FetchSessionResult> {
  const baseUrl = assertAllowedBaseUrl(input);
  const session = assertValidSessionDump(
    await requestJson(
      baseUrl,
      `/sessions/${encodeURIComponent(input.conversationRef)}/reset`,
      {
        method: "POST",
        body: {},
      },
    ),
  );

  return {
    baseUrl,
    conversationRef: session.conversationRef,
    session,
    summary: summarizeEvidence({ session }),
  };
}

export async function dumpSession(
  input: DumpSessionInput,
): Promise<DumpSessionResult> {
  const fetched = await fetchSession(input);
  const artifactPath = resolveArtifactPath({
    conversationRef: fetched.conversationRef,
    outDir: input.outDir ?? defaultArtifactDir,
    repoRoot: input.repoRoot ?? process.cwd(),
    now: input.now ?? (() => new Date()),
  });

  await mkdir(resolve(artifactPath, ".."), { recursive: true });
  await writeFile(
    artifactPath,
    `${JSON.stringify(fetched.session, null, 2)}\n`,
    {
      encoding: "utf8",
      flag: input.force ? "w" : "wx",
    },
  );

  return {
    ...fetched,
    artifactPath,
  };
}

function resolveArtifactPath({
  conversationRef,
  outDir,
  repoRoot,
  now,
}: {
  conversationRef: string;
  outDir: string;
  repoRoot: string;
  now: () => Date;
}): string {
  const root = resolve(repoRoot);
  const outputDir = resolve(root, outDir);
  const outputRelative = relative(root, outputDir);

  if (
    outputRelative.startsWith("..") ||
    isAbsolute(outputRelative) ||
    !outputRelative.startsWith(defaultArtifactDir)
  ) {
    throw new Error("Dump output directory must stay under artifacts/phase0.");
  }

  const timestamp = now().toISOString().replace(/[:.]/g, "-");
  const safeConversationRef = conversationRef.replace(/[^a-zA-Z0-9_-]/g, "-");

  return resolve(
    outputDir,
    `lab-session-${safeConversationRef}-${timestamp}.json`,
  );
}

async function requestJson(
  baseUrl: string,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<unknown> {
  const requestInit: RequestInit = {
    method: init.method,
  };

  if (init.body !== undefined) {
    requestInit.headers = {
      "content-type": "application/json",
    };
    requestInit.body = JSON.stringify(init.body);
  }

  const response = await fetch(`${baseUrl}${path}`, requestInit);
  const text = await response.text();
  const body = text ? parseJson(text) : {};

  if (!response.ok) {
    throw new LabApiError(
      `Lab API ${init.method} ${path} failed with ${response.status}.`,
      response.status,
      body,
    );
  }

  return body;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Lab API response was not valid JSON.");
  }
}

function readConversationRef(value: unknown): string {
  if (
    value !== null &&
    typeof value === "object" &&
    "conversationRef" in value &&
    typeof value.conversationRef === "string"
  ) {
    return value.conversationRef;
  }

  throw new Error("Lab API response is missing conversationRef.");
}

function readRecord(value: unknown, key: string): Record<string, unknown> {
  if (
    value !== null &&
    typeof value === "object" &&
    key in value &&
    value[key as keyof typeof value] !== null &&
    typeof value[key as keyof typeof value] === "object" &&
    !Array.isArray(value[key as keyof typeof value])
  ) {
    return value[key as keyof typeof value] as Record<string, unknown>;
  }

  throw new Error(`Lab API response is missing ${key}.`);
}
