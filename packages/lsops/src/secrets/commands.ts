import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import { parseDotenv, serializeDotenv } from "./dotenv";
import {
  initialKeys,
  loadSecretsManifest,
  requiredKeys,
  requireSecretEnv,
  syncableKeys,
} from "./manifest";
import { decryptDotenv, encryptDotenv, readStdin, sopsEnv } from "./sops";
import {
  formatRemoteSyncSummary,
  formatKeyList,
  parseSyncMode,
  runSecretSetCommand,
  type RemoteSyncSummary,
} from "./remoteSync";

export function secretsUsage(): string {
  return `Usage:
  lsops secrets status [env]
  lsops secrets init <env> [--force]
  lsops secrets edit <env>
  lsops secrets set <env> <key>
  lsops secrets render <env>
  lsops secrets run <env> -- <command...>
  lsops secrets sync vercel <env> [--dry-run|--apply]
  lsops secrets sync railway <env> [--dry-run|--apply] [--service <name>]`;
}

export async function runSecretsCommand(
  root: string,
  argv: string[],
): Promise<number> {
  const [command, envName, maybeKeyOrProvider, ...rest] = argv;
  const manifest = loadSecretsManifest(root);

  if (!command) throw new Error(secretsUsage());
  if (command === "status") {
    status(root, manifest, envName);
    return 0;
  }
  if (command === "init") {
    if (!envName) throw new Error(secretsUsage());
    init(root, manifest, envName, rest);
    return 0;
  }
  if (command === "edit") {
    if (!envName) throw new Error(secretsUsage());
    return edit(root, manifest, envName);
  }
  if (command === "set") {
    if (!envName || !maybeKeyOrProvider) throw new Error(secretsUsage());
    setValue(root, manifest, envName, maybeKeyOrProvider);
    return 0;
  }
  if (command === "render") {
    if (!envName) throw new Error(secretsUsage());
    render(root, manifest, envName);
    return 0;
  }
  if (command === "run") {
    if (!envName) throw new Error(secretsUsage());
    return runWithSecrets(root, manifest, envName, [
      maybeKeyOrProvider,
      ...rest,
    ]);
  }
  if (command === "sync") {
    const provider = envName;
    const syncEnv = maybeKeyOrProvider;
    if (!provider || !syncEnv) throw new Error(secretsUsage());
    if (provider === "vercel") {
      return syncVercel(root, manifest, syncEnv, rest);
    }
    if (provider === "railway") {
      return syncRailway(root, manifest, syncEnv, rest);
    }
  }
  if (command === "sync-vercel") {
    if (!envName) throw new Error(secretsUsage());
    return syncVercel(
      root,
      manifest,
      envName,
      filterStrings([maybeKeyOrProvider, ...rest]),
    );
  }
  if (command === "sync-railway") {
    if (!envName) throw new Error(secretsUsage());
    return syncRailway(
      root,
      manifest,
      envName,
      filterStrings([maybeKeyOrProvider, ...rest]),
    );
  }

  throw new Error(secretsUsage());
}

function init(
  root: string,
  manifest: ReturnType<typeof loadSecretsManifest>,
  name: string,
  args: string[],
): void {
  const config = requireSecretEnv(manifest, name);
  const output = resolve(root, config.encryptedFile);
  const force = args.includes("--force");
  if (existsSync(output) && !force) {
    throw new Error(
      `${config.encryptedFile} already exists; pass --force to replace it`,
    );
  }
  const keys = initialKeys(manifest, name);
  encryptDotenv(
    root,
    config,
    `${keys.map((key) => `${key}=`).join("\n")}\n`,
    name,
  );
  console.log(
    `${name}: initialized ${config.encryptedFile} (${keys.length} empty keys)`,
  );
}

