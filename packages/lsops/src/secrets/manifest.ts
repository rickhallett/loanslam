import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface SecretEnvironmentConfig {
  encryptedFile: string;
  plaintextFile: string;
}

export interface SecretVariableConfig {
  required?: string[];
  targets?: string[];
}

export interface DeployTargetConfig {
  environment: string;
  gitBranch?: string;
  service?: string;
}

export interface SecretsManifest {
  environments: Record<string, SecretEnvironmentConfig>;
  variables: Record<string, SecretVariableConfig>;
  deployTargets: {
    vercel?: Record<string, DeployTargetConfig>;
    railway?: Record<string, DeployTargetConfig>;
  };
}

export function loadSecretsManifest(root: string): SecretsManifest {
  return JSON.parse(
    readFileSync(resolve(root, "secrets/manifest.json"), "utf8"),
  ) as SecretsManifest;
}

export function requireSecretEnv(
  manifest: SecretsManifest,
  name: string,
): SecretEnvironmentConfig {
  const config = manifest.environments[name];
  if (!config) {
    throw new Error(`Unknown environment: ${name}`);
  }
  return config;
}

export function requiredKeys(
  manifest: SecretsManifest,
  name: string,
): string[] {
  return Object.entries(manifest.variables)
    .filter(([, meta]) => meta.required?.includes(name))
    .map(([key]) => key)
    .sort();
}

export function initialKeys(manifest: SecretsManifest, name: string): string[] {
  return Object.entries(manifest.variables)
    .filter(([, meta]) => meta.required?.includes(name) || meta.targets?.length)
    .map(([key]) => key)
    .sort();
}

export function syncableKeys(
  manifest: SecretsManifest,
  provider: string,
  values: Map<string, string>,
): string[] {
  return Object.entries(manifest.variables)
    .filter(
      ([key, meta]) =>
        values.has(key) &&
        values.get(key) !== "" &&
        meta.targets?.includes(provider),
    )
    .map(([key]) => key)
    .sort();
}
