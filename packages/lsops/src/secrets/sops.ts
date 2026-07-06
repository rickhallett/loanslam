import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import type { SecretEnvironmentConfig } from "./manifest";

export function sopsEnv(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const defaultAgeKeyFile = `${env.HOME}/.config/sops/age/keys.txt`;
  if (env.SOPS_AGE_KEY_FILE || !existsSync(defaultAgeKeyFile)) {
    return env;
  }
  return { ...env, SOPS_AGE_KEY_FILE: defaultAgeKeyFile };
}

export function decryptDotenv(
  root: string,
  config: SecretEnvironmentConfig,
): string {
  if (!existsSync(resolve(root, config.encryptedFile))) {
    throw new Error(`Missing encrypted file: ${config.encryptedFile}`);
  }
  return runSops(root, [
    "--decrypt",
    "--input-type",
    "dotenv",
    "--output-type",
    "dotenv",
    config.encryptedFile,
  ]);
}

export function encryptDotenv(
  root: string,
  config: SecretEnvironmentConfig,
  plaintext: string,
  envName: string,
): void {
  const output = resolve(root, config.encryptedFile);
  const temp = resolve(root, `var/secrets-${envName}-${process.pid}.env`);
  mkdirSync(dirname(temp), { recursive: true });
  writeFileSync(temp, plaintext, { mode: 0o600 });
  chmodSync(temp, 0o600);
  try {
    const encrypted = runSops(root, [
      "--encrypt",
      "--input-type",
      "dotenv",
      "--output-type",
      "dotenv",
      "--filename-override",
      config.encryptedFile,
      temp,
    ]);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, encrypted);
  } finally {
    try {
      writeFileSync(temp, "");
    } catch {
      // best effort cleanup
    }
    rmSync(temp, { force: true });
  }
}

export function readStdin(): string {
  return readFileSync(0, "utf8");
}

function runSops(root: string, args: string[]): string {
  const result = spawnSync("sops", args, {
    cwd: root,
    env: sopsEnv(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail =
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      `sops exited ${result.status}`;
    throw new Error(detail);
  }
  return result.stdout ?? "";
}
