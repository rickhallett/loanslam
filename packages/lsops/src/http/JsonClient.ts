import { redactSecrets } from "../artifacts/redaction";

export interface JsonClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  redactedValues?: string[];
}

export interface JsonRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface JsonResponse<T = unknown> {
  status: number;
  ok: boolean;
  json: T | null;
  text: string;
  contentType: string;
}

export class JsonClient {
  readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  private readonly redactedValues: string[];

  constructor(options: JsonClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.headers = options.headers ?? {};
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.redactedValues = options.redactedValues ?? [];
  }

  async request<T = unknown>(
    path: string,
    options: JsonRequestOptions = {},
  ): Promise<JsonResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? this.timeoutMs,
    );
    try {
      const init: RequestInit = {
        method: options.method ?? "GET",
        headers: {
          "content-type": "application/json",
          ...this.headers,
          ...options.headers,
        },
        signal: controller.signal,
      };
      if (options.body !== undefined) {
        init.body =
          typeof options.body === "string"
            ? options.body
            : JSON.stringify(options.body);
      }
      const response = await this.fetchImpl(
        `${this.baseUrl}${normalizePath(path)}`,
        init,
      );
      const text = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      let json: T | null = null;
      if (text && contentType.includes("json")) {
        try {
          json = JSON.parse(text) as T;
        } catch {
          json = null;
        }
      }
      return {
        status: response.status,
        ok: response.ok,
        json,
        text: redactSecrets(text, this.redactedValues),
        contentType,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out: ${path}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
