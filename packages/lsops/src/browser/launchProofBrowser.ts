import { chromium, type Browser, type LaunchOptions } from "playwright-core";

export const DEFAULT_PROOF_VIEWPORT = { width: 1280, height: 900 } as const;
export const CHROMIUM_PATH_ENV = "LSOPS_CHROMIUM_PATH";

export function resolveChromiumExecutablePath(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env[CHROMIUM_PATH_ENV] || env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
}

export async function launchProofBrowser(
  options: LaunchOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<Browser> {
  const executablePath = resolveChromiumExecutablePath(env);
  return chromium.launch({
    headless: true,
    ...options,
    ...(executablePath ? { executablePath } : {}),
  });
}