function edit(
  root: string,
  manifest: ReturnType<typeof loadSecretsManifest>,
  name: string,
): number {
  const config = requireSecretEnv(manifest, name);
  if (!existsSync(resolve(root, config.encryptedFile))) {
    throw new Error(
      `Missing encrypted file: ${config.encryptedFile}; run secrets-init first`,
    );
  }
  const result = spawnSync(
    "sops",
    ["--input-type", "dotenv", "--output-type", "dotenv", config.encryptedFile],
    {
      cwd: root,
      env: sopsEnv(),
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function setValue(
  root: string,
  manifest: ReturnType<typeof loadSecretsManifest>,
  name: string,
  key: string,
): void {
  let input = readStdin();
  if (input.length === 0) throw new Error("No value received on stdin");
  input = input.replace(/\r?\n$/, "");
  const config = requireSecretEnv(manifest, name);
  const values = existsSync(resolve(root, config.encryptedFile))
    ? parseDotenv(decryptDotenv(root, config))
    : new Map(
        initialKeys(manifest, name).map((initialKey) => [initialKey, ""]),
      );
  values.set(key, input);
  encryptDotenv(
    root,
    config,
    serializeDotenv(values, Object.keys(manifest.variables)),
    name,
  );
  const note = manifest.variables[key] ? "" : " (untracked key)";
  console.log(`${name}: set ${key}${note}`);
}

function status(
  root: string,
  manifest: ReturnType<typeof loadSecretsManifest>,
  envName?: string,
): void {
  const names = envName ? [envName] : Object.keys(manifest.environments);
  for (const name of names) {
    const config = requireSecretEnv(manifest, name);
    if (!existsSync(resolve(root, config.encryptedFile))) {
      console.log(`${name}: missing ${config.encryptedFile}`);
      continue;
    }
    const values = parseDotenv(decryptDotenv(root, config));
    const required = requiredKeys(manifest, name);
    const missing = required.filter(
      (key) => !values.has(key) || values.get(key) === "",
    );
    const known = new Set(Object.keys(manifest.variables));
    const extra = [...values.keys()].filter((key) => !known.has(key)).sort();
    const state = missing.length === 0 ? "ok" : "missing";
    console.log(
      `${name}: ${state} (${values.size} keys, ${required.length - missing.length}/${required.length} required present)`,
    );
    if (missing.length) console.log(`  missing: ${missing.join(", ")}`);
    if (extra.length) console.log(`  untracked: ${extra.join(", ")}`);
  }
}

function render(
  root: string,
  manifest: ReturnType<typeof loadSecretsManifest>,
  name: string,
): void {
  const config = requireSecretEnv(manifest, name);
  const plaintext = decryptDotenv(root, config);
  const output = resolve(root, config.plaintextFile);
  mkdirSync(dirname(output), { recursive: true });
  const temp = `${output}.tmp-${process.pid}`;
  writeFileSync(temp, plaintext.endsWith("\n") ? plaintext : `${plaintext}\n`, {
    mode: 0o600,
  });
  chmodSync(temp, 0o600);
  renameSync(temp, output);
  const count = parseDotenv(plaintext).size;
  console.log(
    `${name}: rendered ${config.plaintextFile} (${count} keys, mode 0600)`,
  );
}

function runWithSecrets(
  root: string,
  manifest: ReturnType<typeof loadSecretsManifest>,
  name: string,
  commandArgs: Array<string | undefined>,
): number {
  const normalized = commandArgs.filter((arg): arg is string => Boolean(arg));
  while (normalized[0] === "--") normalized.shift();
  if (!normalized.length) throw new Error(secretsUsage());
  const config = requireSecretEnv(manifest, name);
  const values = parseDotenv(decryptDotenv(root, config));
  const child = spawnSync(normalized[0] ?? "", normalized.slice(1), {
    cwd: root,
    env: { ...process.env, ...Object.fromEntries(values) },
    stdio: "inherit",
  });
  if (child.error) throw child.error;
  return child.status ?? 1;
}

function syncVercel(
  root: string,
  manifest: ReturnType<typeof loadSecretsManifest>,
  name: string,
  args: string[],
): number {
  const target = manifest.deployTargets.vercel?.[name];
  if (!target) throw new Error(`No Vercel target configured for ${name}`);
  const config = requireSecretEnv(manifest, name);
  const values = parseDotenv(decryptDotenv(root, config));
  const keys = syncableKeys(manifest, "vercel", values);
  const mode = parseSyncMode(args);
  const targetLabel = target.gitBranch
    ? `${target.environment} branch ${target.gitBranch}`
    : target.environment;
  printPlan("vercel", name, mode.dryRun, keys, targetLabel);
  if (mode.dryRun) return 0;

  const summary: RemoteSyncSummary = { planned: keys, pushed: [], failed: [] };
  for (const key of keys) {
    const commandArgs = [
      "env",
      "add",
      key,
      target.environment,
      "--sensitive",
      "--force",
      "--yes",
    ];
    if (target.gitBranch) commandArgs.push("--git-branch", target.gitBranch);
    try {
      runSecretSetCommand({
        provider: "vercel",
        key,
        command: "vercel",
        args: commandArgs,
        cwd: root,
        value: values.get(key) ?? "",
      });
      summary.pushed.push(key);
    } catch (error) {
      summary.failed.push(key);
      console.error(error instanceof Error ? error.message : String(error));
    }
  }
  console.log(formatRemoteSyncSummary(summary));
  return summary.failed.length ? 1 : 0;
}

function syncRailway(
  root: string,
  manifest: ReturnType<typeof loadSecretsManifest>,
  name: string,
  args: string[],
): number {
  const target = manifest.deployTargets.railway?.[name];
  if (!target) throw new Error(`No Railway target configured for ${name}`);
  const config = requireSecretEnv(manifest, name);
  const values = parseDotenv(decryptDotenv(root, config));
  const keys = syncableKeys(manifest, "railway", values);
  const mode = parseSyncMode(args);
  const serviceIndex = args.indexOf("--service");
  const service = serviceIndex >= 0 ? args[serviceIndex + 1] : target.service;
  const targetLabel = service
    ? `${target.environment} service ${service}`
    : target.environment;
  printPlan("railway", name, mode.dryRun, keys, targetLabel);
  if (mode.dryRun) return 0;

  const summary: RemoteSyncSummary = { planned: keys, pushed: [], failed: [] };
  for (const key of keys) {
    const commandArgs = [
      "variable",
      "set",
      key,
      "--environment",
      target.environment,
      "--stdin",
      "--skip-deploys",
    ];
    if (service) commandArgs.push("--service", service);
    try {
      runSecretSetCommand({
        provider: "railway",
        key,
        command: "railway",
        args: commandArgs,
        cwd: root,
        value: values.get(key) ?? "",
      });
      summary.pushed.push(key);
    } catch (error) {
      summary.failed.push(key);
      console.error(error instanceof Error ? error.message : String(error));
    }
  }
  console.log(formatRemoteSyncSummary(summary));
  return summary.failed.length ? 1 : 0;
}

function printPlan(
  provider: string,
  envName: string,
  dryRun: boolean,
  keys: string[],
  target: string,
): void {
  console.log(
    `${provider}/${envName}: ${dryRun ? "dry-run" : "apply"} ${keys.length} keys -> ${target}`,
  );
  console.log(`planned: ${formatKeyList(keys)}`);
  if (dryRun) {
    console.log("Use --apply to mutate remote environment variables.");
  }
}

function filterStrings(args: Array<string | undefined>): string[] {
  return args.filter((arg): arg is string => Boolean(arg));
}
