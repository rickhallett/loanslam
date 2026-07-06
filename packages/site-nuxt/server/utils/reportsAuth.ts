import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { sep, resolve } from "node:path";

import type { H3Event } from "h3";
import {
  createError,
  getCookie,
  getRequestURL,
  sendRedirect,
  sendStream,
  setCookie,
  setResponseHeader,
} from "h3";

const cookieName = "ls_reports_session";
const defaultSessionTtlSeconds = 2 * 60 * 60;

export interface ReportsAuthConfig {
  password?: string;
  sessionSecret?: string;
  ttlSeconds: number;
}

export function reportsAuthConfig(
  env: Record<string, string | undefined> = process.env,
): ReportsAuthConfig {
  return {
    password: env.REPORTS_ACCESS_PASSWORD,
    sessionSecret: env.REPORTS_SESSION_SECRET,
    ttlSeconds: reportsSessionTtlSeconds(env.REPORTS_SESSION_TTL_SECONDS),
  };
}

export function reportsSessionTtlSeconds(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : defaultSessionTtlSeconds;
}

export function reportsAuthConfigured(config = reportsAuthConfig()): boolean {
  return Boolean(config.password && config.sessionSecret);
}

export function reportsAuthRequiredForHostname(
  hostname: string | undefined,
  config = reportsAuthConfig(),
): boolean {
  if (reportsAuthConfigured(config)) {
    return true;
  }
  return !reportsHostnameIsLocal(hostname);
}

export function reportsPasswordMatches(
  candidate: string,
  config = reportsAuthConfig(),
): boolean {
  if (!config.password) {
    return false;
  }
  return constantTimeEqual(candidate, config.password);
}

export function createReportsSessionToken({
  now = Date.now(),
  config = reportsAuthConfig(),
}: {
  now?: number;
  config?: ReportsAuthConfig;
} = {}): string {
  if (!config.sessionSecret) {
    throw new Error("REPORTS_SESSION_SECRET is not configured.");
  }

  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(now / 1000) + config.ttlSeconds,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload, config.sessionSecret)}`;
}

export function reportsSessionValid({
  token,
  now = Date.now(),
  config = reportsAuthConfig(),
}: {
  token?: string;
  now?: number;
  config?: ReportsAuthConfig;
}): boolean {
  if (!token || !config.sessionSecret) {
    return false;
  }

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) {
    return false;
  }
  if (!constantTimeEqual(signature, sign(payload, config.sessionSecret))) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return (
      typeof parsed.exp === "number" &&
      Number.isFinite(parsed.exp) &&
      parsed.exp > Math.floor(now / 1000)
    );
  } catch {
    return false;
  }
}

export function setReportsSessionCookie(
  event: H3Event,
  token: string,
  config = reportsAuthConfig(),
): void {
  setCookie(event, cookieName, token, {
    httpOnly: true,
    maxAge: config.ttlSeconds,
    path: "/reports",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function reportsRequestAuthenticated(
  event: H3Event,
  config = reportsAuthConfig(),
): boolean {
  return reportsSessionValid({ token: getCookie(event, cookieName), config });
}

export async function requireReportsAuth(event: H3Event): Promise<boolean> {
  const config = reportsAuthConfig();
  if (!reportsAuthRequiredForHostname(getRequestURL(event).hostname, config)) {
    return true;
  }

  if (!reportsAuthConfigured(config)) {
    throw createError({
      statusCode: 503,
      statusMessage:
        "Reports auth is required outside localhost, but reports auth is not configured.",
    });
  }

  if (reportsRequestAuthenticated(event, config)) {
    return true;
  }

  const url = getRequestURL(event);
  const next = encodeURIComponent(`${url.pathname}${url.search}`);
  await sendRedirect(event, `/reports/login?next=${next}`, 302);
  return false;
}

export function safeReportsNext(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "/reports/";
  }
  if (!value.startsWith("/reports") || value.startsWith("//")) {
    return "/reports/";
  }
  if (value.startsWith("/reports/login")) {
    return "/reports/";
  }
  return value;
}

export function reportsRoot(): string {
  const configured = process.env.REPORTS_DIR?.trim();
  if (configured) {
    return resolve(configured);
  }

  const fallback = resolve(process.cwd(), "var/reports");
  const candidates = [
    fallback,
    resolve(process.cwd(), "../../var/reports"),
    resolve(process.cwd(), "packages/review-host/public/reports"),
    resolve(process.cwd(), "../review-host/public/reports"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? fallback;
}

export function resolveReportFile(requestedPath: string): string | null {
  const root = reportsRoot();
  const cleanPath = normalizeReportPath(requestedPath);
  if (!cleanPath) {
    return null;
  }

  let target = resolve(root, cleanPath);
  if (!withinRoot(root, target)) {
    return null;
  }

  if (existsSync(target) && statSync(target).isDirectory()) {
    target = resolve(target, "index.html");
  }
  if (!withinRoot(root, target)) {
    return null;
  }
  return target;
}

export async function sendReportFile(
  event: H3Event,
  requestedPath: string,
): Promise<void> {
  const target = resolveReportFile(requestedPath);
  if (!target || !existsSync(target) || !statSync(target).isFile()) {
    throw createError({ statusCode: 404, statusMessage: "Report not found." });
  }

  setResponseHeader(event, "cache-control", "no-store");
  setResponseHeader(event, "content-type", contentTypeForPath(target));
  await sendStream(event, createReadStream(target));
}

function normalizeReportPath(requestedPath: string): string | null {
  const path = requestedPath.replace(/^\/+/, "") || "index.html";
  if (path.includes("\0")) {
    return null;
  }
  return path;
}

function withinRoot(root: string, target: string): boolean {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(target);
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${sep}`)
  );
}

function reportsHostnameIsLocal(hostname: string | undefined): boolean {
  if (!hostname) {
    return false;
  }

  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.startsWith("127.")
  );
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function contentTypeForPath(path: string): string {
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/html; charset=utf-8";
}
